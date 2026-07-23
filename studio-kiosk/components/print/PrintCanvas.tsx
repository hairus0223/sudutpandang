"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useGalleryStore, PhotoTransform } from "@/stores/useGalleryStore";
import { chunkPhotos } from "@/utils/printChunk";
import { draw4RLayout } from "./canvas/draw4Rlayout";
import type { PrintTemplate } from "@/lib/printTemplates";
import { loadBrandingLogo } from "@/utils/loadBrandingLogo";
import { useCanvasPanZoomPro } from "@/stores/useCanvasPanZoom";
import { autoCenterTransform } from "@/utils/autoCenterPreset";
import { autoCenterFromFaces } from "@/utils/autoCenterFromFaces";
import { detectFaces } from "@/utils/faceDetect";
import { drawFull4RLayout } from "./canvas/drawFull4RLayout";
import { drawSheetLayout } from "./canvas/drawSheetLayout";
import type { SheetRecipe } from "@/lib/sheetRecipe";
import { countRecipeSlots } from "@/lib/sheetRecipe";
import { useResolvedSheetPaper } from "@/hooks/useResolvedSheetPaper";
import { buildAdjustMetaForSlot } from "@/lib/sheetAdjustMeta";
import { getSlotSizeKey, resolveSlotImage } from "@/lib/sheetSlotBinding";
import { buildSlotTransformKey } from "@/lib/slotTransformKey";
import { buildSheetSlotDraws } from "@/utils/sheetRender";
import { packSheetRecipe } from "@/utils/sheetLayoutEngine";
import type { ImageData } from "@/stores/useGalleryStore";
import { PrintPreviewChrome } from "./PrintPreviewChrome";
import { PrintPageStrip } from "./editor/PrintPageStrip";

const SHEET_DISPLAY_MAX_WIDTH = 920;

export function PrintCanvas({ images, isPrintMode = false }: { images: ImageData[]; isPrintMode?: boolean }) {
    const printTemplate = useGalleryStore((s) => s.printTemplate);
    const printMode = useGalleryStore((s) => s.printMode);
    const sheetRecipe = useGalleryStore((s) => s.sheetRecipe);

    const chunkSize = printTemplate.id === "4R_FULL" ? 1 : 2;
    const pages = useMemo(
        () => chunkPhotos(images, chunkSize),
        [images, chunkSize]
    );

    if (printMode === "sheet") {
        if (!images.length) {
            return (
                <p className="text-center text-sm text-white/70">
                    Pilih minimal 1 foto untuk preview lembar.
                </p>
            );
        }

        return (
            <SheetCanvasPage
                images={images}
                recipe={sheetRecipe}
                isPrintMode={isPrintMode}
            />
        );
    }

    return (
        <div className="flex w-full flex-col gap-5 sm:gap-6">
            <PrintPageStrip pageCount={pages.length} />
            {pages.map((page, index) => (
                <div
                    key={page.map((p) => p.filename).join("|")}
                    id={`print-page-${index}`}
                    className="scroll-mt-3 w-full"
                >
                    <CanvasPage
                        images={page}
                        template={printTemplate}
                        isPrintMode={isPrintMode}
                        pageIndex={index}
                        pageCount={pages.length}
                        compact={index > 0 && pages.length > 1}
                    />
                </div>
            ))}
        </div>
    );
}

/* ============================================================
 * CANVAS PAGE
 * ============================================================ */
function CanvasPage({
    images,
    template,
    isPrintMode = false,
    pageIndex = 0,
    pageCount = 1,
    compact = false,
}: {
    images: ImageData[];
    template: PrintTemplate;
    isPrintMode?: boolean;
    pageIndex?: number;
    pageCount?: number;
    compact?: boolean;
}) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const imageCacheRef = useRef<
        { filename: string; img: HTMLImageElement }[]
    >([]);

    const activeImageRef = useRef<HTMLImageElement | null>(null);

    const activeSlotRectRef = useRef<{
        x: number;
        y: number;
        w: number;
        h: number;
    } | null>(null);

    const transformRef = useRef<PhotoTransform>({
        scale: 1,
        offsetX: 0,
        offsetY: 0,
    });

    const autoCenteredRef = useRef(new Set<string>());

    const photoTransforms = useGalleryStore((s) => s.photoTransforms);
    const faceBoxes = useGalleryStore((s) => s.faceBoxes);
    const setPhotoTransform = useGalleryStore((s) => s.setPhotoTransform);
    const setFaceBoxes = useGalleryStore((s) => s.setFaceBoxes);
    const resetTransform = useGalleryStore((s) => s.resetTransform);

    const imageLoadKey = useMemo(
        () => images.map((img) => img.filename).join("|"),
        [images]
    );

    const [imagesReady, setImagesReady] = useState(false);

    const [activeFilename, setActiveFilename] = useState<string | null>(
        images[0]?.filename ?? null
    );

    const isFull = template.id === "4R_FULL";

    useEffect(() => {
        autoCenteredRef.current.clear();
        setImagesReady(false);
    }, [imageLoadKey, template.id]);

    /* ================= INIT CANVAS (ANTI BLINK) ================= */
    useEffect(() => {
        if (!canvasRef.current) return;
        canvasRef.current.width = template.width;
        canvasRef.current.height = template.height;
    }, [template.width, template.height]);

    /* ================= SLOT GEOMETRY ================= */
    const pad = 0;
    const gap = isFull ? 0 : 70;
    const footerHeight = isFull ? 0 : 130;

    const slotWidth = isFull
        ? template.width
        : (template.width - gap) / 2;

    const slotHeight = isFull
        ? template.height
        : template.height - footerHeight;


    const getSlotByPoint = (x: number, y: number) => {
        if (isFull) {
            return {
                filename: images[0].filename,
                x: 0,
                y: 0,
                w: slotWidth,
                h: slotHeight,
            };
        }

        return images
            .map((img, i) => ({
                filename: img.filename,
                x: pad + i * (slotWidth + gap),
                y: pad,
                w: slotWidth,
                h: slotHeight,
            }))
            .find(
                (s) =>
                    x >= s.x &&
                    x <= s.x + s.w &&
                    y >= s.y &&
                    y <= s.y + s.h
            );
    };


    /* ================= CLAMP PER SLOT ================= */
    const getClampRect = () => {
        const img = activeImageRef.current;
        const rect = activeSlotRectRef.current;

        if (!img || !rect) {
            return { boxW: 0, boxH: 0, imgW: 0, imgH: 0 };
        }

        return {
            boxW: rect.w,
            boxH: rect.h,
            imgW: img.width,
            imgH: img.height,
            offsetX: rect.x,
            offsetY: rect.y,
        };
    };

    /* ================= PAN / ZOOM ================= */
    useEffect(() => {
        if (!canvasRef.current || !activeFilename) return;

        return useCanvasPanZoomPro(
            canvasRef.current,
            () => transformRef.current,
            (patch) => {
                transformRef.current = { ...transformRef.current, ...patch };
                setPhotoTransform(activeFilename, patch);
            },
            getClampRect
        );
    }, [activeFilename]);

    /* ================= SLOT SELECT ================= */
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const onMouseDown = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * template.width;
            const y = ((e.clientY - rect.top) / rect.height) * template.height;

            const slot = getSlotByPoint(x, y);
            if (!slot) return;

            setActiveFilename(slot.filename);

            const stored =
                useGalleryStore.getState().photoTransforms[slot.filename] ?? {
                    scale: 1,
                    offsetX: 0,
                    offsetY: 0,
                };

            transformRef.current = stored;

            activeSlotRectRef.current = {
                x: slot.x,
                y: slot.y,
                w: slot.w,
                h: slot.h,
            };

            const img = imageCacheRef.current.find(
                (i) => i.filename === slot.filename
            );
            if (img) activeImageRef.current = img.img;
        };

        canvas.addEventListener("mousedown", onMouseDown, true);
        return () => canvas.removeEventListener("mousedown", onMouseDown, true);
    }, [images, template.width, template.height, isFull]);

    /* ================= AUTO CENTER (ONCE PER PHOTO) ================= */
    useEffect(() => {
        if (!activeFilename || !imagesReady) return;
        if (autoCenteredRef.current.has(activeFilename)) return;

        const img = imageCacheRef.current.find(
            (i) => i.filename === activeFilename
        );
        if (!img) return;

        autoCenteredRef.current.add(activeFilename);

        const boxW = template.id === "4R_FULL" ? template.width : slotWidth;
        const boxH = template.id === "4R_FULL" ? template.height : slotHeight;

        const existing = useGalleryStore.getState().photoTransforms[activeFilename];
        const auto = autoCenterTransform(
            img.img.width,
            img.img.height,
            boxW,
            boxH,
            "auto"
        );

        const next: PhotoTransform = {
            ...auto,
            filter:
                existing?.filter && existing.filter !== "none"
                    ? existing.filter
                    : "none",
            intensity: existing?.intensity ?? 1,
        };

        transformRef.current = next;
        setPhotoTransform(activeFilename, next);
    }, [activeFilename, imagesReady, imageLoadKey, template.id, slotWidth, slotHeight, setPhotoTransform]);

    /* ================= DRAW ================= */
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        Promise.all([
            ...images.map(
                (img) =>
                    new Promise<{ img: HTMLImageElement; filename: string }>((res) => {
                        const i = new Image();
                        i.crossOrigin = "anonymous";
                        i.src = img.url;
                        i.onload = () => res({ img: i, filename: img.filename });
                    })
            ),
            loadBrandingLogo(),
        ]).then((res) => {
            const loaded = res.slice(0, images.length) as {
                img: HTMLImageElement;
                filename: string;
            }[];

            imageCacheRef.current = loaded;
            setImagesReady(true);

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "#fff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            if (template.id === "4R_FULL") {
                drawFull4RLayout(ctx, loaded[0], photoTransforms, faceBoxes);
            } else {
                draw4RLayout(
                    ctx,
                    loaded,
                    res.at(-1) as HTMLImageElement,
                    photoTransforms,
                    faceBoxes
                );
            }


            // Hanya gambar border kalau bukan mode print
            // draw border aktif hanya kalau !isPrintMode
            if (!isPrintMode && !isFull && activeFilename) {
                const idx = images.findIndex((i) => i.filename === activeFilename);
                if (idx !== -1) {
                    ctx.strokeStyle = "#2563eb";
                    ctx.lineWidth = 4;
                    ctx.strokeRect(
                        pad + idx * (slotWidth + gap),
                        pad,
                        slotWidth,
                        slotHeight
                    );
                }
            }

        });
    }, [
        images,
        photoTransforms,
        faceBoxes,
        activeFilename,
        isPrintMode,
        template,
        isFull,
        slotWidth,
        slotHeight,
        gap,
        pad,
    ]);

    /* ================= FACE DETECT (ONCE PER IMAGE) ================= */
    useEffect(() => {
        if (!activeFilename || !imagesReady) return;
        if (useGalleryStore.getState().faceBoxes[activeFilename]) return;

        const img = imageCacheRef.current.find(
            (i) => i.filename === activeFilename
        )?.img;

        if (!img) return;

        detectFaces(img).then((faces) => {
            setFaceBoxes(activeFilename, faces);
        });
    }, [activeFilename, imagesReady, setFaceBoxes]);

    const handleResetActive = () => {
        if (!activeFilename) return;

        autoCenteredRef.current.delete(activeFilename);
        resetTransform(activeFilename);

        const img = imageCacheRef.current.find(
            (i) => i.filename === activeFilename
        );
        if (!img) {
            transformRef.current = { scale: 1, offsetX: 0, offsetY: 0 };
            return;
        }

        const boxW = template.id === "4R_FULL" ? template.width : slotWidth;
        const boxH = template.id === "4R_FULL" ? template.height : slotHeight;
        const auto = autoCenterTransform(
            img.img.width,
            img.img.height,
            boxW,
            boxH,
            "auto"
        );

        transformRef.current = auto;
        setPhotoTransform(activeFilename, auto);
        autoCenteredRef.current.add(activeFilename);
    };

    const activeLabel = activeFilename
        ? `Foto aktif · ${activeFilename.replace(/\.[^.]+$/, "")}`
        : null;

    return (
        <PrintPreviewChrome
            pageLabel={
                pageCount > 1 ? `Halaman ${pageIndex + 1} / ${pageCount}` : undefined
            }
            activeLabel={!isPrintMode ? activeLabel : null}
            hint={
                compact
                    ? undefined
                    : isFull
                      ? "Sesuaikan crop foto full 4R sebelum cetak."
                      : "Klik salah satu slot foto untuk memilih, lalu atur posisi dan zoom."
            }
            onReset={!isPrintMode && activeFilename ? handleResetActive : undefined}
            showControls={!isPrintMode}
            compact={compact}
        >
            <canvas
                ref={canvasRef}
                className="max-w-full bg-white shadow-lg ring-1 ring-black/10"
                style={{
                    width: template.width * 0.5,
                    height: template.height * 0.5,
                    cursor: "grab",
                }}
            />
        </PrintPreviewChrome>
    );
}

/* ============================================================
 * SHEET CANVAS (A4 multi-slot preview)
 * ============================================================ */
function SheetCanvasPage({
    images,
    recipe,
    isPrintMode = false,
}: {
    images: ImageData[];
    recipe: SheetRecipe;
    isPrintMode?: boolean;
}) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const imageCacheRef = useRef<{ filename: string; img: HTMLImageElement }[]>([]);
    const activeImageRef = useRef<HTMLImageElement | null>(null);
    const transformRef = useRef<PhotoTransform>({
        scale: 1,
        offsetX: 0,
        offsetY: 0,
    });
    const activeSlotRef = useRef<{
        x: number;
        y: number;
        w: number;
        h: number;
    } | null>(null);

    const {
        photoTransforms,
        faceBoxes,
        setFaceBoxes,
        showCutLines,
        sheetAlign,
        sheetBindingMode,
        sheetSizeAssignments,
        sheetSlotAssignments,
        setSheetSlotAssignment,
        sheetAssignImageFilename,
        sheetSlotTransforms,
        getSheetSlotTransform,
        setSheetSlotTransform,
        adjustSlotSelection,
        setAdjustSlotSelection,
        pruneAdjustSlotSelection,
        activeAdjustSlotIndex,
        selectedAdjustSlotIndices,
        packageType,
    } = useGalleryStore();

    const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(0);
    const [sheetImagesReady, setSheetImagesReady] = useState(false);
    const resolvedPaper = useResolvedSheetPaper();

    const sheetImageKey = useMemo(
        () => images.map((img) => img.filename).join("|"),
        [images]
    );

    const bindingOptions = useMemo(
        () => ({
            bindingMode: sheetBindingMode,
            sizeAssignments: sheetSizeAssignments,
            slotAssignments: sheetSlotAssignments,
        }),
        [sheetBindingMode, sheetSizeAssignments, sheetSlotAssignments]
    );

    const geometry = useMemo(
        () => packSheetRecipe(recipe, resolvedPaper, sheetAlign),
        [recipe, resolvedPaper, sheetAlign]
    );

    const readSlotTransform = (
        filename: string,
        sizeKey: string,
        slotIndex: number
    ) => {
        const key = buildSlotTransformKey(filename, sizeKey, slotIndex);
        return (
            sheetSlotTransforms[key] ??
            getSheetSlotTransform(filename, sizeKey, slotIndex)
        );
    };

    const selectSlotAt = (slotIndex: number, e?: MouseEvent) => {
        const meta = buildAdjustMetaForSlot(
            slotIndex,
            geometry.slots,
            images,
            bindingOptions
        );
        if (!meta) return;

        adjustSlotSelection(slotIndex, geometry.slots.length, meta, {
            shiftKey: e?.shiftKey,
            additive: e?.ctrlKey || e?.metaKey,
        });

        const slot = geometry.slots[slotIndex];
        if (!slot) return;

        setActiveSlotIndex(slotIndex);
        activeSlotRef.current = {
            x: slot.x,
            y: slot.y,
            w: slot.w,
            h: slot.h,
        };

        transformRef.current = readSlotTransform(
            meta.filename,
            meta.sizeKey,
            slotIndex
        );

        const cached = imageCacheRef.current.find(
            (entry) => entry.filename === meta.filename
        );
        if (cached) activeImageRef.current = cached.img;
    };
    const displayScale = SHEET_DISPLAY_MAX_WIDTH / geometry.paperWidthPx;
    const autoCenteredRef = useRef(new Set<string>());

    const resolveImageForSlot = (slotIndex: number) => {
        const slot = geometry.slots[slotIndex];
        if (!slot) return images[0];

        return resolveSlotImage({
            slot,
            slotIndex,
            images,
            mode: sheetBindingMode,
            sizeAssignments: sheetSizeAssignments,
            slotAssignments: sheetSlotAssignments,
            slots: geometry.slots,
        });
    };

    useEffect(() => {
        if (!canvasRef.current) return;
        canvasRef.current.width = geometry.paperWidthPx;
        canvasRef.current.height = geometry.paperHeightPx;
    }, [geometry.paperWidthPx, geometry.paperHeightPx]);

    useEffect(() => {
        autoCenteredRef.current.clear();
        setSheetImagesReady(false);
    }, [recipe.id, recipe.paperId, sheetAlign, sheetImageKey]);

    useEffect(() => {
        pruneAdjustSlotSelection(geometry.slots.length);
    }, [geometry.slots.length, recipe.id, pruneAdjustSlotSelection]);

    useEffect(() => {
        const firstSlot = geometry.slots[0];
        if (!firstSlot) return;

        const nextMeta = buildAdjustMetaForSlot(
            firstSlot.index,
            geometry.slots,
            images,
            bindingOptions
        );
        if (!nextMeta) return;

        activeSlotRef.current = {
            x: firstSlot.x,
            y: firstSlot.y,
            w: firstSlot.w,
            h: firstSlot.h,
        };

        setActiveSlotIndex((prev) =>
            prev === firstSlot.index ? prev : firstSlot.index
        );

        const { selectedAdjustSlotIndices: currentSelection } =
            useGalleryStore.getState();
        if (!currentSelection.length) {
            setAdjustSlotSelection(
                [firstSlot.index],
                firstSlot.index,
                nextMeta
            );
        }

        const cached = imageCacheRef.current.find(
            (entry) => entry.filename === nextMeta.filename
        );
        if (cached) activeImageRef.current = cached.img;

        transformRef.current = readSlotTransform(
            nextMeta.filename,
            nextMeta.sizeKey,
            firstSlot.index
        );
    }, [
        recipe.id,
        recipe.paperId,
        sheetAlign,
        geometry.slots.length,
        images,
        bindingOptions,
        setAdjustSlotSelection,
    ]);

    const getClampRect = () => {
        const img = activeImageRef.current;
        const rect = activeSlotRef.current;
        if (!img || !rect) {
            return { boxW: 0, boxH: 0, imgW: 0, imgH: 0 };
        }

        return {
            boxW: rect.w,
            boxH: rect.h,
            imgW: img.width,
            imgH: img.height,
            offsetX: rect.x,
            offsetY: rect.y,
        };
    };

    useEffect(() => {
        if (!canvasRef.current || activeSlotIndex === null) return;

        const slot = geometry.slots[activeSlotIndex];
        if (!slot) return;

        const slotImage = resolveImageForSlot(activeSlotIndex);
        const sizeKey = getSlotSizeKey(slot);

        return useCanvasPanZoomPro(
            canvasRef.current,
            () => transformRef.current,
            (patch) => {
                transformRef.current = { ...transformRef.current, ...patch };
                setSheetSlotTransform(
                    slotImage.filename,
                    sizeKey,
                    activeSlotIndex,
                    patch
                );
            },
            getClampRect
        );
    }, [activeSlotIndex, recipe.id, geometry.slots.length, images.length]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const onMouseDown = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            const x =
                ((e.clientX - rect.left) / rect.width) * geometry.paperWidthPx;
            const y =
                ((e.clientY - rect.top) / rect.height) * geometry.paperHeightPx;

            const slot = geometry.slots.find(
                (s) =>
                    x >= s.x &&
                    x <= s.x + s.w &&
                    y >= s.y &&
                    y <= s.y + s.h
            );

            if (!slot) return;

            if (
                sheetBindingMode === "manual" &&
                sheetAssignImageFilename
            ) {
                setSheetSlotAssignment(slot.index, sheetAssignImageFilename);
            }

            selectSlotAt(slot.index, e);
        };

        canvas.addEventListener("mousedown", onMouseDown, true);
        return () => canvas.removeEventListener("mousedown", onMouseDown, true);
    }, [
        geometry,
        images,
        sheetSlotTransforms,
        sheetBindingMode,
        sheetAssignImageFilename,
        sheetSizeAssignments,
        sheetSlotAssignments,
        bindingOptions,
        adjustSlotSelection,
    ]);

    useEffect(() => {
        if (activeAdjustSlotIndex === null) return;

        const slot = geometry.slots[activeAdjustSlotIndex];
        if (!slot) return;

        const slotImage = resolveImageForSlot(activeAdjustSlotIndex);
        const sizeKey = getSlotSizeKey(slot);

        setActiveSlotIndex((prev) =>
            prev === activeAdjustSlotIndex ? prev : activeAdjustSlotIndex
        );
        activeSlotRef.current = {
            x: slot.x,
            y: slot.y,
            w: slot.w,
            h: slot.h,
        };
        transformRef.current = readSlotTransform(
            slotImage.filename,
            sizeKey,
            activeAdjustSlotIndex
        );

        const cached = imageCacheRef.current.find(
            (entry) => entry.filename === slotImage.filename
        );
        if (cached) activeImageRef.current = cached.img;
    }, [
        activeAdjustSlotIndex,
        geometry.slots,
        images,
        sheetBindingMode,
        sheetSizeAssignments,
        sheetSlotAssignments,
        sheetSlotTransforms,
    ]);

    useEffect(() => {
        if (!sheetImagesReady) return;

        const persistedTransforms = useGalleryStore.getState().sheetSlotTransforms;

        geometry.slots.forEach((slot) => {
            const imgData = resolveImageForSlot(slot.index);
            const sizeKey = getSlotSizeKey(slot);
            const transformKey = buildSlotTransformKey(
                imgData.filename,
                sizeKey,
                slot.index
            );

            if (
                autoCenteredRef.current.has(transformKey) ||
                persistedTransforms[transformKey]
            ) {
                autoCenteredRef.current.add(transformKey);
                return;
            }

            const cached = imageCacheRef.current.find(
                (entry) => entry.filename === imgData.filename
            );
            if (!cached?.img) return;

            const faces = faceBoxes[imgData.filename] ?? [];
            const auto = autoCenterFromFaces(
                cached.img.width,
                cached.img.height,
                slot.w,
                slot.h,
                faces
            );

            if (slot.index === activeSlotIndex) {
                transformRef.current = auto;
            }
            setSheetSlotTransform(
                imgData.filename,
                sizeKey,
                slot.index,
                auto
            );
            autoCenteredRef.current.add(transformKey);
        });
    }, [
        sheetImagesReady,
        images,
        recipe.id,
        geometry.slots.length,
        sheetBindingMode,
        sheetSizeAssignments,
        sheetSlotAssignments,
        faceBoxes,
        activeSlotIndex,
        setSheetSlotTransform,
    ]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        Promise.all(
            images.map(
                (imgData) =>
                    new Promise<{ filename: string; img: HTMLImageElement }>((res) => {
                        const img = new Image();
                        img.crossOrigin = "anonymous";
                        img.src = imgData.url;
                        img.onload = () => res({ filename: imgData.filename, img });
                    })
            )
        ).then((loaded) => {
            imageCacheRef.current = loaded;
            setSheetImagesReady(true);

            const slotDraws = buildSheetSlotDraws({
                geometry,
                images,
                loaded,
                bindingMode: sheetBindingMode,
                sizeAssignments: sheetSizeAssignments,
                slotAssignments: sheetSlotAssignments,
                photoTransforms,
                sheetSlotTransforms,
                faceBoxes,
            });

            drawSheetLayout(ctx, {
                slots: geometry.slots,
                slotDraws,
                showCutLines: showCutLines && !isPrintMode,
                primarySlotIndex: isPrintMode ? null : activeSlotIndex,
                selectedSlotIndices: isPrintMode
                    ? []
                    : selectedAdjustSlotIndices.length
                      ? selectedAdjustSlotIndices
                      : activeSlotIndex !== null
                        ? [activeSlotIndex]
                        : [],
                showPassportGuide: false,
                printableArea: geometry.printableArea,
                showPrintableGuide: !isPrintMode,
            });
        });
    }, [
        images,
        geometry,
        photoTransforms,
        sheetSlotTransforms,
        faceBoxes,
        showCutLines,
        activeSlotIndex,
        selectedAdjustSlotIndices,
        isPrintMode,
        recipe.id,
        sheetAlign,
        sheetBindingMode,
        sheetSizeAssignments,
        sheetSlotAssignments,
        packageType,
    ]);

    useEffect(() => {
        if (!sheetImagesReady) return;

        images.forEach((imgData) => {
            if (useGalleryStore.getState().faceBoxes[imgData.filename]) return;

            const cached = imageCacheRef.current.find(
                (entry) => entry.filename === imgData.filename
            );
            if (!cached) return;

            detectFaces(cached.img).then((faces) => {
                setFaceBoxes(imgData.filename, faces);
            });
        });
    }, [sheetImagesReady, images, recipe.id, setFaceBoxes]);

    const bindingHint =
        sheetBindingMode === "manual"
            ? "mode manual · klik slot untuk menempatkan foto"
            : sheetBindingMode === "by-size"
              ? "mode per ukuran"
              : images.length === 1
                ? `bergilir · foto diulang ${geometry.slots.length}×`
                : `bergilir · ${images.length} foto ke ${geometry.slots.length} slot`;

    const activeSlotLabel =
        activeSlotIndex !== null
            ? `Slot ${activeSlotIndex + 1} / ${geometry.slots.length}`
            : null;

    return (
        <PrintPreviewChrome
            pageLabel={`${recipe.label} · ${countRecipeSlots(recipe)} slot`}
            activeLabel={!isPrintMode ? activeSlotLabel : null}
            hint={`${bindingHint} · Ctrl/⌘+klik untuk multi-pilih slot`}
            showControls={!isPrintMode}
        >
            <canvas
                ref={canvasRef}
                className="max-w-full bg-white shadow-lg ring-1 ring-black/10"
                style={{
                    width: geometry.paperWidthPx * displayScale,
                    height: geometry.paperHeightPx * displayScale,
                    cursor: "grab",
                }}
            />
        </PrintPreviewChrome>
    );
}
