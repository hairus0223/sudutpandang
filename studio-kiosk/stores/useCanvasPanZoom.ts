import { getCoverSize } from "@/components/print/canvas/drawSmartCover";
import { PhotoTransform } from "@/stores/useGalleryStore";

type ClampRect = {
    boxW: number;
    boxH: number;
    imgW: number;
    imgH: number;
};

export function useCanvasPanZoomPro(
    canvas: HTMLCanvasElement,
    getTransform: () => PhotoTransform,
    setTransform: (patch: Partial<PhotoTransform>) => void,
    getClampRect: () => ClampRect
) {
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let rafId: number | null = null;
    let pendingPatch: Partial<PhotoTransform> | null = null;

    const clamp = (v: number, min: number, max: number) =>
        Math.min(max, Math.max(min, v));

    const apply = () => {
        if (pendingPatch) {
            setTransform(pendingPatch);
            pendingPatch = null;
        }
        rafId = null;
    };

    const requestApply = (patch: Partial<PhotoTransform>) => {
        pendingPatch = {
            ...getTransform(),
            ...patch,
        };

        if (rafId == null) {
            rafId = requestAnimationFrame(apply);
        }
    };

    const clampOffset = (
        offsetX: number,
        offsetY: number,
        scale: number
    ) => {
        const { boxW, boxH, imgW, imgH } = getClampRect();

        if (!boxW || !boxH || !imgW || !imgH) {
            return { offsetX: 0, offsetY: 0 };
        }

        const { drawW, drawH } = getCoverSize(
            imgW,
            imgH,
            boxW,
            boxH
        );

        const scaledW = drawW * scale;
        const scaledH = drawH * scale;

        const maxX = Math.max(0, (scaledW - boxW) / 2);
        const maxY = Math.max(0, (scaledH - boxH) / 2);

        return {
            offsetX: clamp(offsetX, -maxX, maxX),
            offsetY: clamp(offsetY, -maxY, maxY),
        };
    };


    const down = (e: MouseEvent) => {
        e.preventDefault();
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        canvas.style.cursor = "grabbing";
    };

    const move = (e: MouseEvent) => {
        if (!dragging) return;

        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;

        lastX = e.clientX;
        lastY = e.clientY;

        const t = getTransform();
        const next = clampOffset(
            t.offsetX + dx / t.scale,
            t.offsetY + dy / t.scale,
            t.scale
        );

        requestApply(next);
    };

    const up = () => {
        dragging = false;
        canvas.style.cursor = "grab";
    };

    const wheel = (e: WheelEvent) => {
        e.preventDefault();

        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const t = getTransform();
        const delta = e.deltaY < 0 ? 0.08 : -0.08;

        const nextScale = clamp(t.scale + delta, 1, 2.5);
        const ratio = nextScale / t.scale;

        const nextOffset = clampOffset(
            (t.offsetX - mx) * ratio + mx,
            (t.offsetY - my) * ratio + my,
            nextScale
        );

        requestApply({
            scale: nextScale,
            ...nextOffset,
        });
    };

    canvas.addEventListener("mousedown", down);
    canvas.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    canvas.addEventListener("wheel", wheel, { passive: false });

    canvas.style.cursor = "grab";

    return () => {
        canvas.removeEventListener("mousedown", down);
        canvas.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
        canvas.removeEventListener("wheel", wheel);
        if (rafId) cancelAnimationFrame(rafId);
    };
}
