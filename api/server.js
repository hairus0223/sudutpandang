import express from "express";
import cors from "cors";
import path, { dirname } from "path";
import fs from "fs";
import chokidar from "chokidar";
import http from "http";
import { Server } from "socket.io";
import sharp from "sharp";
import { exec } from "child_process";
import PDFDocument from "pdfkit";
import { fileURLToPath } from "url";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 4000;

// ======================
// BASE DIRECTORY
// ======================
// Semua foto final dan struktur tanggal/user akan disimpan di sini.
// Di Windows ini berarti D:\SudutPandangStudio
const BASE_DIR = "D:\\SudutPandangStudio";

// Folder INPUT dari Imaging Edge: D:\SudutPandangStudio\capture
const CAPTURE_DIR = path.join(BASE_DIR, "capture");

// ======================
// __dirname fix untuk ES Module
// ======================
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ======================
// HELPERS
// ======================
function getTodayFolder() {
  const today = new Date();
  return `${String(today.getDate()).padStart(2, "0")}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}-${today.getFullYear()}`;
}

// Konversi pixel → point untuk PDF
const pxToPt = (px, dpi = 300) => (px / dpi) * 72;

// Ukuran 4R @300DPI
const widthPx = 6 * 300; // 6 inch
const heightPx = 4 * 300; // 4 inch
const pdfWidthPt = pxToPt(widthPx);
const pdfHeightPt = pxToPt(heightPx);

// ======================
// MIDDLEWARE
// ======================
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(
  "/images",
  (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  },
  express.static(BASE_DIR)
);
app.use(
  "/headline",
  (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  },
  express.static(path.join(BASE_DIR, "headline"))
);

// ======================
// SESSION STATE & CONFIG
// ======================
let activeSession = null;
let sessionLocked = false;

const SESSION_DURATION_MINUTES =
  process.env.SESSION_DURATION_MINUTES &&
  !Number.isNaN(Number(process.env.SESSION_DURATION_MINUTES))
    ? Number(process.env.SESSION_DURATION_MINUTES)
    : 10;

const CAPTURE_COUNTDOWN_SECONDS =
  process.env.CAPTURE_COUNTDOWN_SECONDS &&
  !Number.isNaN(Number(process.env.CAPTURE_COUNTDOWN_SECONDS))
    ? Number(process.env.CAPTURE_COUNTDOWN_SECONDS)
    : 3;

// ======================
// REGISTER CUSTOMER
// ======================
app.post("/api/register", (req, res) => {
  const {
    name,
    phone = "",
    peopleCount = 1,
    templateId = "4R",
    packageType = "self-photo",
  } = req.body;

  if (!name || typeof name !== "string" || name.trim() === "")
    return res.status(400).json({ error: "invalid data" });

  const people = Math.max(1, Math.min(8, Number(peopleCount) || 1));
  const slugName = name.trim().replace(/\s+/g, "_");
  const todayFolder = getTodayFolder();
  const userFolder = path.join(BASE_DIR, todayFolder, slugName);

  const customerData = {
    name: name.trim(),
    phone: typeof phone === "string" ? phone.trim() : "",
    peopleCount: people,
    user: slugName,
    templateId,
    packageType,
    printLimit: people,
    folderPath: `/images/${todayFolder}/${slugName}`,
    registeredAt: new Date().toISOString(),
  };

  fs.mkdirSync(userFolder, { recursive: true });
  fs.writeFileSync(
    path.join(userFolder, "customer.json"),
    JSON.stringify(customerData, null, 2)
  );

  res.json({ success: true, customer: customerData });
});

// Cek customer by name (today's folder) untuk kontrol sesi dari studio-kiosk
app.get("/api/customer-by-name", (req, res) => {
  const name = (req.query.name || "").toString().trim();
  if (!name) return res.status(400).json({ error: "name required" });

  const slugName = name.replace(/\s+/g, "_");
  const todayFolder = getTodayFolder();
  const file = path.join(BASE_DIR, todayFolder, slugName, "customer.json");

  if (!fs.existsSync(file)) return res.status(404).json({ error: "not found" });

  const data = JSON.parse(fs.readFileSync(file, "utf-8"));
  res.json({ success: true, customer: data });
});

app.get("/api/print-config/:user", (req, res) => {
  const { user } = req.params;
  const todayFolder = getTodayFolder();
  const file = path.join(BASE_DIR, todayFolder, user, "customer.json");

  if (!fs.existsSync(file)) return res.status(404).json({ error: "not found" });

  const data = JSON.parse(fs.readFileSync(file, "utf-8"));
  res.json({
    allowedPrint: data.printLimit,
    templateId: data.templateId,
    name: data.name,
    packageType: data.packageType || "self-photo",
  });
});

// ======================
// SESSION MANAGEMENT
// ======================
app.get("/api/session", (req, res) => res.json({ activeSession, sessionLocked }));

app.post("/api/session/start", (req, res) => {
  const { user, duration = SESSION_DURATION_MINUTES, peopleCount, packageType } = req.body;
  if (!user || !peopleCount)
    return res.status(400).json({ error: "user & peopleCount required" });

  activeSession = {
    user,
    peopleCount,
    packageType: packageType || "self-photo",
    endsAt: Date.now() + duration * 60 * 1000,
    pausedAt: null,
    remainingMs: null,
  };
  sessionLocked = false;
  io.emit("session-started", activeSession);
  res.json({ success: true, session: activeSession });
});

// ======================
// KIOSK FLOW CONTROL (TRIAL & MAIN SESSION)
// ======================
// Semua kontrol dipicu dari studio-kiosk, kiosk-app hanya mendengar event socket.

app.post("/api/kiosk/trial-start", (req, res) => {
  const { user, durationSeconds = 60 } = req.body || {};
  if (!user) return res.status(400).json({ error: "user required" });
  const durationMs = durationSeconds * 1000;
  io.emit("kiosk-trial-start", { user, durationMs });
  res.json({ success: true });
});

app.post("/api/kiosk/trial-skip", (req, res) => {
  const { user } = req.body || {};
  if (!user) return res.status(400).json({ error: "user required" });
  io.emit("kiosk-trial-skip", { user });
  res.json({ success: true });
});

app.post("/api/kiosk/main-start", (req, res) => {
  const {
    user,
    durationSeconds = SESSION_DURATION_MINUTES * 60,
    packageType = "self-photo",
  } = req.body || {};
  if (!user) return res.status(400).json({ error: "user required" });
  const durationMs = durationSeconds * 1000;
  io.emit("kiosk-main-start", { user, durationMs, packageType });
  res.json({ success: true });
});

// Kiosk configuration for frontend (session duration, countdown, etc)
app.get("/api/kiosk-config", (req, res) => {
  res.json({
    sessionDurationMinutes: SESSION_DURATION_MINUTES,
    captureCountdownSeconds: CAPTURE_COUNTDOWN_SECONDS,
  });
});

app.post("/api/session/pause", (req, res) => {
  if (!activeSession || activeSession.pausedAt)
    return res.status(400).json({ error: "No active session or already paused" });

  activeSession.remainingMs = activeSession.endsAt - Date.now();
  activeSession.pausedAt = Date.now();

  io.emit("session-paused", { remainingMs: activeSession.remainingMs });
  res.json({ success: true });
});

app.post("/api/session/resume", (req, res) => {
  if (!activeSession || !activeSession.pausedAt)
    return res.status(400).json({ error: "Session not paused" });

  activeSession.endsAt = Date.now() + activeSession.remainingMs;
  activeSession.pausedAt = null;
  activeSession.remainingMs = null;

  io.emit("session-resumed", activeSession);
  res.json({ success: true, session: activeSession });
});

app.post("/api/session/add-time", (req, res) => {
  const { minutes = 1 } = req.body;
  if (!activeSession) return res.status(400).json({ error: "No active session" });

  const extraMs = minutes * 60 * 1000;
  if (activeSession.pausedAt) {
    activeSession.remainingMs += extraMs;
    io.emit("session-paused", { remainingMs: activeSession.remainingMs });
  } else {
    activeSession.endsAt += extraMs;
    io.emit("session-resumed", activeSession);
  }

  res.json({ success: true });
});

app.post("/api/session/stop", (req, res) => {
  activeSession = null;
  sessionLocked = true;
  io.emit("session-ended");
  res.json({ success: true });
});

// Auto-end session
setInterval(() => {
  if (activeSession && !activeSession.pausedAt && Date.now() > activeSession.endsAt) {
    activeSession = null;
    sessionLocked = true;
    io.emit("session-ended");
  }
}, 1000);

// ======================
// PRINT LIMIT
// ======================
app.get("/api/print-limit", (req, res) => {
  if (!activeSession) return res.json({ allowedPrint: 0 });

  const people = activeSession.peopleCount;
  let allowedPrint = 2;
  if (people === 2) allowedPrint = 3;
  if (people >= 3) allowedPrint = 5;

  res.json({ allowedPrint });
});

// ======================
// CAPTURE ENDPOINT (optional camera trigger)
// ======================
// This lets the kiosk app ask the backend to run a configurable
// command that triggers the Sony camera shutter via vendor software.
// Configure via CAMERA_CAPTURE_COMMAND env, e.g. a .cmd or .bat file.

const CAMERA_CAPTURE_COMMAND = process.env.CAMERA_CAPTURE_COMMAND || null;

app.post("/api/capture", (req, res) => {
  if (!CAMERA_CAPTURE_COMMAND) {
    return res.status(500).json({ error: "CAMERA_CAPTURE_COMMAND not configured" });
  }

  const user = req.body?.user || activeSession?.user || "anonymous";

  const command = CAMERA_CAPTURE_COMMAND.replace(/\$USER/g, user);

  exec(command, (err, stdout, stderr) => {
    if (err) {
      console.error("Camera capture command failed:", err, stderr);
      return res.status(500).json({ error: "capture_failed" });
    }
    res.json({ success: true });
  });
});

// ======================
// GET IMAGES
// ======================
app.get("/api/images/:user", (req, res) => {
  const { user } = req.params;
  const todayFolder = getTodayFolder();
  const userPath = path.join(BASE_DIR, todayFolder, user);

  if (!fs.existsSync(userPath)) return res.json({ images: [] });

  const host = req.headers.host;
  const images = fs
    .readdirSync(userPath)
    .filter((f) => /\.(jpg|jpeg|png)$/i.test(f))
    .map((filename) => ({
      filename,
      url: `http://${host}/images/${todayFolder}/${user}/${filename}`,
    }));

  res.json({ images });
});

// API to get headline gallery
app.get("/api/headline", (req, res) => {
  const headlineDir = path.join(BASE_DIR, "headline");

  if (!fs.existsSync(headlineDir)) return res.json({ headlines: [] });

  const host = req.headers.host;
  const headlines = fs
    .readdirSync(headlineDir)
    .filter((f) => /\.(jpg|jpeg|png|gif)$/i.test(f))
    .map((filename) => ({
      filename,
      url: `http://${host}/headline/${filename}`,
    }));

  res.json({ headlines });
});

// ======================
// APPLY TEMPLATE
// ======================
async function applyTemplate(imagePath, outputPath, customer, template) {
  let img = sharp(imagePath).resize(template.size.width, template.size.height);

  if (template.logo) {
    img = img.composite([
      { input: path.join(__dirname, "logos", template.logo.path), left: template.logo.x, top: template.logo.y },
    ]);
  }

  if (template.text) {
    const svg = `
      <svg width="${template.size.width}" height="200">
        <text x="${template.text.x}" y="${template.text.y}"
          font-size="${template.text.fontSize}"
          fill="${template.text.color}"
          text-anchor="middle">
          ${customer.name}
        </text>
      </svg>`;
    img = img.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]);
  }

  await img.toFile(outputPath);
}

// ======================
// PRINT PDF 4R
// ======================
function silentPrint(filePath, printerName = null) {
  const sumatraPath = `"C:\\Users\\khairus\\AppData\\Local\\SumatraPDF\\SumatraPDF.exe"`;

  // Command untuk print silent
  const command = printerName
    ? `${sumatraPath} -print-to "${printerName}" "${filePath}"` // printer spesifik
    : `${sumatraPath} -print-to-default "${filePath}"`; // printer default

  exec(command, (err) => {
    if (err) console.error("Silent print error:", err);
  });
}


app.post("/api/print", async (req, res) => {
  const { images, printerName, templateId = "4R" } = req.body; // templateId opsional

  if (!Array.isArray(images) || images.length === 0)
    return res.status(400).json({ error: "No images" });

  // Folder print
  const printDir = path.join(BASE_DIR, "print");
  if (!fs.existsSync(printDir)) fs.mkdirSync(printDir, { recursive: true });

  // Tentukan ukuran PDF sesuai template
  let widthPx = 6 * 300; // default 4R Landscape
  let heightPx = 4 * 300;
  // if (templateId === "4R_FULL") {
  //   widthPx = 4 * 300; // portrait
  //   heightPx = 6 * 300;
  // }
  const pdfWidthPt = pxToPt(widthPx);
  const pdfHeightPt = pxToPt(heightPx);

  // PDF path
  const pdfPath = path.join(printDir, `print-${Date.now()}.pdf`);
  const doc = new PDFDocument({ autoFirstPage: false });
  const writeStream = fs.createWriteStream(pdfPath);
  doc.pipe(writeStream);

  // ICC profile path
  const iccPath = path.join(__dirname, "profiles", "sRGB-v4.icc");
  const hasIcc = fs.existsSync(iccPath);

  // Tentukan jumlah copy sesuai session
  // const copies = activeSession
  //   ? activeSession.peopleCount === 1
  //     ? 2
  //     : activeSession.peopleCount === 2
  //     ? 3
  //     : 5
  //   : 1;
  const copies = 1;
  
  try {
    for (const imgData of images) {
      const buffer = Buffer.from(imgData.replace(/^data:image\/png;base64,/, ""), "base64");

      // Proses gambar dengan Sharp
      let processedBuffer = sharp(buffer).rotate();

      if (templateId === "4R_FULL") {
        // paksa portrait, jika original landscape
        processedBuffer = processedBuffer.rotate(90);
      }

      processedBuffer = await processedBuffer
        .resize(widthPx, heightPx, { fit: "cover", position: "centre" })
        .withMetadata({ density: 300, ...(hasIcc ? { icc: iccPath } : {}) })
        .jpeg({ quality: 100 })
        .toBuffer();

      // Tambahkan page di PDF
      doc.addPage({ size: [pdfWidthPt, pdfHeightPt] });
      doc.image(processedBuffer, 0, 0, { width: pdfWidthPt, height: pdfHeightPt });
    }

    doc.end();

    writeStream.on("finish", () => {
      // Print sesuai jumlah copy
      for (let i = 0; i < copies; i++) {
        silentPrint(pdfPath, printerName);
      }

      // Auto-delete PDF 1 menit setelah print
      setTimeout(() => {
        if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
      }, 60_000);

      res.json({ success: true, file: pdfPath, copies });
    });

    writeStream.on("error", (err) => {
      console.error(err);
      res.status(500).json({ error: "PDF generation failed" });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Image processing failed" });
  }
});


// ======================
// WATCH FOLDER CAPTURE → USER FOLDER (TANPA AUTO PRINT)
// ======================
// Pantau hanya folder "capture" (output Imaging Edge), pindahkan
// ke folder tanggal/user aktif, lalu emit event untuk front-end.
chokidar
  .watch(CAPTURE_DIR, { persistent: true })
  .on("add", async (filePath) => {
    if (!filePath.match(/\.(jpg|jpeg|png)$/i)) return;
    if (!activeSession || sessionLocked) return;

    try {
      const todayFolder = getTodayFolder();
      const userFolder = path.join(BASE_DIR, todayFolder, activeSession.user);
      if (!fs.existsSync(userFolder)) fs.mkdirSync(userFolder, { recursive: true });

      const uniqueName = `${Date.now()}-${path.basename(filePath)}`;
      const finalPath = path.join(userFolder, uniqueName);

      // Pindahkan file dari D:\SudutPandangStudio\capture ke folder user
      fs.renameSync(filePath, finalPath);

      // Beri tahu front-end bahwa ada foto baru untuk user aktif
      io.emit("new-photo", { filename: path.basename(finalPath), fullPath: finalPath });
    } catch (err) {
      console.error("Image processing failed:", err);
    }
  });


// ======================
// SOCKET
// ======================
io.on("connection", (socket) => {
  console.log("🟢 Kiosk connected");
  socket.emit("session-state", { activeSession, sessionLocked });
});

// ======================
// START SERVER
// ======================
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running http://localhost:${PORT}`);
});
