const { app, BrowserWindow, dialog, ipcMain, screen } = require("electron");
const fs = require("fs");
const path = require("path");

/** @type {BrowserWindow | null} */
let mainWindow = null;

const DEFAULT_CONFIG = Object.freeze({
  apiBase: "http://localhost:4000",
  monitorIndex: 1,
  fullscreen: true,
});

function writeLog(message) {
  const line = `${new Date().toISOString()} ${message}\n`;
  try {
    const logDir = path.join(app.getPath("userData"), "logs");
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, "kiosk.log"), line, "utf8");
  } catch {
    // Logging must never prevent the kiosk from starting.
  }
  console.log(message);
}

function loadRuntimeConfig() {
  const programData =
    process.env.PROGRAMDATA || path.dirname(app.getPath("userData"));
  const configPath =
    process.env.KIOSK_CONFIG_PATH ||
    path.join(programData, "SudutPandang", "config.json");

  let fileConfig = {};
  try {
    if (fs.existsSync(configPath)) {
      fileConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    }
  } catch (error) {
    writeLog(`Config tidak dapat dibaca (${configPath}): ${error.message}`);
  }

  const apiBase = String(
    process.env.KIOSK_API_BASE || fileConfig.apiBase || DEFAULT_CONFIG.apiBase
  ).replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(apiBase)) {
    throw new Error("apiBase harus berupa alamat http:// atau https://");
  }

  const monitorIndex = Number(
    process.env.KIOSK_MONITOR_INDEX ??
      fileConfig.monitorIndex ??
      DEFAULT_CONFIG.monitorIndex
  );

  return {
    apiBase,
    monitorIndex:
      Number.isInteger(monitorIndex) && monitorIndex >= 0 ? monitorIndex : 1,
    fullscreen:
      fileConfig.fullscreen == null
        ? DEFAULT_CONFIG.fullscreen
        : Boolean(fileConfig.fullscreen),
  };
}

function applyDevDefaults(config) {
  if (app.isPackaged) return config;

  const devConfig = { ...config };

  // MacBook / single-monitor dev: use primary display
  if (process.env.KIOSK_MONITOR_INDEX == null) {
    devConfig.monitorIndex = 0;
  }

  // Windowed mode for easier debugging on laptop
  if (process.env.KIOSK_DEV_WINDOWED === "true") {
    devConfig.fullscreen = false;
  }

  return devConfig;
}

function createWindow(config) {
  const displays = screen.getAllDisplays();
  const targetDisplay =
    displays[Math.min(config.monitorIndex, displays.length - 1)] || displays[0];

  const { x, y, width, height } = targetDisplay.bounds;

  mainWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    fullscreen: config.fullscreen,
    autoHideMenuBar: true,
    backgroundColor: "#000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (app.isPackaged) {
    mainWindow.loadFile(
      path.join(__dirname, "..", "dist", "renderer", "index.html")
    );
  } else {
    mainWindow.loadURL(
      process.env.KIOSK_DEV_SERVER_URL || "http://localhost:5180"
    );
  }

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file:") && !url.startsWith("http://localhost:5180")) {
      event.preventDefault();
    }
  });

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

const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.quit();
}

app.whenReady().then(() => {
  try {
    const config = applyDevDefaults(loadRuntimeConfig());
    process.env.KIOSK_API_BASE = config.apiBase;
    writeLog(
      `Kiosk dimulai (${app.isPackaged ? "production" : "development"}), API ${config.apiBase}, monitor ${config.monitorIndex}, fullscreen ${config.fullscreen}`
    );
    createWindow(config);
  } catch (error) {
    writeLog(`Kiosk gagal dimulai: ${error.stack || error.message}`);
    dialog.showErrorBox(
      "Sudut Pandang Kiosk gagal dimulai",
      `${error.message}\n\nPeriksa konfigurasi dan file log aplikasi.`
    );
    app.quit();
    return;
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(applyDevDefaults(loadRuntimeConfig()));
    }
  });
});

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
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

