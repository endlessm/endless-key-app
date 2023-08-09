const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('WelcomeWrapper', {
    // Triggers the Kolibri load, configured to use specified package
    startWithNetwork: (packId) => {
        ipcRenderer.send('load', { pack: packId });
    },
});
