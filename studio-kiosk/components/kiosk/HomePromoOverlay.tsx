"use client";

import Image from "next/image";
import Link from "next/link";
import { FolderOpen, Sparkles } from "lucide-react";
import logo from "@/assets/light-logo.png";

type HomePromoOverlayProps = {
  onAccessClick: () => void;
};

export function HomePromoOverlay({ onAccessClick }: HomePromoOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {/* Readability gradients — photos stay visible, copy stays readable */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/40 sm:from-black/80 sm:via-transparent sm:to-black/35 lg:bg-gradient-to-r lg:from-black/20 lg:via-black/45 lg:to-black/90"
        aria-hidden
      />

      <div className="absolute inset-x-0 bottom-0 flex flex-col justify-end px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-24 sm:px-10 sm:pb-10 lg:inset-y-0 lg:left-auto lg:right-0 lg:w-[42%] lg:justify-center lg:px-12 lg:py-12 xl:w-[38%] xl:px-14">
        <div className="pointer-events-auto max-w-md">
          <Image
            src={logo}
            alt="Sudut Pandang"
            priority
            className="h-8 w-auto drop-shadow-lg sm:h-10 lg:h-11"
          />

          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#E8C872]">
            Self Photo Studio
          </p>

          <h1 className="mt-3 text-[2rem] font-bold leading-[1.12] tracking-tight text-white sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
            Setiap sudut,
            <span className="mt-1 block text-[#E8C872]">satu cerita.</span>
          </h1>

          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/70 sm:text-base">
            Masuk, pose, dan bawa pulang fotonya. Studio self photo dengan tema
            AI — cocok untuk sendiri, bareng teman, atau keluarga.
          </p>

          <p className="mt-6 text-lg font-semibold text-white sm:text-xl">
            Yuk, foto sekarang.
          </p>
          <p className="mt-1 text-sm text-white/50">Walk in · langsung sesi</p>
        </div>

        {/* Operator-only — visually quiet so the screen stays promotional */}
        <div className="pointer-events-auto mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/35 lg:mt-16">
          <Link
            href="/session"
            className="!text-white/35 no-underline transition hover:!text-[#E8C872] focus-visible:!text-[#E8C872]"
          >
            Mulai sesi
          </Link>
          <button
            type="button"
            onClick={onAccessClick}
            className="inline-flex items-center gap-1.5 text-white/35 transition hover:text-white/70"
          >
            <FolderOpen className="size-3.5" />
            Akses foto
          </button>
          <Link
            href="/admin/ai-theme-research"
            className="inline-flex items-center gap-1.5 !text-white/35 no-underline transition hover:!text-violet-200/80"
          >
            <Sparkles className="size-3.5" />
            AI Research
          </Link>
        </div>
      </div>
    </div>
  );
}
