import { Suspense } from "react";
import PrintPageClient from "./PrintPageClient";

export default function PrintPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full bg-neutral-900 flex items-center justify-center text-white">
          Memuat editor cetak...
        </div>
      }
    >
      <PrintPageClient />
    </Suspense>
  );
}
