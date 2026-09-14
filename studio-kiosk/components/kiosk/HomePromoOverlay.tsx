"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ClipboardList,
  FolderOpen,
  SlidersHorizontal,
  Sparkles,
  UserSearch,
} from "lucide-react";
import logo from "@/assets/light-logo.png";

type HomePromoOverlayProps = {
  onAccessClick: () => void;
};

const actionBtnClass =
  "inline-flex h-9 max-w-full touch-manipulation items-center justify-center gap-1.5 rounded-full border border-white/15 bg-black/45 px-3.5 text-[11px] font-medium text-white/90 no-underline backdrop-blur-md transition hover:border-white/30 hover:bg-black/60 hover:text-white sm:h-10 sm:px-4 sm:text-xs";

const startBtnClass =
  "inline-flex h-9 max-w-full touch-manipulation items-center justify-center gap-1.5 rounded-full border border-[#E8C872]/50 bg-[#E8C872] px-3.5 text-[11px] font-semibold text-black no-underline transition hover:bg-[#f3d78a] sm:h-10 sm:px-4 sm:text-xs";

const quietLinkClass =
  "inline-flex h-8 touch-manipulation items-center gap-1 rounded-full px-2.5 text-[10px] text-white/45 no-underline transition hover:text-[#E8C872] sm:text-[11px]";

export function HomePromoOverlay({ onAccessClick }: HomePromoOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/25"
        aria-hidden
      />

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-4 pb-safe-home sm:px-6 sm:pb-7 lg:pb-9">
        <div className="home-brand-mark flex flex-col items-center text-center">
          <Image
            src={logo}
            alt="Sudut Pandang"
            priority
            className="h-11 w-auto drop-shadow-[0_8px_24px_rgba(0,0,0,0.65)] sm:h-14 lg:h-16"
          />
          <span className="home-brand-rule" aria-hidden />
          <p className="home-brand-kicker mt-3 font-semibold uppercase text-[#E8C872]">
            Self Photo Studio
          </p>
        </div>

        <nav
          aria-label="Aksi studio"
          className="pointer-events-auto mt-4 flex w-full max-w-lg flex-col items-center gap-2 sm:mt-5"
        >
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
            <Link href="/session" className={actionBtnClass}>
              <ClipboardList className="size-3.5 shrink-0" />
              Registrasi
            </Link>
            <Link href="/session?mode=check" className={startBtnClass}>
              <UserSearch className="size-3.5 shrink-0" />
              Cek nama
            </Link>
            <button type="button" onClick={onAccessClick} className={actionBtnClass}>
              <FolderOpen className="size-3.5 shrink-0" />
              Akses foto
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1">
            <Link href="/operator/print-tune" className={quietLinkClass}>
              <SlidersHorizontal className="size-3 shrink-0" />
              Tuning
            </Link>
            <Link href="/admin/ai-theme-research" className={quietLinkClass}>
              <Sparkles className="size-3 shrink-0" />
              AI Research
            </Link>
          </div>
        </nav>
      </div>
    </div>
  );
}
