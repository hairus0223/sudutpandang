"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { HeadlineGallery } from "./HeadlineGallery";
import { HomePromoOverlay } from "./HomePromoOverlay";
import { AccessForm } from "./AccessForm";

export function HomeClient() {
  const [showAccessForm, setShowAccessForm] = useState(false);

  useEffect(() => {
    if (!showAccessForm) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowAccessForm(false);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showAccessForm]);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-black">
      <HeadlineGallery />
      <HomePromoOverlay onAccessClick={() => setShowAccessForm(true)} />

      {showAccessForm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Akses foto customer"
          className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
        >
          <button
            type="button"
            aria-label="Tutup"
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowAccessForm(false)}
          />

          <div className="relative z-10 w-full max-w-lg animate-[fadeIn_0.18s_ease-out]">
            <button
              type="button"
              onClick={() => setShowAccessForm(false)}
              className="absolute right-3 top-3 z-20 flex size-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
              aria-label="Tutup dialog"
            >
              <X className="size-4" />
            </button>

            <AccessForm />
          </div>
        </div>
      )}
    </main>
  );
}
