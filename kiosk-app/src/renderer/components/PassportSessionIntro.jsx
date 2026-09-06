import React, { useEffect } from "react";

const INTRO_AUTO_DISMISS_MS = 4500;

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {string | null | undefined} props.backgroundColor
 * @param {() => void} props.onDismiss
 */
export function PassportSessionIntro({ open, backgroundColor, onDismiss }) {
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(onDismiss, INTRO_AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [open, onDismiss]);

  if (!open) return null;

  return (
    <div
      className="ai-intro-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Pengenalan Pas Photo"
      onClick={onDismiss}
      onKeyDown={(event) => {
        if (event.key === "Escape") onDismiss();
      }}
    >
      <div className="ai-intro-card" onClick={(event) => event.stopPropagation()}>
        <div className="ai-intro-badge">Pas Photo</div>
        <div
          className="ai-intro-preview"
          style={{ backgroundColor: backgroundColor || "#438CCB" }}
        />
        <h2 className="ai-intro-title">
          Pose di bingkai <span>3×4</span>
        </h2>
        <p className="ai-intro-copy">
          Isi siluet orang (kepala & bahu). Bingkai hijau = posisi tepat, merah
          = geser dulu. Soft file memakai warna ini untuk 2×3, 3×4, dan 4×6.
        </p>
        <button type="button" className="ai-intro-skip" onClick={onDismiss}>
          Mulai sesi →
        </button>
      </div>
    </div>
  );
}
