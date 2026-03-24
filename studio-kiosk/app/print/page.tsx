"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { PrintCanvas } from "@/components/print/PrintCanvas";
import { PrintToolbar } from "@/components/print/PrintToolbar";

export default function PrintPage() {
  const router = useRouter();
  const { images, selectedForPrint } = useGalleryStore();

  const selectedImages = useMemo(
    () =>
      images.filter((img) =>
        selectedForPrint.includes(img.filename)
      ),
    [images, selectedForPrint]
  );

  useEffect(() => {
    if (selectedImages.length === 0) {
      router.replace("/");
    }
  }, [selectedImages, router]);

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
