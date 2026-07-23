import GalleryClient from "@/components/GalleryClient";
import { Suspense } from "react";

export default function GalleryPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black p-4">
          <div className="mx-auto max-w-[1960px] animate-pulse space-y-4 pt-4">
            <div className="h-8 w-40 rounded bg-white/10" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] rounded-lg bg-white/8" />
              ))}
            </div>
          </div>
        </div>
      }
    >
      <GalleryClient />
    </Suspense>
  );
}
