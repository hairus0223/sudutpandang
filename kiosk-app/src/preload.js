const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kiosk", {
  config: Object.freeze({
    apiBase: process.env.KIOSK_API_BASE || "http://localhost:4000",
  }),
  camera: {
    connect: () => ipcRenderer.invoke("camera:connect"),
    disconnect: () => ipcRenderer.invoke("camera:disconnect"),
    capture: (payload) => ipcRenderer.invoke("camera:capture", payload),
  },
});

