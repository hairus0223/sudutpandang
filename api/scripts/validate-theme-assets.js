/**
 * Pre-event checklist: verify bundled theme PNGs exist per category.
 *
 * Usage:
 *   npm run validate:theme-assets
 *   node scripts/validate-theme-assets.js --event
 *   node scripts/validate-theme-assets.js --category world-cup-2026
 */
import { validateThemeAssets } from "../services/themeAssetGeneration.js";

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

  return args;
}

function main() {
  const options = parseArgs(process.argv);
  const report = validateThemeAssets(options);

  console.log("\nTheme asset validation\n");

  for (const category of report.categories) {
    const status = category.assetsReady ? "OK" : "MISSING";
    console.log(
      `[${status}] ${category.label} (${category.categoryId}) — ${category.themeCount - category.missing.length}/${category.themeCount} assets`
    );

    if (category.missing.length > 0) {
      console.log(`       missing: ${category.missing.join(", ")}`);
      console.log(`       dir: ${category.dir}`);
    }
  }

  if (report.ok) {
    console.log("\n✅ All checked theme assets are present.\n");
    return;
  }

  console.error("\n❌ Theme assets incomplete.");
  console.error("   Fix: npm run generate:theme-assets");
  if (options.eventOnly || options.categoryId) {
    console.error(
      `   Or:  node scripts/generate-theme-assets.js${options.categoryId ? ` --category ${options.categoryId}` : " --event"}`
    );
  }
  console.error("");
  process.exit(1);
}

main();
