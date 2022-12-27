# Endless Key Windows Application

Windows version of Endless Key app.

This app is an electron wrapper around the Kolibri app with a custom plugin
configuration. The Kolibri package is built using `pyinstaller`.

The `kolibri-electron` contains the interface and will launch the `Kolibri.exe`
backend at startup.

The file `kolibri-electron/src/index.js` defines the application startup and
set the environment variables to configure the application.

The file `src/main.pyw` is the entry point for the backend executable and just
launch the Kolibri server with a minimal configuration.

### Requirements

- Python 3.9

## Steps to build:

 * Install pyinstaller: `pip install pyinstaller`
 * Build: `pyinstaller --noconfirm main.spec`
   This will create a new folder in `dist` with the exe file.
 * Download kolibri and plugins:
```
    pip install kolibri --target="dist\Kolibri\"
    pip install kolibri-zim-plugin --target="dist\kolibri\kolibri\dist"
    pip install kolibri-explore-plugin --target="dist\kolibri\kolibri\dist"
```

 * Download app-bundle and unzip it in apps-bundle:
```
    https://github.com/endlessm/kolibri-explore-plugin/releases/latest/download/apps-bundle.zip
```

 * Download endless key collections, unzip and copy the `json` folder to `collections`:
```
    https://github.com/endlessm/endless-key-collections/archive/refs/heads/main.zip
```

 * Build kolibri-electron:
```
    cd kolibri-electron
    yarn global add @electron-forge/cli
    yarn install
    yarn make
```
    This will create the electron app in `kolibri-electron\out\kolibri-electron-win32-x64`

 * Put all together:
```
    cp -r kolibri-electron\out\kolibri-electron-win32-x64 kolibri-windows
    cp -r dist\kolibri\Kolibri kolibri-windows\resources\app\src\
    cp -r apps-bundle kolibri-windows\resources\app\src\
    cp -r endless-key-collections-main\json kolibri-windows\resources\app\src\collections
```

## Release:

The release process is completely automated using github-ci. A tag in the
repository is a new release.

A new tag will trigger the build action that will upload the app package to the
Microsoft store to the Test Flight.
