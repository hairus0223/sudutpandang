import { getCoverSize } from "@/components/print/canvas/drawSmartCover";
import { PhotoTransform } from "@/stores/useGalleryStore";

type ClampRect = {
    boxW: number;
    boxH: number;
    imgW: number;
    imgH: number;
};

const MIN_SCALE = 1;
const MAX_SCALE = 3;

function getTouchDistance(touches: TouchList) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
}

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
    let pinchStartDistance: number | null = null;
    let pinchStartScale = 1;

    const clamp = (v: number, min: number, max: number) =>
        Math.min(max, Math.max(min, v));

    const getDisplayScale = () => {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width) return 1;
        return canvas.width / rect.width;
    };

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

    const applyZoom = (nextScale: number, anchorX: number, anchorY: number) => {
        const t = getTransform();
        const ratio = nextScale / t.scale;

        const nextOffset = clampOffset(
            (t.offsetX - anchorX) * ratio + anchorX,
            (t.offsetY - anchorY) * ratio + anchorY,
            nextScale
        );

        requestApply({
            scale: nextScale,
            ...nextOffset,
        });
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

        const displayScale = getDisplayScale();
        const dx = (e.clientX - lastX) / displayScale;
        const dy = (e.clientY - lastY) / displayScale;

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
        const displayScale = getDisplayScale();
        const mx = (e.clientX - rect.left) * displayScale;
        const my = (e.clientY - rect.top) * displayScale;

        const t = getTransform();
        const delta = e.deltaY < 0 ? 0.08 : -0.08;

        const nextScale = clamp(t.scale + delta, MIN_SCALE, MAX_SCALE);
        applyZoom(nextScale, mx, my);
    };

    const touchStart = (e: TouchEvent) => {
        if (e.touches.length === 1) {
            dragging = true;
            lastX = e.touches[0].clientX;
            lastY = e.touches[0].clientY;
            pinchStartDistance = null;
            return;
        }

        if (e.touches.length === 2) {
            dragging = false;
            pinchStartDistance = getTouchDistance(e.touches);
            pinchStartScale = getTransform().scale;
        }
    };

    const touchMove = (e: TouchEvent) => {
        e.preventDefault();

        if (e.touches.length === 2 && pinchStartDistance) {
            const distance = getTouchDistance(e.touches);
            const ratio = distance / pinchStartDistance;
            const nextScale = clamp(
                pinchStartScale * ratio,
                MIN_SCALE,
                MAX_SCALE
            );

            const rect = canvas.getBoundingClientRect();
            const displayScale = getDisplayScale();
            const mx =
                ((e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left) *
                displayScale;
            const my =
                ((e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top) *
                displayScale;

            applyZoom(nextScale, mx, my);
            return;
        }

        if (!dragging || e.touches.length !== 1) return;

        const displayScale = getDisplayScale();
        const dx = (e.touches[0].clientX - lastX) / displayScale;
        const dy = (e.touches[0].clientY - lastY) / displayScale;

        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;

        const t = getTransform();
        const next = clampOffset(
            t.offsetX + dx / t.scale,
            t.offsetY + dy / t.scale,
            t.scale
        );

        requestApply(next);
    };

    const touchEnd = () => {
        dragging = false;
        pinchStartDistance = null;
    };

    canvas.addEventListener("mousedown", down);
    canvas.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    canvas.addEventListener("wheel", wheel, { passive: false });
    canvas.addEventListener("touchstart", touchStart, { passive: false });
    canvas.addEventListener("touchmove", touchMove, { passive: false });
    canvas.addEventListener("touchend", touchEnd);
    canvas.addEventListener("touchcancel", touchEnd);

    canvas.style.cursor = "grab";
    canvas.style.touchAction = "none";

    return () => {
        canvas.removeEventListener("mousedown", down);
        canvas.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
        canvas.removeEventListener("wheel", wheel);
        canvas.removeEventListener("touchstart", touchStart);
        canvas.removeEventListener("touchmove", touchMove);
        canvas.removeEventListener("touchend", touchEnd);
        canvas.removeEventListener("touchcancel", touchEnd);
        if (rafId) cancelAnimationFrame(rafId);
    };
}
