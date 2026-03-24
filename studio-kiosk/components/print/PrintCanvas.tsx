"use client";

import { useEffect, useRef, useState } from "react";
import { useGalleryStore, PhotoTransform } from "@/stores/useGalleryStore";
import { chunkPhotos } from "@/utils/printChunk";
import { draw4RLayout } from "./canvas/draw4Rlayout";
import type { PrintTemplate } from "@/lib/printTemplates";
import { loadBrandingLogo } from "@/utils/loadBrandingLogo";
import { useCanvasPanZoomPro } from "@/stores/useCanvasPanZoom";
import { autoCenterTransform } from "@/utils/autoCenterPreset";
import { detectFaces } from "@/utils/faceDetect";
import { drawFull4RLayout } from "./canvas/drawFull4RLayout";

type ImageData = {
    filename: string;
    url: string;
};

export function PrintCanvas({ images, isPrintMode = false }: { images: ImageData[]; isPrintMode?: boolean }) {
    const { printTemplate } = useGalleryStore();

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

    const { photoTransforms, setPhotoTransform, faceBoxes, setFaceBoxes } =
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
        if (photoTransforms[activeFilename]) return;

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


        transformRef.current = auto;
        setPhotoTransform(activeFilename, auto);
    }, [activeFilename]);


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
