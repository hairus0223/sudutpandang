import { useEffect } from "react";

/**
 * Sets document data attributes + CSS vars for responsive kiosk layout.
 * Supports portrait TV (32"), laptop landscape dev, and in-between sizes.
 */
export function useViewportLayout() {
  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const portrait = h >= w;
      const aspect = w / h;
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

      root.style.setProperty("--vh", `${h * 0.01}px`);
      root.style.setProperty("--vw", `${w * 0.01}px`);
      root.style.setProperty("--kiosk-min", `${Math.min(w, h)}px`);
      root.style.setProperty("--kiosk-max", `${Math.max(w, h)}px`);
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
