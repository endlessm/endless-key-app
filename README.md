# Endless Key Windows Application

Windows version of Endless Key app.

### Requirements

- Python 3.7 (use 32-bit builds on Windows)

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

 * Build kolibri-electron:
```
    cd kolibri-electron
    yarn global add @electron-forge/cli
    yarn install
    yarn make --arch=ia32
```
    This will create the electron app in `kolibri-electron\out\kolibri-electron-win32-ia32`

 * Put all together:
```
    cp -r kolibri-electron\out\kolibri-electron-win32-ia32 kolibri-windows
    cp -r dist\kolibri\Kolibri kolibri-windows\resources\app\src\
    cp -r apps-bundle kolibri-windows\resources\app\src\
```
