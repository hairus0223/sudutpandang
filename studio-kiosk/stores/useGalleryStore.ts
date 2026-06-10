import { PRINT_TEMPLATES, PrintTemplate } from "@/lib/printTemplates";
import type { PhotoSizePreset } from "@/lib/photoSizes";
import {
  DEFAULT_SHEET_LAYOUT_ID,
  getSheetLayoutPreset,
  type SheetLayoutPreset,
} from "@/lib/sheetLayouts";
import type { GalleryImageData, PackageType } from "@/lib/imageTypes";
import { FaceBox } from "@/utils/faceDetect";
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

    setImages: (images: ImageData[]) => void;
    setAllowedPrint: (n: number) => void;
    setPackageType: (packageType: PackageType) => void;
    togglePrint: (filename: string) => void;
    resetSelection: () => void;
    reset: () => void;

    printTemplate: PrintTemplate;
    setPrintTemplate: (tpl: PrintTemplate) => void;

    printMode: PrintMode;
    setPrintMode: (mode: PrintMode) => void;
    sheetLayout: SheetLayoutPreset;
    setSheetLayout: (layout: SheetLayoutPreset) => void;
    selectedPaperId: string;
    setSelectedPaperId: (paperId: string) => void;
    customPhotoSize: PhotoSizePreset | null;
    setCustomPhotoSize: (photo: PhotoSizePreset | null) => void;
    sheetCopies: number;
    setSheetCopies: (copies: number) => void;
    showCutLines: boolean;
    setShowCutLines: (show: boolean) => void;

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

    setImages: (images) => set({ images }),
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
        }),

    printTemplate:
        PRINT_TEMPLATES.find((t) => t.id === "4R") ?? PRINT_TEMPLATES[0],

    setPrintTemplate: (tpl) => set({ printTemplate: tpl }),

    printMode: "classic",
    setPrintMode: (printMode) => set({ printMode }),
    sheetLayout: getSheetLayoutPreset(DEFAULT_SHEET_LAYOUT_ID),
    setSheetLayout: (sheetLayout) => set({ sheetLayout }),
    selectedPaperId: "A4",
    setSelectedPaperId: (selectedPaperId) => set({ selectedPaperId }),
    customPhotoSize: null,
    setCustomPhotoSize: (customPhotoSize) => set({ customPhotoSize }),
    sheetCopies: 1,
    setSheetCopies: (sheetCopies) =>
      set({ sheetCopies: Math.max(1, Math.min(10, sheetCopies)) }),
    showCutLines: true,
    setShowCutLines: (showCutLines) => set({ showCutLines }),

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
