"use client";

import { useEffect, useRef, useState } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
} from "lucide-react";
import { useGalleryStore } from "@/stores/useGalleryStore";

type ImageData = {
  filename: string;
  url: string;
};

type PhotoModalProps = {
  open: boolean;
  index: number | null;
  images: ImageData[];
  onClose: () => void;
  onChange: (index: number) => void;
};

export function PhotoModal({
  open,
  index,
  images,
  onClose,
  onChange,
}: PhotoModalProps) {
  /* ================= STORE ================= */
  const { selectedForPrint, togglePrint } = useGalleryStore();
  const [bottomOffset, setBottomOffset] = useState(32);

  /* ================= STATE ================= */
  const [showUI, setShowUI] = useState(true);

  /* ================= REFS ================= */
  const imageRef = useRef<HTMLImageElement | null>(null);
  const hideUITimer = useRef<NodeJS.Timeout | null>(null);

  // Swipe
  const touchStartX = useRef<number | null>(null);

  // Zoom
  const scale = useRef(1);
  const lastScale = useRef(1);
  const startDistance = useRef<number | null>(null);


useEffect(() => {
  if (!open) return;
  setBottomOffset(getBottomBarHeight() + 24);
}, [open, selectedForPrint.length]);


  /* ================= BODY SCROLL LOCK ================= */
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  /* ================= UI AUTO HIDE ================= */
  const resetHideUI = () => {
    setShowUI(true);
    if (hideUITimer.current) clearTimeout(hideUITimer.current);
    hideUITimer.current = setTimeout(() => setShowUI(false), 2500);
  };

  useEffect(() => {
    if (!open) return;
    resetHideUI();
    window.addEventListener("mousemove", resetHideUI);
    window.addEventListener("keydown", resetHideUI);

    return () => {
      window.removeEventListener("mousemove", resetHideUI);
      window.removeEventListener("keydown", resetHideUI);
      if (hideUITimer.current) clearTimeout(hideUITimer.current);
    };
  }, [open]);

  /* ================= KEYBOARD ================= */
  useEffect(() => {
    if (!open || index === null) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (scale.current > 1) return; // 🔒 lock slide while zoom

      if (e.key === "ArrowRight" && index < images.length - 1) {
        resetZoom();
        onChange(index + 1);
      }
      if (e.key === "ArrowLeft" && index > 0) {
        resetZoom();
        onChange(index - 1);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, index, images.length, onClose, onChange]);

  /* ================= IMAGE PRELOAD ================= */
  useEffect(() => {
    if (index === null) return;
    [index + 1, index - 1].forEach((i) => {
      if (!images[i]) return;
      const img = new Image();
      img.src = images[i].url;
    });
  }, [index, images]);

  /* 🔒 SAFE RETURN */
  if (!open || index === null || !images[index]) return null;

  const image = images[index];
  const isSelected = selectedForPrint.includes(image.filename);

  /* ================= TOUCH ================= */
  const getDistance = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    resetHideUI();

    if (e.touches.length === 1) {
      touchStartX.current = e.touches[0].clientX;
    }

    if (e.touches.length === 2) {
      startDistance.current = getDistance(e.touches);
      lastScale.current = scale.current;
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (
      e.touches.length === 2 &&
      startDistance.current &&
      imageRef.current
    ) {
      const zoom =
        getDistance(e.touches) / startDistance.current;

      scale.current = Math.min(
        Math.max(lastScale.current * zoom, 1),
        4
      );

      imageRef.current.style.transform = `scale(${scale.current})`;
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (scale.current > 1) return; // 🔒 lock swipe

    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    const threshold = 60;

    if (diff > threshold && index > 0) {
      onChange(index - 1);
    }
    if (diff < -threshold && index < images.length - 1) {
      onChange(index + 1);
    }

    touchStartX.current = null;
    startDistance.current = null;
  };

  const resetZoom = () => {
    scale.current = 1;
    if (imageRef.current) {
      imageRef.current.style.transform = "scale(1)";
    }
  };

  const getBottomBarHeight = () => {
    const el = document.querySelector("[data-bottom-bar]");
    return el ? el.clientHeight : 0;
  };


  /* ================= RENDER ================= */
  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* UI LAYER */}
      <div
        className={`fixed inset-0 z-[100] transition-opacity duration-300 ${
          showUI ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* CLOSE */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-white/80 hover:text-white"
        >
          <X size={32} />
        </button>

        {/* LEFT */}
        {index > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              resetZoom();
              onChange(index - 1);
            }}
            className="absolute left-6 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
          >
            <ChevronLeft size={48} />
          </button>
        )}

        {/* RIGHT */}
        {index < images.length - 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              resetZoom();
              onChange(index + 1);
            }}
            className="absolute right-6 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
          >
            <ChevronRight size={48} />
          </button>
        )}

        {/* PRINT */}
        <button
        onClick={(e) => {
            e.stopPropagation();
            togglePrint(image.filename);
        }}
        style={{ bottom: bottomOffset }}
        className="absolute left-1/2 -translate-x-1/2
                    rounded-full bg-black/80 px-6 py-3
                    flex items-center gap-3 text-white text-lg
                    transition-all duration-300 ease-out"
        >

          {isSelected ? (
            <>
              <CheckSquare className="text-green-400" />
              Dipilih untuk cetak
            </>
          ) : (
            <>
              <Square />
              Pilih untuk cetak
            </>
          )}
        </button>
      </div>

      {/* IMAGE LAYER */}
      <div className="relative z-10">
        <img
          ref={imageRef}
          src={image.url}
          alt={image.filename}
          draggable={false}
          onClick={(e) => {
            e.stopPropagation();
            resetZoom();
          }}
          className="max-h-[90vh] max-w-[90vw]
                     object-contain
                     rounded-lg shadow-2xl
                     transition-all duration-300 ease-out
                     will-change-transform"
        />
      </div>
    </div>
  );
}
