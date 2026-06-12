/**
 * Isolated remove-bg worker (Windows). ONNX only — no Sharp in this process.
 *
 * Usage: node scripts/remove-bg-worker.js <preparedInput.png> <outputPngPath>
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { inferBackgroundRemovalFromFile } from "../services/backgroundRemovalInference.js";

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  console.error(
    "Usage: node scripts/remove-bg-worker.js <preparedInput.png> <output.png>"
  );
  process.exit(2);
}

try {
  const buffer = await inferBackgroundRemovalFromFile(inputPath);
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.promises.writeFile(outputPath, buffer);
  process.exit(0);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
}
