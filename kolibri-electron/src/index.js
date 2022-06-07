const { app, BrowserWindow } = require('electron');
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
let KOLIBRI_EXTENSIONS = path.join(__dirname, 'Kolibri', 'kolibri', 'dist');
let KOLIBRI_HOME = path.join(userData, 'endless-key');
const AUTOPROVISION_FILE = path.join(__dirname, 'automatic_provision.json');

const LOCK_FILE = {
  handler: null,
  path: null,
};

function removePidFile() {
  const pidFile = path.join(KOLIBRI_HOME, 'server.pid');
  if (fs.existsSync(pidFile)) {
    fs.rmSync(pidFile);
  }
}

async function getEndlessKeyDataPath() {
  const drives = await drivelist.list();

  const accessPromises = drives.map(async (drive) => {

    const mountpoint = drive.mountpoints[0];

    if (!mountpoint) {
      throw Error("Drive is not mounted");
    }

    const keyData = path.join(mountpoint.path, 'KOLIBRI_DATA');

    // thows an Error on fail
    await fsPromises.access(keyData);
    return keyData;
  });

  try {
    const keyData = await Promise.any(accessPromises);
    return keyData;
  } catch (error) {
    return undefined;
  }
}

async function loadKolibriEnv() {
  const keyData = await getEndlessKeyDataPath();
  env.KOLIBRI_HOME = KOLIBRI_HOME;
  env.PYTHONPATH = KOLIBRI_EXTENSIONS;
  env.KOLIBRI_APPS_BUNDLE_PATH = path.join(__dirname, "apps-bundle", "apps");

  if (!keyData) {
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
    return false;
  }

  KOLIBRI_HOME_TEMPLATE = path.join(keyData, 'preseeded_kolibri_home');
  env.KOLIBRI_CONTENT_FALLBACK_DIRS = path.join(keyData, 'content');

  // Lock USB
  LOCK_FILE.path = path.join(keyData, 'lock');
  LOCK_FILE.handler = await fsPromises.open(LOCK_FILE.path, 'w');

  return true;
}

async function getLoadingScreen() {
  const defaultLoading = path.join(__dirname, 'Kolibri', 'assets', '_load.html');

  const loading = path.join(
    KOLIBRI_EXTENSIONS,
    'kolibri_explore_plugin',
    'loadingScreen',
    'index.html',
  );

  try {
    await fsPromises.access(loading);
    return loading;
  } catch (err) {
    console.log(`Loading screen not found ${loading}`);
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

// Checks for the ~/.endless-key/version file and compares with the Endless key
// kolibri-explore-plugin version. If the version is different, the
// ~/endless-key folder will be removed.
//
// Return true if the version file does not match the plugin version or if the
// .endless-key doesn't exists.
async function checkVersion() {
  console.log('Checking kolibri-app version file');
  const versionFile = path.join(KOLIBRI_HOME, 'version');
  const pluginVersion = await getPluginVersion();
  let kolibriHomeVersion = NULL_PLUGIN_VERSION;

  try {
    kolibriHomeVersion = fs.readFileSync(versionFile, 'utf8').trim();
  } catch (error) {
    console.log('No version file found in .endless-key');
  }

  console.log(`${kolibriHomeVersion} < ${pluginVersion}`);
  if (kolibriHomeVersion < pluginVersion) {
    console.log('Newer version, replace the .endless-key directory and cleaning cache');
    await fsExtra.remove(KOLIBRI_HOME);

    if (fs.existsSync(KOLIBRI_HOME_TEMPLATE)) {
      await fsExtra.copy(KOLIBRI_HOME_TEMPLATE, KOLIBRI_HOME);
    }
    mainWindow.webContents.session.clearCache();
    return true;
  }

  return false;
}

async function updateVersion() {
  const versionFile = path.join(KOLIBRI_HOME, 'version');
  const pluginVersion = await getPluginVersion();

  await fsPromises.writeFile(versionFile, pluginVersion);
}

const waitForKolibriUp = () => {
  console.log('Kolibri server not yet started, checking again in one second...');

  if (loadRetries > maxRetries) {
    // Do not check anymore if the server is not starting
    return;
  }

  http.get(`${KOLIBRI}/api/public/info`, (response) => {
    mainWindow.loadURL(`${KOLIBRI}/explore`);
    updateVersion();
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

  const isDataAvailable = await loadKolibriEnv();
  runKolibri();

  await mainWindow.loadFile(await getLoadingScreen());

  if (!isDataAvailable) {
    console.log('No Endless Key data found. Loading default Kolibri');
  } else {
    const firstLaunch = await checkVersion();
    if (firstLaunch) {
      mainWindow.webContents.executeJavaScript('firstLaunch()', true);
    }
  }

  waitForKolibriUp(mainWindow);
  return isDataAvailable;
};

const reloadKolibri = () => {
  const contents = mainWindow.webContents;

  if (loadRetries < maxRetries) {
    console.log('Kolibri server not starting, retrying...');
    contents.executeJavaScript('show_retry()', true);
    loadRetries++;
    runKolibri();
  } else {
    console.log('Kolibri server not starting');
    contents.executeJavaScript('show_error()', true);
  }
}

const runKolibri = () => {
  console.log('Running kolibri backend');
  if (django) {
    console.log('Killing previous stalled server');
    django.kill();
  }

  removePidFile();

  django = child_process.spawn(path.join(__dirname, 'Kolibri', 'Kolibri.exe'));
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
});

app.on('window-all-closed', () => {
  app.quit();
  removePidFile();
  if (LOCK_FILE.handler) {
    LOCK_FILE.handler.close();
    if (fs.existsSync(LOCK_FILE.path)) {
      fs.rmSync(LOCK_FILE.path);
    }
  }
});
