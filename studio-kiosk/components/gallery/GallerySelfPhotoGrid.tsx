"use client";

import { useMemo } from "react";
import type { GalleryImageData } from "@/lib/imageTypes";
import { InfoCard } from "@/components/cards/InfoCard";
import { GalleryPhotoTile } from "@/components/gallery/GalleryPhotoTile";
import { GalleryPrintSelectionBar } from "@/components/gallery/GalleryPrintSelectionBar";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { useToast } from "@/components/ui/ToastProvider";

type GallerySelfPhotoGridProps = {
  userName: string;
  images: GalleryImageData[];
  onOpenPhoto: (index: number) => void;
};

function imageKey(image: GalleryImageData, index: number): string {
  return image.imageId ?? image.filename ?? String(index);
}

export function GallerySelfPhotoGrid({
  userName,
  images,
  onOpenPhoto,
}: GallerySelfPhotoGridProps) {
  const { toast } = useToast();
  const {
    selectedImageIds,
    toggleGallerySelection,
    clearGallerySelection,
    selectedForPrint,
    printVariantByFilename,
    removeFromPrint,
    bulkRemoveFromPrint,
    enqueuePrintMany,
    allowedPrint,
  } = useGalleryStore();

  const selectedImages = useMemo(() => {
    return images.filter((img, index) =>
      selectedImageIds.includes(imageKey(img, index))
    );
  }, [images, selectedImageIds]);

  const printSelectedCount = selectedImages.filter((img) =>
    selectedForPrint.includes(img.filename)
  ).length;

  const originalQueuedCount = selectedImages.filter(
    (img) =>
      selectedForPrint.includes(img.filename) &&
      (printVariantByFilename[img.filename] ?? "original") === "original"
  ).length;

  const handleEnqueuePrint = (variant: "original" | "ai") => {
    const result = enqueuePrintMany(
      selectedImages.map((img) => img.filename),
      variant
    );
    if (result.skippedLimit > 0) {
      toast(`Antrian cetak penuh (maks. ${allowedPrint} foto).`, "error");
    } else if (result.added === 0 && result.updated === 0) {
      toast("Foto terpilih sudah di antrian cetak.", "default");
    } else {
      toast(
        `${result.added + result.updated} foto masuk antrian cetak.`,
        "success"
      );
    }
  };

  const handleRemovePrintFromSelection = () => {
    bulkRemoveFromPrint(selectedImages.map((img) => img.filename));
  };

  return (
    <section className="space-y-4 pb-44">
      <div>
        <h2 className="text-sm font-medium text-[#E8C872] sm:text-base">
          Pilih foto untuk cetak
        </h2>
        <p className="mt-1 text-xs text-white/45">
          Tap checkbox untuk pilih · ikon perbesar untuk preview. Foto di antrian
          cetak ditandai badge emas.
        </p>
      </div>

      <div className="columns-1 gap-3 sm:columns-2 sm:gap-4 xl:columns-3 2xl:columns-4">
        <InfoCard userName={userName} />
        {images.map((img, index) => {
          const key = imageKey(img, index);
          const isSelected = selectedImageIds.includes(key);
          const selectionIndex = isSelected
            ? selectedImageIds.indexOf(key) + 1
            : null;
          const isPrintSelected = selectedForPrint.includes(img.filename);
          const printVariant = printVariantByFilename[img.filename] ?? "original";

          return (
            <GalleryPhotoTile
              key={img.filename}
              image={img}
              index={index}
              isSelected={isSelected}
              selectionIndex={selectionIndex}
              isPrintSelected={isPrintSelected}
              printVariant={printVariant}
              accent="gold"
              onToggleSelect={() => toggleGallerySelection(key)}
              onTogglePrint={() => removeFromPrint(img.filename)}
              onOpenPhoto={() => onOpenPhoto(index)}
            />
          );
        })}
      </div>

      <div className="sticky bottom-28 z-30 mx-auto max-w-4xl">
        <GalleryPrintSelectionBar
          accent="gold"
          selectedImages={selectedImages}
          printSelectedCount={printSelectedCount}
          allowedPrint={allowedPrint}
          totalPrintSelected={selectedForPrint.length}
          originalQueuedCount={originalQueuedCount}
          onClearSelection={clearGallerySelection}
          onEnqueuePrint={handleEnqueuePrint}
          onRemovePrintFromSelection={handleRemovePrintFromSelection}
          hint="Pilih foto, lalu ketuk Masukkan antrian cetak. Badge emas = sudah di antrian. Lanjut Cetak di bawah layar."
        />
      </div>
    </section>
  );
}
