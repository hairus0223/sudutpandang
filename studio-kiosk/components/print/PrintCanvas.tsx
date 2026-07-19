"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useGalleryStore, PhotoTransform } from "@/stores/useGalleryStore";
import { LOOK_PRINT_INTENSITY, lookIdToPhotoFilter } from "@/lib/lookPresets";
import { chunkPhotos } from "@/utils/printChunk";
import { draw4RLayout } from "./canvas/draw4Rlayout";
import type { PrintTemplate } from "@/lib/printTemplates";
import { loadBrandingLogo } from "@/utils/loadBrandingLogo";
import { useCanvasPanZoomPro } from "@/stores/useCanvasPanZoom";
import { getPhotoSizePreset } from "@/lib/photoSizes";
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

const SHEET_DISPLAY_MAX_WIDTH = 920;

export function PrintCanvas({ images, isPrintMode = false }: { images: ImageData[]; isPrintMode?: boolean }) {
    const { printTemplate, printMode, sheetRecipe } = useGalleryStore();

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

    const chunkSize =
        printTemplate.id === "4R_FULL"
            ? 1
            : 2;

    const pages = chunkPhotos(images, chunkSize);

    return (
        <div className="flex flex-col gap-10">
            {pages.map((page, index) => (
                <CanvasPage key={index} images={page} template={printTemplate} isPrintMode={isPrintMode} />
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
    isPrintMode = false,  // <-- tambahkan prop
}: {
    images: ImageData[];
    template: PrintTemplate;
    isPrintMode?: boolean;
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
    const lookSeededRef = useRef(new Set<string>());

    const { photoTransforms, setPhotoTransform, faceBoxes, setFaceBoxes, sessionLookId } =
        useGalleryStore();

    const [activeFilename, setActiveFilename] = useState<string | null>(
        images[0]?.filename ?? null
    );

    const isFull = template.id === "4R_FULL";

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

            transformRef.current =
                photoTransforms[slot.filename] ?? {
                    scale: 1,
                    offsetX: 0,
                    offsetY: 0,
                };

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
        return () => canvas.removeEventListener("mousedown", onMouseDown);
    }, [images, template, photoTransforms]);

    /* ================= AUTO CENTER (ONCE) ================= */
    useEffect(() => {
        if (!activeFilename) return;

        const existing = photoTransforms[activeFilename];
        const alreadyFramed =
            existing &&
            (Math.abs((existing.scale ?? 1) - 1) > 0.001 ||
                Math.abs(existing.offsetX ?? 0) > 0.5 ||
                Math.abs(existing.offsetY ?? 0) > 0.5);
        if (alreadyFramed) return;

        const img = imageCacheRef.current.find(
            (i) => i.filename === activeFilename
        );
        if (!img) return;

        const boxW = template.id === "4R_FULL" ? template.width : slotWidth;

        const boxH = template.id === "4R_FULL" ? template.height : slotHeight;

        const auto = autoCenterTransform(
            img.img.width,
            img.img.height,
            boxW,
            boxH,
            "auto"
        );

        const lookFilter = lookIdToPhotoFilter(sessionLookId);
        const galleryImage = images.find((i) => i.filename === activeFilename);
        const lookAlreadyBaked = Boolean(
            galleryImage?.bakedLookId && galleryImage?.variants?.themed
        );
        const resolvedLookFilter = lookAlreadyBaked ? "none" : lookFilter;
        const next: PhotoTransform = {
            ...auto,
            filter:
                existing?.filter && existing.filter !== "none"
                    ? existing.filter
                    : resolvedLookFilter,
            intensity:
                existing?.intensity ??
                (resolvedLookFilter !== "none" ? LOOK_PRINT_INTENSITY : 1),
        };

        transformRef.current = next;
        setPhotoTransform(activeFilename, next);
    }, [activeFilename, sessionLookId, images]);

    /* Seed session look onto print slots (does not block auto-center). */
    useEffect(() => {
        lookSeededRef.current = new Set();
    }, [sessionLookId]);

    useEffect(() => {
        if (!sessionLookId || images.length === 0) return;
        const lookFilter = lookIdToPhotoFilter(sessionLookId);
        for (const img of images) {
            if (lookSeededRef.current.has(img.filename)) continue;
            lookSeededRef.current.add(img.filename);
            // Themed AI photos bake look into pixels — avoid double grade.
            if (img.bakedLookId && img.variants?.themed) continue;
            const existing = photoTransforms[img.filename];
            if (existing?.filter && existing.filter !== "none") continue;
            if (lookFilter === "none") continue;
            setPhotoTransform(img.filename, {
                filter: lookFilter,
                intensity: LOOK_PRINT_INTENSITY,
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [images, sessionLookId, setPhotoTransform]);


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

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "#fff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            if (template.id === "4R_FULL") {
                drawFull4RLayout(
                    ctx,
                    loaded[0], // hanya 1 foto
                    photoTransforms,
                    faceBoxes
                );
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
    }, [images, photoTransforms, activeFilename, isPrintMode]);

    /* ================= FACE DETECT (ONCE PER IMAGE) ================= */
    useEffect(() => {
        if (!activeFilename) return;

        // Sudah pernah detect → STOP
        if (faceBoxes[activeFilename]) return;

        const img = imageCacheRef.current.find(
            (i) => i.filename === activeFilename
        )?.img;

        if (!img) return;

        detectFaces(img).then((faces) => {
            setFaceBoxes(activeFilename, faces);
        });
    }, [activeFilename, imageCacheRef.current.length]);


    return (
        <canvas
            ref={canvasRef}
            className="bg-white shadow-xl mx-auto"
            style={{
                width: template.width * 0.5,
                height: template.height * 0.5,
                cursor: "grab",
            }}
        />
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
    const resolvedPaper = useResolvedSheetPaper();

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
    }, [recipe.id, recipe.paperId, sheetAlign]);

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
                sheetSlotTransforms[transformKey]
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
        images,
        recipe.id,
        geometry.slots.length,
        sheetBindingMode,
        sheetSizeAssignments,
        sheetSlotAssignments,
        faceBoxes,
        packageType,
        activeSlotIndex,
        sheetSlotTransforms,
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
                showPassportGuide:
                    packageType === "pas-photo" && !isPrintMode,
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
        images.forEach((imgData) => {
            if (faceBoxes[imgData.filename]) return;

            const cached = imageCacheRef.current.find(
                (entry) => entry.filename === imgData.filename
            );
            if (!cached) return;

            detectFaces(cached.img).then((faces) => {
                setFaceBoxes(imgData.filename, faces);
            });
        });
    }, [images, recipe.id, imageCacheRef.current.length]);

    const bindingHint =
        sheetBindingMode === "manual"
            ? "mode manual · klik slot untuk menempatkan foto"
            : sheetBindingMode === "by-size"
              ? "mode per ukuran"
              : images.length === 1
                ? `bergilir · foto diulang ${geometry.slots.length}×`
                : `bergilir · ${images.length} foto ke ${geometry.slots.length} slot`;

    return (
        <div className="flex flex-col items-center gap-3">
            <p className="text-xs text-white/60 text-center max-w-xl">
                {recipe.label} · {countRecipeSlots(recipe)} slot · {bindingHint}
                {" "}
                · geser/pinch slot utama · Ctrl+klik multi-pilih
            </p>
            <canvas
                ref={canvasRef}
                className="bg-white shadow-xl mx-auto"
                style={{
                    width: geometry.paperWidthPx * displayScale,
                    height: geometry.paperHeightPx * displayScale,
                    cursor: "grab",
                }}
            />
        </div>
    );
}
