const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('WelcomeWrapper', {
    // Triggers the Kolibri load, configured to not use the USB
    startWithNetwork: (packId) => {
        ipcRenderer.send('load', { usb: false });
    },
    // Triggers the Kolibri load, configured to use the USB content
    startWithUSB: () => {
        ipcRenderer.send('load', { usb: true });
    },
});
