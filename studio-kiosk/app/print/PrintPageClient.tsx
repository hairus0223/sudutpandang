"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { PrintCanvas } from "@/components/print/PrintCanvas";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { resolveImageUrl } from "@/lib/resolveImageUrl";

export default function PrintPageClient() {
  const router = useRouter();
  const params = useSearchParams();
  const galleryUser = params.get("user");
  const {
    images,
    selectedForPrint,
    packageType,
    loadPersistedSheetTransforms,
    clearAdjustSlotSelection,
  } = useGalleryStore();

  const selectedImages = useMemo(
    () =>
      images
        .filter((img) => selectedForPrint.includes(img.filename))
        .map((img) => ({
          ...img,
          url: resolveImageUrl(img, packageType, "print"),
        })),
    [images, selectedForPrint, packageType]
  );

  useEffect(() => {
    if (galleryUser) {
      loadPersistedSheetTransforms(galleryUser);
    }
  }, [galleryUser, loadPersistedSheetTransforms]);

  useEffect(() => {
    if (selectedForPrint.length === 0) {
      router.replace("/");
    }
  }, [selectedForPrint.length, router]);

  useEffect(() => () => clearAdjustSlotSelection(), [clearAdjustSlotSelection]);

  if (selectedImages.length === 0) return null;

  return (
    <main className="min-h-screen w-full bg-neutral-900 flex flex-col overflow-x-hidden">
      <PrintToolbar images={selectedImages} />

      <div className="flex-1 flex items-center justify-center py-4 sm:py-5 px-2 sm:px-4">
        <PrintCanvas images={selectedImages} />
      </div>
    </main>
  );
}
