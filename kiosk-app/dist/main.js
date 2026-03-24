const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

/** @type {BrowserWindow | null} */
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: true,
    autoHideMenuBar: true,
    backgroundColor: "#000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // In dev we serve the static HTML from src/renderer
  const indexFile = path.join(__dirname, "renderer", "index.html");
  mainWindow.loadFile(indexFile);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Basic camera service abstraction (implementation is pluggable)
class CameraService {
  constructor() {
    /** @type {NodeJS.Timeout | null} */
    this.previewInterval = null;
  }

  async connect() {
    // TODO: integrate Sony A6400 SDK / CLI here
    return true;
  }

  async disconnect() {
    this.stopLiveView();
  }

  startLiveView(sendFrame) {
    // For now we simulate live view; replace with real camera frames
    if (this.previewInterval) return;
    this.previewInterval = setInterval(() => {
      // sendFrame should accept something like a data URL or raw buffer reference
      sendFrame(null);
    }, 1000 / 30);
  }

  stopLiveView() {
    if (this.previewInterval) {
      clearInterval(this.previewInterval);
      this.previewInterval = null;
    }
  }

  /**
   * Capture photo and move into target folder for registered user.
   * @param {{ userSlug: string, targetFolder: string }} params
   */
  async capture(params) {
    // This is where you hook your actual Sony A6400 remote-control workflow.
    // Example idea (to adapt):
    // - Trigger shutter via vendor CLI/SDK
    // - Download latest image to params.targetFolder
    // - Return final file path
    console.log("Capture requested for", params);
    return { success: true, filePath: null };
  }
}

const cameraService = new CameraService();

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// IPC: session + camera
ipcMain.handle("camera:connect", async () => {
  return cameraService.connect();
});

ipcMain.handle("camera:disconnect", async () => {
  await cameraService.disconnect();
  return true;
});

ipcMain.handle("camera:capture", async (event, args) => {
  return cameraService.capture(args);
});

