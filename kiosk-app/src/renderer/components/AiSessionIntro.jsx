import React, { useEffect } from "react";

const INTRO_AUTO_DISMISS_MS = 4500;

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {"ai" | "theme"} [props.mode]
 * @param {string | null} props.themeLabel
 * @param {string | null} props.themePreviewUrl
 * @param {"scene" | "transform" | null | undefined} props.themeType
 * @param {number} props.aiGenerateLimit
 * @param {() => void} props.onDismiss
 */
export function AiSessionIntro({
  open,
  mode = "ai",
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

  const isThemeMode = mode === "theme";
  const styleLabel = isThemeMode
    ? "Orang identik · latar tema"
    : themeType === "scene"
      ? "Latar saja"
      : "Latar + kostum";

  return (
    <div
      className="ai-intro-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={isThemeMode ? "Pengenalan Foto Tema" : "Pengenalan AI Self Photo"}
      onClick={onDismiss}
      onKeyDown={(event) => {
        if (event.key === "Escape") onDismiss();
      }}
    >
      <div className="ai-intro-card" onClick={(event) => event.stopPropagation()}>
        <div className="ai-intro-badge">{isThemeMode ? "Foto Tema" : "AI Self Photo"}</div>

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
        <p className="ai-intro-type">{styleLabel}</p>
        <p className="ai-intro-copy">
          {isThemeMode
            ? "Ambil foto. Wajah dan pose tetap sama — latar tema disusun otomatis, siap cetak."
            : "Ambil foto dulu. Orang, wajah, dan pose tetap sama — edit di meja operator."}
        </p>
        {!isThemeMode && aiGenerateLimit > 0 ? (
          <p className="ai-intro-quota">Kuota edit: {aiGenerateLimit}× foto</p>
        ) : null}

        <button type="button" className="ai-intro-skip" onClick={onDismiss}>
          Mulai sesi →
        </button>
      </div>
    </div>
  );
}
