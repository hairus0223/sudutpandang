import { useEffect } from "react";

/**
 * Sets document data attributes + CSS vars for responsive kiosk layout.
 * Tuned for 32" portrait TV (~1080×1920), with fallbacks for laptop/dev.
 */
export function useViewportLayout() {
  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const portrait = h >= w;
      const aspect = w / h;
      const minSide = Math.min(w, h);
      const maxSide = Math.max(w, h);
      const root = document.documentElement;

      root.dataset.orientation = portrait ? "portrait" : "landscape";

      if (portrait) {
        if (aspect < 0.52) root.dataset.viewport = "portrait-narrow";
        else if (aspect < 0.72) root.dataset.viewport = "portrait-standard";
        else root.dataset.viewport = "portrait-wide";
      } else if (aspect > 1.85) {
        root.dataset.viewport = "landscape-ultrawide";
      } else if (aspect > 1.35) {
        root.dataset.viewport = "landscape-wide";
      } else {
        root.dataset.viewport = "landscape-standard";
      }

      const isTvPortrait = portrait && maxSide >= 1600 && minSide >= 900;
      root.dataset.display = isTvPortrait ? "tv-portrait" : "standard";

      root.style.setProperty("--vh", `${h * 0.01}px`);
      root.style.setProperty("--vw", `${w * 0.01}px`);
      root.style.setProperty("--kiosk-min", `${minSide}px`);
      root.style.setProperty("--kiosk-max", `${maxSide}px`);
      root.style.setProperty(
        "--kiosk-ui-scale",
        String(Math.min(1.45, Math.max(0.82, minSide / 1080)))
      );
    }

    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);
}
