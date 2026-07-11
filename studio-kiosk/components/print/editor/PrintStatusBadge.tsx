"use client";

import { cn } from "@/lib/utils";

export function PrintStatusBadge({
  ready,
  label,
}: {
  ready: boolean;
  label?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
        ready
          ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
          : "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30"
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          ready ? "bg-emerald-400" : "bg-amber-400"
        )}
      />
      {label ?? (ready ? "Siap cetak" : "Perlu perbaikan")}
    </span>
  );
}
