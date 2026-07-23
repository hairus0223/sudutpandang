"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function PrintPageStrip({ pageCount }: { pageCount: number }) {
  const [activePage, setActivePage] = useState(0);

  useEffect(() => {
    const pageElements = Array.from({ length: pageCount }, (_, index) =>
      document.getElementById(`print-page-${index}`)
    ).filter(Boolean) as HTMLElement[];

    if (!pageElements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (!visible.length) return;

        const id = visible[0].target.id;
        const index = Number(id.replace("print-page-", ""));
        if (!Number.isNaN(index)) {
          setActivePage(index);
        }
      },
      { root: null, rootMargin: "-20% 0px -55% 0px", threshold: [0.15, 0.4, 0.65] }
    );

    pageElements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [pageCount]);

  const scrollToPage = (index: number) => {
    document.getElementById(`print-page-${index}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setActivePage(index);
  };

  if (pageCount <= 1) return null;

  return (
    <div
      className={cn(
        "sticky top-0 z-10 mb-1 w-full max-w-[min(100%,920px)]",
        "rounded-xl border border-white/10 bg-neutral-950/95 px-2 py-2 shadow-lg backdrop-blur-md sm:px-3"
      )}
    >
      <div className="flex items-center gap-2">
        <span className="hidden shrink-0 text-[10px] font-medium uppercase tracking-wide text-white/40 sm:inline">
          Lompat halaman
        </span>
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {Array.from({ length: pageCount }, (_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => scrollToPage(index)}
              className={cn(
                "inline-flex h-8 min-w-[2rem] shrink-0 items-center justify-center rounded-lg px-2.5 text-xs font-semibold transition",
                activePage === index
                  ? "bg-violet-600 text-white shadow-sm"
                  : "bg-white/5 text-white/65 hover:bg-white/10 hover:text-white"
              )}
              aria-current={activePage === index ? "true" : undefined}
            >
              {index + 1}
            </button>
          ))}
        </div>
        <span className="shrink-0 rounded-full bg-white/5 px-2 py-1 text-[10px] font-medium text-white/50">
          {activePage + 1}/{pageCount}
        </span>
      </div>
    </div>
  );
}
