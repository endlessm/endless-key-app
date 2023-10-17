# Endless Key Windows Application

Windows version of Endless Key app.

This app is a [pywebview](https://pywebview.flowrl.com/) wrapper around the
Kolibri app with a custom plugin configuration. The kolibri-electron package is
built using `pyinstaller`.

The `kolibri-electron` contains the interface and will launch the Kolibri
backend in another thread at startup.

The file `src/main.pyw` is the entry point that defines the application startup,
creates a webview window and sets the environment variables to configure the
application for launching the Kolibri server with a minimal configuration.

### Requirements

- Python 3.9

## Steps to build:

 * Install pyinstaller and other dependent packages:
```
    pip install pycparser==2.14 pyinstaller wheel pywebview
```

 * Download kolibri and plugins:
```
    pip install kolibri --target="src"
    pip install kolibri-zim-plugin[full] --target="src\kolibri\dist"
    pip install kolibri-explore-plugin --target="src\kolibri\dist"
```

 * Download app-bundle and unzip it in `src\apps-bundle`:
```
    https://github.com/endlessm/kolibri-explore-plugin/releases/latest/download/apps-bundle.zip
```

 * Download endless key collections and unzip it in `src\collections`:
```
    https://github.com/endlessm/endless-key-collections/releases/latest/download/collections.zip
```

 * Build: `pyinstaller --noconfirm main.spec`
   This will create a new folder in `dist` with the exe file.

 * Put all together:
```
    cp -r src/kolibri dist/kolibri-electron/_internal/
    cp -r src/apps-bundle dist/kolibri-electron/_internal/
    cp -r src/collections dist/kolibri-electron/_internal/
    cp -r src/automatic_provision.json dist/kolibri-electron/_internal/
```

## Release:

The release process is completely automated using github-ci. A tag in the
repository is a new release.

A new tag will trigger the build action that will upload the app package to the
Microsoft store to the Test Flight.
