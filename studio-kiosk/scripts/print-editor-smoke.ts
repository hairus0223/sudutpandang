/**
 * Smoke test — print layout engine, margins, multi-slot selection.
 *
 * Usage (from studio-kiosk/):
 *   npm run smoke-test:print
 */
import { getPaperPreset } from "@/lib/paperSizes";
import { resolvePaperForLayout, clampMarginMm } from "@/lib/resolvePaper";
import {
  createDefaultSheetRecipe,
  countRecipeSlots,
  SHEET_RECIPE_PRESETS,
} from "@/lib/sheetRecipe";
import {
  batchAdjustZoom,
  nextSlotSelection,
  pruneSlotIndices,
} from "@/lib/sheetAdjustSelection";
import {
  packSheetRecipe,
  validateSheetRecipe,
} from "@/utils/sheetLayoutEngine";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assertEq<T>(actual: T, expected: T, message: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${message}\n  expected: ${e}\n  actual:   ${a}`);
}

function run() {
  console.log("\n🔍 Print editor smoke test\n");

  assert(clampMarginMm(-5) === 0, "margin clamp min");
  assert(clampMarginMm(99) === 25, "margin clamp max");

  const basePaper = getPaperPreset("A4");
  const wideMargin = resolvePaperForLayout("A4", {
    top: 15,
    right: 15,
    bottom: 15,
    left: 15,
  });
  assert(wideMargin.marginMm.top === 15, "resolvePaper applies override");

  const recipe = createDefaultSheetRecipe();
  const geoDefault = packSheetRecipe(recipe, basePaper);
  const geoMargin = packSheetRecipe(recipe, wideMargin);

  assert(
    geoMargin.printableArea.w < geoDefault.printableArea.w,
    "larger margin shrinks printable width"
  );
  assert(
    geoMargin.printableArea.h < geoDefault.printableArea.h,
    "larger margin shrinks printable height"
  );
  console.log("✓ margin → printable area geometry");

  const slotCount = countRecipeSlots(recipe);
  assert(geoDefault.slots.length === slotCount, "slot count matches recipe");
  assert(
    geoMargin.slots.length === slotCount,
    "slot count stable across margin changes"
  );
  console.log(`✓ packSheetRecipe slots (${slotCount} slots)`);

  const validationOk = validateSheetRecipe(recipe, basePaper);
  assert(validationOk.fitsVertically, "default recipe fits A4");
  assert(
    validationOk.rows.every((r) => r.fits),
    "default recipe rows fit width"
  );
  console.log("✓ validateSheetRecipe default layout");

  const tightPaper = resolvePaperForLayout("A4", {
    top: 25,
    right: 25,
    bottom: 25,
    left: 25,
  });
  const validationTight = validateSheetRecipe(recipe, tightPaper);
  if (!validationTight.fitsVertically || !validationTight.rows.every((r) => r.fits)) {
    console.log("✓ validateSheetRecipe detects tight margin overflow");
  } else {
    console.log("· tight margin still fits (recipe is small)");
  }

  for (const preset of SHEET_RECIPE_PRESETS) {
    const paper = getPaperPreset(preset.paperId);
    const v = validateSheetRecipe(preset, paper);
    const geo = packSheetRecipe(preset, paper);
    assert(
      geo.slots.length === countRecipeSlots(preset),
      `preset ${preset.id} slot geometry`
    );
    assert(
      v.fitsVertically && v.rows.every((r) => r.fits),
      `preset ${preset.id} must fit paper`
    );
  }
  console.log(`✓ ${SHEET_RECIPE_PRESETS.length} sheet presets fit & pack`);

  assertEq(nextSlotSelection([], 2, null, 8, {}), [2], "single select");
  assertEq(
    nextSlotSelection([1], 3, 1, 8, { shiftKey: true }),
    [1, 2, 3],
    "shift range select"
  );
  assertEq(
    nextSlotSelection([1], 1, 1, 8, { additive: true }),
    [1],
    "toggle off last keeps one"
  );
  assertEq(
    nextSlotSelection([1, 2], 3, 2, 8, { additive: true }),
    [1, 2, 3],
    "additive add"
  );
  assertEq(pruneSlotIndices([0, 2, 99, -1], 4), [0, 2], "prune indices");
  console.log("✓ multi-slot selection helpers");

  const transforms: Record<string, { scale: number; offsetX: number; offsetY: number }> =
    {};
  const key = (f: string, s: string, i: number) => `${f}::${s}::${i}`;

  batchAdjustZoom(
    [
      { slotIndex: 0, filename: "a.jpg", sizeKey: "3x4" },
      { slotIndex: 1, filename: "b.jpg", sizeKey: "3x4" },
    ],
    0.2,
    (f, s, i) => transforms[key(f, s, i)] ?? { scale: 1, offsetX: 0, offsetY: 0 },
    (f, s, i, patch) => {
      const k = key(f, s, i);
      transforms[k] = { ...(transforms[k] ?? { scale: 1, offsetX: 0, offsetY: 0 }), ...patch };
    }
  );
  assert(transforms[key("a.jpg", "3x4", 0)]?.scale === 1.2, "batch zoom slot 0");
  assert(transforms[key("b.jpg", "3x4", 1)]?.scale === 1.2, "batch zoom slot 1");
  console.log("✓ batch zoom transform");

  const exportPaper = resolvePaperForLayout(recipe.paperId, {
    top: 10,
    right: 10,
    bottom: 10,
    left: 10,
  });
  const previewGeo = packSheetRecipe(recipe, exportPaper);
  assert(
    previewGeo.paperWidthPx === geoDefault.paperWidthPx,
    "export paper width matches preview pipeline"
  );
  console.log("✓ preview/export paper dimensions parity");

  console.log("\n✅ Print editor smoke test passed\n");
}

run();
