import { PRINT_TEMPLATES, PrintTemplate } from "@/lib/printTemplates";
import {
  createDefaultSheetRecipe,
  type SheetRecipe,
} from "@/lib/sheetRecipe";
import type { GalleryImageData, PackageType } from "@/lib/imageTypes";
import { FaceBox } from "@/utils/faceDetect";
import type { SheetBindingMode } from "@/lib/sheetSlotBinding";
import type { SheetGridAlign } from "@/utils/sheetLayoutEngine";
import { buildSlotTransformKey } from "@/lib/slotTransformKey";
import {
  loadSheetSlotTransforms,
  saveSheetSlotTransforms,
} from "@/lib/transformPersistence";
import { getPaperPreset, type PaperMarginsMm } from "@/lib/paperSizes";
import {
  loadStudioPaperMargins,
  saveStudioPaperMargins,
} from "@/lib/paperMarginStorage";
import { clampMarginMm, clampMargins } from "@/lib/resolvePaper";
import {
  nextSlotSelection,
  pruneSlotIndices,
  type SlotSelectionModifiers,
} from "@/lib/sheetAdjustSelection";
import type { SheetAdjustMeta } from "@/lib/sheetAdjustMeta";
import { create } from "zustand";

function initialSheetPaperMargins(): PaperMarginsMm {
  return (
    loadStudioPaperMargins() ??
    getPaperPreset("A4").marginMm
  );
}

/* ================= TYPES ================= */

export type ImageData = GalleryImageData;

export type PhotoFilter =
  | "none"
  | "soft"
  | "bw"
  | "vintage"
  | "cinematic"
  | "warm"
  | "cool"
  | "drama";

export type PrintMode = "classic" | "sheet";

export type PhotoTransform = {
    scale: number;
    offsetX: number;
    offsetY: number;
    filter?: PhotoFilter;
    intensity?: number;
};

/* ================= STORE ================= */

type GalleryStore = {
    images: ImageData[];
    selectedForPrint: string[];
    allowedPrint: number;
    packageType: PackageType;
    galleryUser: string | null;

    setImages: (images: ImageData[]) => void;
    setGalleryUser: (user: string | null) => void;
    setAllowedPrint: (n: number) => void;
    setPackageType: (packageType: PackageType) => void;
    togglePrint: (filename: string) => void;
    resetSelection: () => void;
    reset: () => void;

    printTemplate: PrintTemplate;
    setPrintTemplate: (tpl: PrintTemplate) => void;

    printMode: PrintMode;
    setPrintMode: (mode: PrintMode) => void;
    sheetRecipe: SheetRecipe;
    setSheetRecipe: (
      recipe: SheetRecipe | ((prev: SheetRecipe) => SheetRecipe)
    ) => void;
    sheetCopies: number;
    setSheetCopies: (copies: number) => void;
    sheetAlign: SheetGridAlign;
    setSheetAlign: (align: SheetGridAlign) => void;
    sheetPaperMargins: PaperMarginsMm;
    sheetMarginUniform: boolean;
    setSheetPaperMargins: (margins: PaperMarginsMm) => void;
    setSheetPaperMarginSide: (
        side: keyof PaperMarginsMm,
        valueMm: number
    ) => void;
    setSheetPaperMarginsUniform: (valueMm: number) => void;
    resetSheetPaperMargins: () => void;
    setSheetMarginUniform: (uniform: boolean) => void;
    showCutLines: boolean;
    setShowCutLines: (show: boolean) => void;
    sheetBindingMode: SheetBindingMode;
    setSheetBindingMode: (mode: SheetBindingMode) => void;
    sheetSizeAssignments: Record<string, string>;
    setSheetSizeAssignment: (sizeKey: string, filename: string) => void;
    sheetSlotAssignments: Record<number, string>;
    setSheetSlotAssignment: (slotIndex: number, filename: string) => void;
    sheetAssignImageFilename: string | null;
    setSheetAssignImageFilename: (filename: string | null) => void;
    sheetSlotTransforms: Record<string, PhotoTransform>;
    activeAdjustSlotIndex: number | null;
    activeAdjustMeta: SheetAdjustMeta | null;
    selectedAdjustSlotIndices: number[];
    setActiveAdjustSlotIndex: (slotIndex: number | null) => void;
    setActiveAdjustMeta: (meta: SheetAdjustMeta | null) => void;
    setAdjustSlotSelection: (
        indices: number[],
        primaryIndex: number,
        meta: SheetAdjustMeta | null
    ) => void;
    adjustSlotSelection: (
        clickedIndex: number,
        slotCount: number,
        meta: SheetAdjustMeta | null,
        modifiers?: SlotSelectionModifiers
    ) => void;
    selectAllAdjustSlots: (slotCount: number) => void;
    clearAdjustSlotSelection: () => void;
    pruneAdjustSlotSelection: (slotCount: number) => void;
    getSheetSlotTransform: (
        filename: string,
        sizeKey: string,
        slotIndex: number
    ) => PhotoTransform;
    setSheetSlotTransform: (
        filename: string,
        sizeKey: string,
        slotIndex: number,
        patch: Partial<PhotoTransform>
    ) => void;
    resetSheetSlotTransform: (
        filename: string,
        sizeKey: string,
        slotIndex: number
    ) => void;
    loadPersistedSheetTransforms: (user: string) => void;
    persistSheetTransforms: () => void;

    photoTransforms: Record<string, PhotoTransform>;
    setPhotoTransform: (
        filename: string,
        patch: Partial<PhotoTransform>
    ) => void;

    faceBoxes: Record<string, FaceBox[]>;
    setFaceBoxes: (filename: string, boxes: FaceBox[]) => void;

    resetTransform: (filename: string) => void;
};

export const useGalleryStore = create<GalleryStore>((set, get) => ({
    images: [],
    selectedForPrint: [],
    allowedPrint: 0,
    packageType: "self-photo",
    galleryUser: null,

    setImages: (images) => set({ images }),
    setGalleryUser: (galleryUser) => set({ galleryUser }),
    setAllowedPrint: (n) => set({ allowedPrint: n }),
    setPackageType: (packageType) => set({ packageType }),

    togglePrint: (filename) => {
        const { selectedForPrint, allowedPrint } = get();

        if (selectedForPrint.includes(filename)) {
            set({
                selectedForPrint: selectedForPrint.filter((f) => f !== filename),
            });
            return;
        }

        if (selectedForPrint.length >= allowedPrint) {
            alert(`Maksimal ${allowedPrint} foto`);
            return;
        }

        set({ selectedForPrint: [...selectedForPrint, filename] });
    },

    resetSelection: () =>
        set({
            selectedForPrint: [],
            selectedAdjustSlotIndices: [],
            activeAdjustSlotIndex: null,
            activeAdjustMeta: null,
        }),
    reset: () =>
        set({
            images: [],
            selectedForPrint: [],
            allowedPrint: 0,
            packageType: "self-photo",
            galleryUser: null,
            sheetSlotTransforms: {},
            activeAdjustSlotIndex: null,
            activeAdjustMeta: null,
            selectedAdjustSlotIndices: [],
        }),

    printTemplate:
        PRINT_TEMPLATES.find((t) => t.id === "4R") ?? PRINT_TEMPLATES[0],

    setPrintTemplate: (tpl) => set({ printTemplate: tpl }),

    printMode: "classic",
    setPrintMode: (printMode) => set({ printMode }),
    sheetRecipe: createDefaultSheetRecipe(),
    setSheetRecipe: (recipe) =>
      set((state) => ({
        sheetRecipe:
          typeof recipe === "function" ? recipe(state.sheetRecipe) : recipe,
      })),
    sheetCopies: 1,
    setSheetCopies: (sheetCopies) =>
      set({ sheetCopies: Math.max(1, Math.min(10, sheetCopies)) }),
    sheetAlign: "top-left",
    setSheetAlign: (sheetAlign) => set({ sheetAlign }),
    sheetPaperMargins: initialSheetPaperMargins(),
    sheetMarginUniform: true,
    setSheetPaperMargins: (margins) => {
        const next = clampMargins(margins);
        saveStudioPaperMargins(next);
        set({ sheetPaperMargins: next });
    },
    setSheetPaperMarginSide: (side, valueMm) => {
        const clamped = clampMarginMm(valueMm);
        set((state) => {
            const next = state.sheetMarginUniform
                ? {
                      top: clamped,
                      right: clamped,
                      bottom: clamped,
                      left: clamped,
                  }
                : { ...state.sheetPaperMargins, [side]: clamped };
            const resolved = clampMargins(next);
            saveStudioPaperMargins(resolved);
            return { sheetPaperMargins: resolved };
        });
    },
    setSheetPaperMarginsUniform: (valueMm) => {
        const clamped = clampMarginMm(valueMm);
        const next = {
            top: clamped,
            right: clamped,
            bottom: clamped,
            left: clamped,
        };
        saveStudioPaperMargins(next);
        set({ sheetPaperMargins: next, sheetMarginUniform: true });
    },
    resetSheetPaperMargins: () => {
        const next = getPaperPreset(get().sheetRecipe.paperId).marginMm;
        saveStudioPaperMargins(next);
        set({ sheetPaperMargins: next, sheetMarginUniform: true });
    },
    setSheetMarginUniform: (sheetMarginUniform) => set({ sheetMarginUniform }),
    showCutLines: true,
    setShowCutLines: (showCutLines) => set({ showCutLines }),
    sheetBindingMode: "cycle",
    setSheetBindingMode: (sheetBindingMode) => set({ sheetBindingMode }),
    sheetSizeAssignments: {},
    setSheetSizeAssignment: (sizeKey, filename) =>
        set((state) => ({
            sheetSizeAssignments: {
                ...state.sheetSizeAssignments,
                [sizeKey]: filename,
            },
        })),
    sheetSlotAssignments: {},
    setSheetSlotAssignment: (slotIndex, filename) =>
        set((state) => ({
            sheetSlotAssignments: {
                ...state.sheetSlotAssignments,
                [slotIndex]: filename,
            },
        })),
    sheetAssignImageFilename: null,
    setSheetAssignImageFilename: (sheetAssignImageFilename) =>
        set({ sheetAssignImageFilename }),
    sheetSlotTransforms: {},
    activeAdjustSlotIndex: null,
    activeAdjustMeta: null,
    selectedAdjustSlotIndices: [],
    setActiveAdjustSlotIndex: (activeAdjustSlotIndex) =>
        set({ activeAdjustSlotIndex }),
    setActiveAdjustMeta: (activeAdjustMeta) => set({ activeAdjustMeta }),
    setAdjustSlotSelection: (indices, primaryIndex, meta) => {
        const sorted = [...new Set(indices.filter((i) => i >= 0))].sort(
            (a, b) => a - b
        );
        set({
            selectedAdjustSlotIndices: sorted,
            activeAdjustSlotIndex: primaryIndex,
            activeAdjustMeta: meta,
        });
    },
    adjustSlotSelection: (clickedIndex, slotCount, meta, modifiers = {}) => {
        const { selectedAdjustSlotIndices, activeAdjustSlotIndex } = get();
        const current = selectedAdjustSlotIndices.length
            ? selectedAdjustSlotIndices
            : activeAdjustSlotIndex !== null
              ? [activeAdjustSlotIndex]
              : [];

        const next = nextSlotSelection(
            current,
            clickedIndex,
            activeAdjustSlotIndex,
            slotCount,
            modifiers
        );

        set({
            selectedAdjustSlotIndices: next,
            activeAdjustSlotIndex: clickedIndex,
            activeAdjustMeta: meta,
        });
    },
    selectAllAdjustSlots: (slotCount) => {
        const indices = Array.from({ length: slotCount }, (_, i) => i);
        const { activeAdjustMeta, activeAdjustSlotIndex } = get();
        const primary =
            activeAdjustSlotIndex !== null &&
            activeAdjustSlotIndex < slotCount
                ? activeAdjustSlotIndex
                : 0;

        set({
            selectedAdjustSlotIndices: indices,
            activeAdjustSlotIndex: primary,
            activeAdjustMeta:
                activeAdjustMeta?.slotIndex === primary
                    ? activeAdjustMeta
                    : activeAdjustMeta,
        });
    },
    clearAdjustSlotSelection: () =>
        set({
            selectedAdjustSlotIndices: [],
            activeAdjustSlotIndex: null,
            activeAdjustMeta: null,
        }),
    pruneAdjustSlotSelection: (slotCount) => {
        const { selectedAdjustSlotIndices, activeAdjustSlotIndex, activeAdjustMeta } =
            get();
        const pruned = pruneSlotIndices(selectedAdjustSlotIndices, slotCount);

        if (slotCount === 0) {
            set({
                selectedAdjustSlotIndices: [],
                activeAdjustSlotIndex: null,
                activeAdjustMeta: null,
            });
            return;
        }

        const primary =
            activeAdjustSlotIndex !== null &&
            activeAdjustSlotIndex < slotCount
                ? activeAdjustSlotIndex
                : pruned[0] ?? 0;

        const nextIndices =
            pruned.length > 0
                ? pruned.includes(primary)
                    ? pruned
                    : [...pruned, primary].sort((a, b) => a - b)
                : [primary];

        set({
            selectedAdjustSlotIndices: nextIndices,
            activeAdjustSlotIndex: primary,
            activeAdjustMeta:
                activeAdjustMeta?.slotIndex === primary
                    ? activeAdjustMeta
                    : null,
        });
    },

    getSheetSlotTransform: (filename, sizeKey, slotIndex) => {
        const key = buildSlotTransformKey(filename, sizeKey, slotIndex);
        return (
            get().sheetSlotTransforms[key] ?? {
                scale: 1,
                offsetX: 0,
                offsetY: 0,
                filter: "none",
            }
        );
    },

    setSheetSlotTransform: (filename, sizeKey, slotIndex, patch) =>
        set((state) => {
            const key = buildSlotTransformKey(filename, sizeKey, slotIndex);
            const prev: PhotoTransform = state.sheetSlotTransforms[key] ?? {
                scale: 1,
                offsetX: 0,
                offsetY: 0,
                filter: "none",
            };

            const nextTransforms = {
                ...state.sheetSlotTransforms,
                [key]: { ...prev, ...patch },
            };

            if (state.galleryUser) {
                saveSheetSlotTransforms(state.galleryUser, nextTransforms);
            }

            return { sheetSlotTransforms: nextTransforms };
        }),

    resetSheetSlotTransform: (filename, sizeKey, slotIndex) =>
        set((state) => {
            const key = buildSlotTransformKey(filename, sizeKey, slotIndex);
            const nextTransforms = { ...state.sheetSlotTransforms };
            delete nextTransforms[key];

            if (state.galleryUser) {
                saveSheetSlotTransforms(state.galleryUser, nextTransforms);
            }

            return { sheetSlotTransforms: nextTransforms };
        }),

    loadPersistedSheetTransforms: (user) =>
        set({
            galleryUser: user,
            sheetSlotTransforms: loadSheetSlotTransforms(user),
        }),

    persistSheetTransforms: () => {
        const { galleryUser, sheetSlotTransforms } = get();
        if (!galleryUser) return;
        saveSheetSlotTransforms(galleryUser, sheetSlotTransforms);
    },

    photoTransforms: {},

    setPhotoTransform: (filename, patch) =>
        set((state) => {
            const prev: PhotoTransform = state.photoTransforms[filename] ?? {
                scale: 1,
                offsetX: 0,
                offsetY: 0,
                filter: "none",
            };

            return {
                photoTransforms: {
                    ...state.photoTransforms,
                    [filename]: {
                        ...prev,
                        ...patch,
                    },
                },
            };
        }),

    faceBoxes: {},

    setFaceBoxes: (filename, boxes) =>
        set((state) => ({
            faceBoxes: {
                ...state.faceBoxes,
                [filename]: boxes,
            },
        })),

    resetTransform: (filename) =>
        set((state) => {
            const copy = { ...state.photoTransforms };
            delete copy[filename];
            return { photoTransforms: copy };
        }),
}));
