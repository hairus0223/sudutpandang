"use client";

import Image from "next/image";
import Link from "next/link";
import { FolderOpen, SlidersHorizontal, Sparkles } from "lucide-react";
import logo from "@/assets/light-logo.png";

type HomePromoOverlayProps = {
  onAccessClick: () => void;
};

export function HomePromoOverlay({ onAccessClick }: HomePromoOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/25"
        aria-hidden
      />

      <div className="pointer-events-auto absolute right-3 top-3 z-20 flex flex-wrap justify-end gap-x-4 gap-y-1 text-[11px] text-white/30 sm:right-5 sm:top-4">
        <Link
          href="/session"
          className="!text-white/30 no-underline transition hover:!text-[#E8C872] focus-visible:!text-[#E8C872]"
        >
          Mulai sesi
        </Link>
        <button
          type="button"
          onClick={onAccessClick}
          className="inline-flex items-center gap-1 text-white/30 transition hover:text-white/70"
        >
          <FolderOpen className="size-3" />
          Akses foto
        </button>
        <Link
          href="/operator/print-tune"
          className="inline-flex items-center gap-1 !text-white/30 no-underline transition hover:!text-[#E8C872]"
        >
          <SlidersHorizontal className="size-3" />
          Tuning
        </Link>
        <Link
          href="/admin/ai-theme-research"
          className="inline-flex items-center gap-1 !text-white/30 no-underline transition hover:!text-violet-200/80"
        >
          <Sparkles className="size-3" />
          AI
        </Link>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex justify-center px-4 pb-safe-home sm:px-6 sm:pb-8 lg:pb-10">
        <div className="home-brand-mark pointer-events-none flex flex-col items-center text-center">
          <Image
            src={logo}
            alt="Sudut Pandang"
            priority
            className="h-12 w-auto drop-shadow-[0_8px_24px_rgba(0,0,0,0.65)] sm:h-16 lg:h-[4.75rem]"
          />
          <span className="home-brand-rule" aria-hidden />
          <p className="mt-3 text-[0.7rem] font-semibold uppercase tracking-[0.42em] text-[#E8C872] sm:text-sm sm:tracking-[0.48em] lg:text-base lg:tracking-[0.52em]">
            Self Photo Studio
          </p>
        </div>
      </div>
    </div>
  );
}
