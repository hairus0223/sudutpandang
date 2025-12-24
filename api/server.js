import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const BASE_DIR = "/Users/hairus/Documents/Studio456";

// Static file router (akses gambar)
app.use("/images", express.static(BASE_DIR));

// REGISTER CUSTOMER
app.post("/api/register", (req, res) => {
  const { name, phone, peopleCount } = req.body;

  if (!name || !phone || !peopleCount) {
    return res.status(400).json({ error: "name, phone, and peopleCount are required" });
  }

  // Create safe folder name: nama tanpa spasi + jumlah orang -> ex: Budi-3
  const slugName = name.replace(/\s+/g, "_"); // ganti spasi dengan _ -${peopleCount}
  const userFolder = `${slugName}`;

  const today = new Date();
  const folderName = `${String(today.getDate()).padStart(2, "0")}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}-${today.getFullYear()}`;

  const fullPath = path.join(BASE_DIR, folderName, userFolder);

  try {
    // Buat folder user
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }

    // === SAVE DATA TO TXT FILE ===
    const backupFolder = path.join(BASE_DIR, "backup");
    if (!fs.existsSync(backupFolder)) {
      fs.mkdirSync(backupFolder, { recursive: true });
    }

    const backupFilePath = path.join(
      backupFolder,
      `${slugName}-${peopleCount}-${Date.now()}.txt`
    );

    const backupData = {
      name,
      phone,
      peopleCount,
      user: userFolder,
      folderPath: `/images/${folderName}/${userFolder}`,
      todayFolder: folderName,
      registeredAt: today.toISOString(),
    };

    fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2));

    // === RETURN RESPONSE ===
    return res.json({
      success: true,
      message: "Customer registered successfully",
      customer: backupData,
    });
  } catch (err) {
    console.error("Error creating folder or writing backup:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});


app.get("/api/images/:user", (req, res) => {
  const { user } = req.params;
  const today = new Date();
  const folderName = `${String(today.getDate()).padStart(2, "0")}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}-${today.getFullYear()}`;

  const userFolderPath = path.join(BASE_DIR, folderName, user);

  if (!fs.existsSync(userFolderPath)) {
    return res.json({ images: [] });
  }

  // Ambil semua file gambar beserta waktu modifikasinya
  let files = fs
    .readdirSync(userFolderPath)
    .filter((f) => /\.(jpg|jpeg|png|gif)$/i.test(f))
    .map((filename) => {
      const fullPath = path.join(userFolderPath, filename);
      const stats = fs.statSync(fullPath);
      return {
        filename,
        mtime: stats.mtime, // waktu modifikasi
      };
    });

  // Sort by newest → oldest (descending)
  files.sort((a, b) => b.mtime - a.mtime);

  // Dynamic host (IP)
  const host = req.headers.host;

  const images = files.map((file) => ({
    filename: file.filename,
    url: `http://${host}/images/${folderName}/${user}/${file.filename}`,
  }));

  return res.json({ images });
});


app.post("/api/print/:user", express.json(), (req, res) => {
  const { user } = req.params;
  const { filenames } = req.body;

  if (!filenames || !Array.isArray(filenames) || filenames.length === 0) {
    return res.status(400).json({ error: "filenames array is required" });
  }

  const today = new Date();
  const folderName = `${String(today.getDate()).padStart(2, "0")}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}-${today.getFullYear()}`;

  const userFolderPath = path.join(BASE_DIR, folderName, user);
  const printFolderPath = path.join(userFolderPath, "print");

  try {
    // 1️⃣ Create print folder if it doesn't exist
    if (!fs.existsSync(printFolderPath)) {
      fs.mkdirSync(printFolderPath, { recursive: true });
    } else {
      // 2️⃣ Delete all files in the print folder
      const files = fs.readdirSync(printFolderPath);
      files.forEach((file) => {
        const filePath = path.join(printFolderPath, file);
        if (fs.lstatSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
        }
      });
    }

    // 3️⃣ Copy selected files into print folder
    filenames.forEach((filename) => {
      const sourcePath = path.join(userFolderPath, filename);
      const destPath = path.join(printFolderPath, filename);

      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, destPath);
      }
    });

    return res.json({
      success: true,
      message: "Files copied to print folder successfully",
      printFolder: `/images/${folderName}/${user}/print`,
    });
  } catch (error) {
    console.error("Error copying files:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
