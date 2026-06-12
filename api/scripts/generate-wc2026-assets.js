/**
 * @deprecated Use: npm run generate:theme-assets -- --category world-cup-2026
 */
import { generateCategoryThemeAssets } from "../services/themeAssetGeneration.js";

generateCategoryThemeAssets("world-cup-2026")
  .then((batch) => {
    console.log(`\n[${batch.label}] → ${batch.outputDir}`);
    for (const result of batch.results) {
      if (result.skipped) {
        console.warn(`Skip ${result.themeId}: ${result.reason}`);
        continue;
      }
      console.log(`✓ ${result.filename} (${Math.round(result.bytes / 1024)} KB)`);
    }
  })
  .catch((err) => {
    console.error("Asset generation failed:", err);
    process.exit(1);
  });
