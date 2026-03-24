import { PRINT_TEMPLATES, PrintTemplate } from "@/lib/printTemplates";
import { FaceBox } from "@/utils/faceDetect";
import { create } from "zustand";

/* ================= TYPES ================= */

export type ImageData = {
    filename: string;
    url: string;
};

export type PhotoFilter =
  | "none"
  | "soft"
  | "bw"
  | "vintage"
  | "cinematic"
  | "warm"
  | "cool"
  | "drama";

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

    setImages: (images: ImageData[]) => void;
    setAllowedPrint: (n: number) => void;
    togglePrint: (filename: string) => void;
    resetSelection: () => void;
    reset: () => void;

    printTemplate: PrintTemplate;
    setPrintTemplate: (tpl: PrintTemplate) => void;

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

    setImages: (images) => set({ images }),
    setAllowedPrint: (n) => set({ allowedPrint: n }),

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
    reset: () => set({ images: [], selectedForPrint: [], allowedPrint: 0 }),

    printTemplate:
        PRINT_TEMPLATES.find((t) => t.id === "4R") ?? PRINT_TEMPLATES[0],

    setPrintTemplate: (tpl) => set({ printTemplate: tpl }),

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
