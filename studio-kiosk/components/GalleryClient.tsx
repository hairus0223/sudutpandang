"use client";

import { useCallback, useEffect, useState } from "react";
import { useNewPhotoSocket } from "@/hooks/useNewPhotoSocket";
import { usePhotoProcessedSocket } from "@/hooks/usePhotoProcessedSocket";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchImages } from "@/services/image.service";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { PhotoCard } from "@/components/cards/PhotoCard";
import { InfoCard } from "@/components/cards/InfoCard";
import { PhotoModal } from "@/components/modals/PhotoModal";
import { BottomPrintBar } from "@/components/bottom/BottomPrintBar";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import { API_BASE_URL } from "@/lib/env";
import { PRINT_TEMPLATES } from "@/lib/printTemplates";
import { ArrowLeft } from "lucide-react";

export default function GalleryClient() {
  const router = useRouter();
  const params = useSearchParams();
  const user = params.get("user") ?? "";

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const { images, setImages, setAllowedPrint, setPrintTemplate } =
    useGalleryStore();

  const refreshGallery = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetchImages(user);
      setImages(res.images);
    } catch (err) {
      console.error(err);
    }
  }, [user, setImages]);

  useEffect(() => {
    void refreshGallery();
  }, [refreshGallery]);

  useNewPhotoSocket({
    user,
    enabled: Boolean(user),
    onNewPhoto: () => {
      void refreshGallery();
    },
  });

  usePhotoProcessedSocket({
    user,
    enabled: Boolean(user),
    onPhotoProcessed: () => {
      void refreshGallery();
    },
  });

  useEffect(() => {
    if (!user) return;

    fetch(`${API_BASE_URL}/api/print-config/${user}`)
      .then((r) => r.json())
      .then((d) => {
        setAllowedPrint(d.allowedPrint);
        const tpl = PRINT_TEMPLATES.find(
            (t) => t.id === d.templateId
        );

        if (tpl) {
            setPrintTemplate(tpl);
        }
      });
  }, [user]);

  return (
    <main className="p-3 sm:p-4 pb-28 sm:pb-32 max-w-[1960px] mx-auto min-h-screen">
      {/* HEADER */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-sm sm:text-base text-white/90 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" /> Back
        </button>

        <span className="text-white/50 text-sm sm:text-base">
          Total Foto: <b>{images.length}</b>
        </span>
      </div>

      {/* GRID — responsive columns */}
      <div className="columns-1 sm:columns-2 xl:columns-3 2xl:columns-4 gap-3 sm:gap-4">
        <InfoCard userName={user} />

        {images.map((img, index) => (
          <PhotoCard
            key={img.filename}
            src={img.url}
            filename={img.filename}
            processingStatus={img.processingStatus}
            onClick={() => setActiveIndex(index)}
          />
        ))}
      </div>

      <PhotoModal
        open={activeIndex !== null}
        index={activeIndex}
        images={images}
        onClose={() => setActiveIndex(null)}
        onChange={setActiveIndex}
      />

      <BottomPrintBar onContinue={() => router.push("/print")} />
      <ScrollToTop />
    </main>
  );
}
