import GalleryClient from "@/components/GalleryClient";
import { Suspense } from "react";

export default function GalleryPage() {
  return (
    <Suspense fallback={<div className="p-4 text-white">Loading gallery...</div>}>
      <GalleryClient />
    </Suspense>
  );
}
