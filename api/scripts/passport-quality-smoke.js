/**
 * Smoke test for pas-photo print quality: silhouette framing, studio tone
 * normalization, and 300 DPI output.
 *
 * Usage:
 *   npm run smoke-test:passport-quality
 *   node scripts/passport-quality-smoke.js --subject path/to/subject.png
 */
import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import { compositePassportPhoto } from "../services/passportComposite.js";
import {
  analyzeSubjectGeometry,
  computePassportFraming,
} from "../services/passportFraming.js";
import { rebuildPassportSubject } from "../services/passportMatte.js";
import { retouchPassportSubject } from "../services/passportRetouch.js";
import { PASSPORT_DPI } from "../services/passportSizes.js";

const WIDTH = 900;
const HEIGHT = 1200;

/** Dim, blue-cast bust on transparent background — a laptop webcam stand-in. */
async function buildSyntheticSubject() {
  const headCx = WIDTH * 0.5;
  const headCy = HEIGHT * 0.3;
  const headRx = WIDTH * 0.15;
  const headRy = headRx * 1.35;
  const svg = `
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <path d="M ${headCx - WIDTH * 0.3} ${HEIGHT}
               C ${headCx - WIDTH * 0.28} ${HEIGHT * 0.62},
                 ${headCx - WIDTH * 0.1} ${HEIGHT * 0.53},
                 ${headCx} ${HEIGHT * 0.53}
               C ${headCx + WIDTH * 0.1} ${HEIGHT * 0.53},
                 ${headCx + WIDTH * 0.28} ${HEIGHT * 0.62},
                 ${headCx + WIDTH * 0.3} ${HEIGHT} Z"
            fill="rgb(58,64,86)" />
      <rect x="${headCx - headRx * 0.36}" y="${headCy}"
            width="${headRx * 0.72}" height="${headRy * 1.3}"
            fill="rgb(104,84,78)" />
      <ellipse cx="${headCx}" cy="${headCy}" rx="${headRx}" ry="${headRy}"
               fill="rgb(118,96,88)" />
    </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function assertMatteRecoversChoppedHead() {
  const original = await sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 3,
      background: { r: 40, g: 44, b: 52 },
    },
  })
    .composite([{ input: await buildSyntheticSubject(), top: 0, left: 0 }])
    .png()
    .toBuffer();

  const originalPath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "passport-matte-")),
    "original.png"
  );
  fs.writeFileSync(originalPath, original);

  const chopped = await sharp(await buildSyntheticSubject())
    .ensureAlpha()
    .extract({
      left: 0,
      top: Math.round(HEIGHT * 0.28),
      width: WIDTH,
      height: HEIGHT - Math.round(HEIGHT * 0.28),
    })
    .extend({
      top: Math.round(HEIGHT * 0.28),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const rebuilt = await rebuildPassportSubject({
    originalPath,
    subjectBuffer: chopped,
  });
  const alpha = await sharp(rebuilt).extractChannel("alpha").raw().toBuffer();
  const sampleY = Math.round(HEIGHT * 0.22);
  let opaque = 0;
  for (let x = Math.round(WIDTH * 0.4); x < Math.round(WIDTH * 0.6); x += 1) {
    if (alpha[sampleY * WIDTH + x] > 200) opaque += 1;
  }
  if (opaque < 20) {
    throw new Error("matte did not restore chopped head pixels");
  }

  const bodyY = Math.round(HEIGHT * 0.75);
  let solid = 0;
  let counted = 0;
  for (let x = Math.round(WIDTH * 0.35); x < Math.round(WIDTH * 0.65); x += 1) {
    const a = alpha[bodyY * WIDTH + x];
    if (a < 8) continue;
    counted += 1;
    if (a >= 240) solid += 1;
  }
  if (counted && solid / counted < 0.85) {
    throw new Error("body matte still semi-transparent");
  }

  console.log("✓ matte restored chopped head and hardened body alpha");
}

function parseArgs(argv) {
  const args = { subjectPath: null };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--subject" && argv[i + 1]) {
      args.subjectPath = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

async function run() {
  const { subjectPath } = parseArgs(process.argv);
  console.log("\n🪪 Pas foto quality smoke\n");

  if (!subjectPath) {
    await assertMatteRecoversChoppedHead();
  }

  const source = subjectPath
    ? fs.readFileSync(subjectPath)
    : await buildSyntheticSubject();
  console.log(
    subjectPath ? `✓ subject ${subjectPath}` : "✓ subject synthetic bust"
  );

  const before = await sharp(source).stats();
  const retouched = await retouchPassportSubject(source);
  const after = await sharp(retouched).stats();
  const luma = (stats) =>
    0.2126 * stats.channels[0].mean +
    0.7152 * stats.channels[1].mean +
    0.0722 * stats.channels[2].mean;
  console.log(
    `✓ retouch luma ${luma(before).toFixed(1)} → ${luma(after).toFixed(1)}`
  );

  const geometry = await analyzeSubjectGeometry(retouched);
  if (!geometry) throw new Error("silhouette analysis returned nothing");
  console.log(
    `✓ geometry crown=${geometry.crownY.toFixed(0)} chin=${geometry.chinY.toFixed(0)} ` +
      `head=${geometry.headWidth.toFixed(0)}x${geometry.headHeight.toFixed(0)}`
  );

  const rect = computePassportFraming(geometry, 30 / 40);
  if (rect) {
    const headRatio = geometry.headHeight / rect.height;
    console.log(
      `✓ framing 3x4 rect=${rect.width}x${rect.height} headRatio=${headRatio.toFixed(2)}`
    );
    if (headRatio < 0.35 || headRatio > 0.58) {
      throw new Error(
        `head ratio ${headRatio.toFixed(2)} outside pas foto bust range`
      );
    }
  } else if (subjectPath) {
    // A silhouette that reaches the top edge has no readable crown; the
    // pipeline is expected to fall back to a centre crop.
    console.log("⚠ framing unavailable — centre-crop fallback");
  } else {
    throw new Error("framing returned nothing for the synthetic bust");
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "passport-smoke-"));
  const subjectFile = path.join(dir, "subject.png");
  fs.writeFileSync(subjectFile, retouched);

  for (const sizeId of ["2x3", "3x4", "4x6"]) {
    const pngPath = path.join(dir, `passport-${sizeId}.png`);
    const jpgPath = path.join(dir, `passport-${sizeId}-print.jpg`);
    const result = await compositePassportPhoto({
      subjectPath: subjectFile,
      outputPath: pngPath,
      jpegPath: jpgPath,
      backgroundColor: "#438CCB",
      sizeId,
      geometry,
    });

    const png = await sharp(pngPath).metadata();
    const jpg = await sharp(jpgPath).metadata();
    if (png.density !== PASSPORT_DPI || jpg.density !== PASSPORT_DPI) {
      throw new Error(
        `${sizeId} density png=${png.density} jpg=${jpg.density}, expected ${PASSPORT_DPI}`
      );
    }
    if (!result.framed && !subjectPath) {
      throw new Error(`${sizeId} fell back to centre crop`);
    }
    console.log(
      `✓ ${sizeId} ${png.width}x${png.height} @${png.density}dpi ` +
        `png=${fs.statSync(pngPath).size}B jpg=${fs.statSync(jpgPath).size}B`
    );
  }

  console.log(`\n📂 output ${dir}`);
  console.log("\n✅ Pas foto quality smoke passed.\n");
}

run().catch((err) => {
  console.error("\n❌ Pas foto quality smoke failed:", err.message);
  process.exit(1);
});
