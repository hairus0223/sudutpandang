"use client";

import Link from "next/link";
import { AlertTriangle, Lock, Sparkles } from "lucide-react";
import type { AiThemeType } from "@/lib/imageTypes";
import { cn } from "@/lib/utils";

type AiSessionBannerProps = {
  aiThemeLabel: string | null;
  aiThemeLocked?: boolean;
  aiThemePreviewUrl?: string | null;
  aiThemeType?: AiThemeType | null;
  aiGenerateRemaining: number;
  aiGenerateLimit: number;
  className?: string;
};

export function AiSessionBanner({
  aiThemeLabel,
  aiThemeLocked = true,
  aiThemePreviewUrl,
  aiThemeType,
  aiGenerateRemaining,
  aiGenerateLimit,
  className,
}: AiSessionBannerProps) {
  const typeLabel = aiThemeType === "transform" ? "Transform" : "Latar Premium";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border border-violet-400/25 bg-violet-500/10 p-3 sm:p-4",
        className
      )}
    >
      {aiThemePreviewUrl ? (
        <img
          src={aiThemePreviewUrl}
          alt={aiThemeLabel ?? "Tema sesi"}
          className="h-20 w-16 shrink-0 rounded-lg object-cover ring-1 ring-white/15"
        />
      ) : (
        <div className="flex h-20 w-16 shrink-0 items-center justify-center rounded-lg bg-violet-900/40 ring-1 ring-white/10">
          <Sparkles className="size-6 text-violet-300/70" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium tracking-[0.18em] text-violet-300/80">
          TEMA SESI
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm font-semibold text-violet-50">
          {aiThemeLabel ?? "—"}
          {aiThemeLocked ? (
            <Lock className="size-3.5 text-violet-300/80" aria-label="Terkunci" />
          ) : null}
        </p>
        <p className="mt-1 text-xs text-white/50">
          {typeLabel} · Kuota AI {aiGenerateRemaining}/{aiGenerateLimit} tersisa
        </p>
        <p className="mt-1 text-[11px] text-white/40">
          Tema dipilih saat registrasi — tidak bisa diubah di galeri.
        </p>
      </div>
    </div>
  );
}

export function AiMissingThemeBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-amber-500/30 bg-amber-500/10 p-4",
        className
      )}
    >
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-300" />
        <div>
          <p className="text-sm font-medium text-amber-100">
            Tema sesi belum di-set
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-100/70">
            Paket AI Self Photo harus didaftarkan ulang dengan pilihan tema di
            layar sesi operator.
          </p>
          <Link
            href="/session"
            className="mt-3 inline-flex rounded-full bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-100 transition hover:bg-amber-500/30"
          >
            Ke registrasi →
          </Link>
        </div>
      </div>
    </div>
  );
}
