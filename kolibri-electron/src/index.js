const { app, BrowserWindow, ipcMain } = require('electron');
const { env } = require('process');
const path = require('path');
const child_process = require('child_process');
const http = require('http');
const fs = require('fs');
const fsExtra = require('fs-extra');
const fsPromises = require('fs').promises;
const os = require('os');
const drivelist = require('drivelist');
const { shell } = require('electron');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

const NULL_PLUGIN_VERSION = '0';
const KOLIBRI = 'http://localhost:5000';
const userData = app.getPath("userData");
let mainWindow = null;
let loadRetries = 0;
let maxRetries = 3;

let django = null;

let KOLIBRI_HOME_TEMPLATE = '';
let KOLIBRI_APPDIR = path.normalize(path.join(__dirname, '..', '..', '..', 'Kolibri'));
let KOLIBRI_EXTENSIONS = path.join(KOLIBRI_APPDIR, 'kolibri', 'dist');
let KOLIBRI_HOME = path.join(userData, 'endless-key');
const METRICS_ID = 'endless-key-windows';
const AUTOPROVISION_FILE = path.join(__dirname, 'automatic_provision.json');

function removePidFile() {
  const pidFile = path.join(KOLIBRI_HOME, 'server.pid');
  if (fs.existsSync(pidFile)) {
    fs.rmSync(pidFile);
  }
}

function setupProvision() {
  // Copy the provision file because Kolibri removes after applying
  let provision_file = path.join(__dirname, 'provision.json');
  if (!fs.existsSync(provision_file)) {
    try {
      fsExtra.copySync(AUTOPROVISION_FILE, provision_file);
    } catch {
      provision_file = AUTOPROVISION_FILE;
    }
  }
  env.KOLIBRI_AUTOMATIC_PROVISION_FILE = provision_file;
}

async function loadKolibriEnv(packId) {
  env.KOLIBRI_HOME = KOLIBRI_HOME;
  env.DJANGO_SETTINGS_MODULE = "kolibri_tools.endless_key_settings";
  env.PYTHONPATH = KOLIBRI_EXTENSIONS;
  env.KOLIBRI_APPS_BUNDLE_PATH = path.join(__dirname, "apps-bundle", "apps");
  env.KOLIBRI_CONTENT_COLLECTIONS_PATH = path.join(__dirname, "collections");

  console.log('loading kolibri env, using as Windows APPX/MSIX application');
  env.KOLIBRI_PROJECT = METRICS_ID;

  if (packId != "") {
    console.log(`loading kolibri env, using package: ${packId}`);
    env.KOLIBRI_INITIAL_CONTENT_PACK = packId;
  }

  setupProvision();
  return;
}

async function getLoadingScreen() {
  const defaultLoading = path.join(KOLIBRI_APPDIR, 'assets', '_load.html');

  const welcome = path.join(
    KOLIBRI_EXTENSIONS,
    'kolibri_explore_plugin',
    'welcomeScreen',
    'index.html',
  );

  try {
    await fsPromises.access(welcome);
    return welcome;
  } catch (err) {
    console.log(`Welcome screen not found ${welcome}`);
  }

  return defaultLoading;
}

async function getPluginVersion() {
  try {
    const files = await fsPromises.readdir(KOLIBRI_EXTENSIONS);
    for (const file of files) {
      // Looking for plugin kolibri_explore_plugin-VERSION.dist-info
      const re = /kolibri_explore_plugin-(\d+\.\d+\.\d+)\.dist-info/
      const match = file.match(re);
      if (match) {
        return match[1];
      }
    }
  } catch (err) {
    console.error(err);
  }

  return NULL_PLUGIN_VERSION;
}

const waitForKolibriUp = () => {
  console.log('Kolibri server not yet started, checking again in one second...');

  if (loadRetries > maxRetries) {
    // Do not check anymore if the server is not starting
    return;
  }

  http.get(`${KOLIBRI}/api/public/info`, (response) => {
    mainWindow.loadURL(`${KOLIBRI}/explore`);
  }).on("error", (error) => {
    console.log("Error: " + error.message);
    setTimeout(() => { waitForKolibriUp(mainWindow); }, 1000);
  });
};

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    autoHideMenuBar: true,
    center: true,
    show:false,
    icon: path.join(__dirname, 'icon.png'),
    title: 'Endless Key',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  mainWindow.maximize();
  mainWindow.show();

  mainWindow.on('page-title-updated', (ev) => {
    ev.preventDefault();
  });

  // Link handler to open external links on default browser
  const windowOpenHandler = ({url}) => {
    const absolute = /^https?:\/\//i;
    const isRelative = (u) => !absolute.test(url);
    if (url.startsWith('file:') || url.startsWith(KOLIBRI) || isRelative(url)) {
      return {action: 'allow'};
    }
    shell.openExternal(url);
    return {action: 'deny'};
  };
  mainWindow.webContents.setWindowOpenHandler(windowOpenHandler);

  await mainWindow.loadFile(await getLoadingScreen());
  // Only show the welcome workflow if the KOLIBRI_HOME is not created
  if (!fs.existsSync(KOLIBRI_HOME)) {
    mainWindow.webContents.executeJavaScript('WelcomeApp.showWelcome()', true);
  } else {
    loadKolibriEnv('').then(() => {
      runKolibri();
    });
  }

  waitForKolibriUp(mainWindow);
};

const reloadKolibri = () => {
  const contents = mainWindow.webContents;

  if (loadRetries < maxRetries) {
    console.log('Kolibri server not starting, retrying...');
    contents.executeJavaScript('WelcomeApp.showLoadingRetry()', true);
    loadRetries++;
    runKolibri();
  } else {
    console.log('Kolibri server not starting');
    contents.executeJavaScript('WelcomeApp.showLoadingError()', true);
  }
}

const runKolibri = () => {
  console.log('Running kolibri backend');
  if (django) {
    console.log('Killing previous stalled server');
    django.kill();
  }

  removePidFile();

  django = child_process.spawn(path.join(KOLIBRI_APPDIR, 'Kolibri.exe'));
  django.stdout.on('data', (data) => {
    console.log(`Kolibri: ${data}`);
  });

  django.stderr.on('data', (data) => {
    console.error(`Kolibri: ${data}`);
  });

  django.on('close', (code) => {
    console.log(`child process exited with code ${code}`);
  });
  django.on('exit', (code, signal) => {
    // Try to reload the backend if it ends for some reason, do not reload if
    // it's a signal
    if (signal) {
      return;
    }

    console.log(`Kolibri server ended with code: ${code}`);
    reloadKolibri();
  });
};

app.on('ready', () => {
  createWindow();

  ipcMain.on('load', (_event, data) => {
    if (!('pack' in data)) {
      data['pack'] = '';
    }
    loadKolibriEnv(data.pack).then(() => {
      runKolibri();
    });
  });
});

app.on('window-all-closed', () => {
  app.quit();
  removePidFile();
});
