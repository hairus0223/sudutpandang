import React, { useEffect } from "react";

const INTRO_AUTO_DISMISS_MS = 4500;

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {string | null} props.themeLabel
 * @param {string | null} props.themePreviewUrl
 * @param {"scene" | "transform" | null | undefined} props.themeType
 * @param {number} props.aiGenerateLimit
 * @param {() => void} props.onDismiss
 */
export function AiSessionIntro({
  open,
  themeLabel,
  themePreviewUrl,
  themeType,
  aiGenerateLimit,
  onDismiss,
}) {
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(onDismiss, INTRO_AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [open, onDismiss]);

  if (!open) return null;

  const typeLabel = themeType === "transform" ? "Transform AI" : "Latar Premium";
  const actionCopy =
    themeType === "transform"
      ? "Ambil foto dulu — transformasi di meja operator"
      : "Ambil foto dulu — hasil AI di meja operator";

  return (
    <div
      className="ai-intro-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Pengenalan AI Self Photo"
      onClick={onDismiss}
      onKeyDown={(event) => {
        if (event.key === "Escape") onDismiss();
      }}
    >
      <div className="ai-intro-card" onClick={(event) => event.stopPropagation()}>
        <div className="ai-intro-badge">AI Self Photo</div>

        {themePreviewUrl ? (
          <img
            src={themePreviewUrl}
            alt={themeLabel ?? "Contoh tema"}
            className="ai-intro-preview"
          />
        ) : (
          <div className="ai-intro-preview ai-intro-preview--placeholder" />
        )}

        <h2 className="ai-intro-title">
          Tema: <span>{themeLabel ?? "—"}</span>
        </h2>
        <p className="ai-intro-type">{typeLabel}</p>
        <p className="ai-intro-copy">{actionCopy}</p>
        {aiGenerateLimit > 0 ? (
          <p className="ai-intro-quota">Kuota generate: {aiGenerateLimit}× foto</p>
        ) : null}

        <button type="button" className="ai-intro-skip" onClick={onDismiss}>
          Mulai sesi →
        </button>
      </div>
    </div>
  );
}
