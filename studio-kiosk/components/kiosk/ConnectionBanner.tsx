"use client";

import { WifiOff } from "lucide-react";

type ConnectionBannerProps = {
  connected: boolean;
};

export function ConnectionBanner({ connected }: ConnectionBannerProps) {
  if (connected) return null;

  return (
    <div
      className="flex items-center justify-center gap-2 border-b border-amber-500/30 bg-amber-950/90 px-4 py-2 text-sm text-amber-100"
      role="status"
    >
      <WifiOff className="size-4 shrink-0" />
      Koneksi terputus — mencoba hubungkan ulang…
    </div>
  );
}
