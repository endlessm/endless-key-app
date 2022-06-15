const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('EndlessAPI', {
    // Triggers the Kolibri load, configured to not use the USB
    load: () => {
        ipcRenderer.send('load', { usb: false });
    },
    // Triggers the Kolibri load, configured to use the USB content
    loadWithUSB: () => {
        ipcRenderer.send('load', { usb: true });
    },
});
