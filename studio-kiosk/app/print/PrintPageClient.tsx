"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { PrintCanvas } from "@/components/print/PrintCanvas";
import { PrintEditorLayout } from "@/components/print/editor/PrintEditorLayout";
import { resolvePrintUrl } from "@/lib/resolveImageUrl";

export default function PrintPageClient() {
  const router = useRouter();
  const params = useSearchParams();
  const galleryUser = params.get("user");
  const {
    images,
    selectedForPrint,
    printVariantByFilename,
    aiThemeId,
    loadPersistedSheetTransforms,
    clearAdjustSlotSelection,
  } = useGalleryStore();

  const selectedImages = useMemo(
    () =>
      images
        .filter((img) => selectedForPrint.includes(img.filename))
        .map((img) => {
          const variant = printVariantByFilename[img.filename] ?? "original";
          return {
            ...img,
            url: resolvePrintUrl(img, variant, aiThemeId),
          };
        }),
    [images, selectedForPrint, printVariantByFilename, aiThemeId]
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
    <PrintEditorLayout images={selectedImages}>
      <PrintCanvas images={selectedImages} />
    </PrintEditorLayout>
  );
}
