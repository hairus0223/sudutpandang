/**
 * Generate bundled theme PNG assets (all categories, one category, or event-only).
 *
 * Usage:
 *   npm run generate:theme-assets
 *   node scripts/generate-theme-assets.js --category world-cup-2026
 *   node scripts/generate-theme-assets.js --event
 */
import { generateThemeAssets } from "../services/themeAssetGeneration.js";

function parseArgs(argv) {
  /** @type {{ categoryId?: string, eventOnly: boolean }} */
  const args = { eventOnly: false };

  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--category" && argv[i + 1]) {
      args.categoryId = argv[i + 1];
      i += 1;
      continue;
    }
    if (argv[i] === "--event") {
      args.eventOnly = true;
    }
  }

  if (args.categoryId && args.eventOnly) {
    throw new Error("Use either --category <id> or --event, not both.");
  }

  return args;
}

async function main() {
  const options = parseArgs(process.argv);
  const batches = await generateThemeAssets(options);

  for (const batch of batches) {
    console.log(`\n[${batch.label}] → ${batch.outputDir}`);

    for (const result of batch.results) {
      if (result.skipped) {
        console.warn(`  skip ${result.themeId} (${result.reason})`);
        continue;
      }

      console.log(
        `  ✓ ${result.filename} (${Math.round(result.bytes / 1024)} KB)`
      );
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Theme asset generation failed:", err.message || err);
  process.exit(1);
});
