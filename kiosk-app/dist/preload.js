const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kiosk", {
  camera: {
    connect: () => ipcRenderer.invoke("camera:connect"),
    disconnect: () => ipcRenderer.invoke("camera:disconnect"),
    capture: (payload) => ipcRenderer.invoke("camera:capture", payload),
  },
});

