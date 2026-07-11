"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { PrintCanvas } from "@/components/print/PrintCanvas";
import { PrintEditorLayout } from "@/components/print/editor/PrintEditorLayout";
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
    <PrintEditorLayout images={selectedImages}>
      <PrintCanvas images={selectedImages} />
    </PrintEditorLayout>
  );
}
