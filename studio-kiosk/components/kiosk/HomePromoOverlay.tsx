"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ClipboardList,
  FolderOpen,
  MoreVertical,
  SlidersHorizontal,
  Sparkles,
  UserSearch,
} from "lucide-react";
import logo from "@/assets/light-logo.png";

type HomePromoOverlayProps = {
  onAccessClick: () => void;
};

const menuItemClass =
  "home-action-item flex min-h-11 w-full cursor-pointer touch-manipulation items-center gap-2.5 rounded-xl border-0 bg-transparent px-3 text-left text-sm font-medium text-white no-underline transition hover:bg-white/10";

export function HomePromoOverlay({ onAccessClick }: HomePromoOverlayProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/30"
        aria-hidden
      />

      <div
        ref={menuRef}
        className="pointer-events-auto absolute right-3 top-3 z-20 sm:right-5 sm:top-4"
      >
        <button
          type="button"
          aria-label={menuOpen ? "Tutup menu" : "Buka menu"}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setMenuOpen((open) => !open)}
          className="flex size-10 touch-manipulation items-center justify-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-md transition hover:border-white/30 hover:bg-black/60"
        >
          <MoreVertical className="size-5" />
        </button>

        {menuOpen ? (
          <div
            id={menuId}
            role="menu"
            className="home-action-menu absolute right-0 top-[calc(100%+0.5rem)] w-52 rounded-2xl border border-white/15 bg-black/80 p-1.5 shadow-2xl backdrop-blur-md"
          >
            <Link
              href="/session"
              role="menuitem"
              className={menuItemClass}
              onClick={() => setMenuOpen(false)}
            >
              <ClipboardList className="size-4 shrink-0" />
              Registrasi
            </Link>
            <Link
              href="/session?mode=check"
              role="menuitem"
              className={menuItemClass}
              onClick={() => setMenuOpen(false)}
            >
              <UserSearch className="size-4 shrink-0" />
              Cek nama
            </Link>
            <button
              type="button"
              role="menuitem"
              className={menuItemClass}
              onClick={() => {
                setMenuOpen(false);
                onAccessClick();
              }}
            >
              <FolderOpen className="size-4 shrink-0" />
              Akses foto
            </button>
            <Link
              href="/operator/print-tune"
              role="menuitem"
              className={menuItemClass}
              onClick={() => setMenuOpen(false)}
            >
              <SlidersHorizontal className="size-4 shrink-0" />
              Tuning
            </Link>
            <Link
              href="/admin/ai-theme-research"
              role="menuitem"
              className={menuItemClass}
              onClick={() => setMenuOpen(false)}
            >
              <Sparkles className="size-4 shrink-0" />
              AI Research
            </Link>
          </div>
        ) : null}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex justify-center px-4 pb-safe-home sm:px-6 sm:pb-8 lg:pb-10">
        <div className="home-brand-mark flex flex-col items-center text-center">
          <Image
            src={logo}
            alt="Sudut Pandang"
            priority
            className="home-brand-logo h-7 w-auto sm:h-8 lg:h-9"
          />
          <span className="home-brand-rule" aria-hidden />
          <p className="home-brand-kicker mt-3 font-semibold uppercase">
            Self Photo Studio
          </p>
        </div>
      </div>
    </div>
  );
}
