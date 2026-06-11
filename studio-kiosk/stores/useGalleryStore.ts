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
import { create } from "zustand";

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
    activeAdjustMeta: {
        slotIndex: number;
        filename: string;
        sizeKey: string;
        label: string;
    } | null;
    setActiveAdjustSlotIndex: (slotIndex: number | null) => void;
    setActiveAdjustMeta: (
        meta: {
            slotIndex: number;
            filename: string;
            sizeKey: string;
            label: string;
        } | null
    ) => void;
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

    resetSelection: () => set({ selectedForPrint: [] }),
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
    setActiveAdjustSlotIndex: (activeAdjustSlotIndex) =>
        set({ activeAdjustSlotIndex }),
    setActiveAdjustMeta: (activeAdjustMeta) => set({ activeAdjustMeta }),

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
