"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { API_BASE_URL } from "@/lib/env";
import { DEV_DUMMY_HEADLINES, IS_DEV } from "@/lib/devHeadlines";
import { cn } from "@/lib/utils";

type Headline = {
  filename: string;
  url: string;
};

type MosaicLayout = {
  cols: number;
  rows: number;
  hero: boolean;
  gap: number;
};

const DESKTOP_MIN_WIDTH = 900;
const TILE_INTERVAL = 2800;
const HERO_INTERVAL = 7200;
const ANIMATION_MS = 620;

function shuffleHeadlines(items: Headline[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function fillSlots(items: Headline[], count: number): (Headline | null)[] {
  if (items.length === 0) return Array.from({ length: count }, () => null);
  return Array.from({ length: count }, (_, i) => items[i % items.length]);
}

function computeMosaic(width: number): MosaicLayout {
  const gap = width < 640 ? 6 : width < 1280 ? 8 : 10;
  if (width >= DESKTOP_MIN_WIDTH) {
    return { cols: 5, rows: 2, hero: true, gap };
  }
  if (width >= 640) {
    return { cols: 4, rows: 2, hero: true, gap };
  }
  return { cols: 3, rows: 2, hero: false, gap };
}

function slotCountFor(layout: MosaicLayout) {
  if (!layout.hero) return layout.cols * layout.rows;
  return 1 + (layout.cols - 2) * layout.rows;
}

const INITIAL_LAYOUT = computeMosaic(0);
const INITIAL_SLOT_COUNT = slotCountFor(INITIAL_LAYOUT);
const INITIAL_HEADLINES = IS_DEV ? DEV_DUMMY_HEADLINES : [];

function HeadlineTile({
  item,
  flipping,
  hero,
  loading,
}: {
  item: Headline | null;
  flipping: boolean;
  hero: boolean;
  loading: boolean;
}) {
  return (
    <div
      className={cn(
        "home-headline-tile relative h-full min-h-0 w-full overflow-hidden bg-[#0c0c0c]",
        hero && "home-headline-hero"
      )}
    >
      {loading && !item ? (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-[#E8C872]/12 via-white/[0.04] to-transparent" />
      ) : !item ? (
        <div className="absolute inset-0 bg-gradient-to-br from-[#E8C872]/10 via-white/[0.03] to-transparent" />
      ) : (
        <div
          className={cn(
            "absolute inset-0 transform-gpu transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
            flipping ? "home-tile-exit" : "home-tile-enter"
          )}
        >
          <img
            src={item.url}
            alt=""
            draggable={false}
            className={cn(
              "absolute inset-0 h-full w-full object-cover",
              hero && "home-kenburns"
            )}
          />
          <div
            className={cn(
              "pointer-events-none absolute inset-0",
              hero
                ? "bg-gradient-to-t from-black/45 via-transparent to-black/15"
                : "bg-gradient-to-t from-black/25 via-transparent to-transparent"
            )}
            aria-hidden
          />
        </div>
      )}
    </div>
  );
}

export function HeadlineGallery() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<MosaicLayout>(INITIAL_LAYOUT);
  const [headlines, setHeadlines] = useState<Headline[]>(INITIAL_HEADLINES);
  const [isLoading, setIsLoading] = useState(!IS_DEV);
  const [slots, setSlots] = useState<(Headline | null)[]>(() =>
    fillSlots(INITIAL_HEADLINES, INITIAL_SLOT_COUNT)
  );
  const [flipState, setFlipState] = useState<boolean[]>(() =>
    Array(INITIAL_SLOT_COUNT).fill(false)
  );

  const mosaicIndexRef = useRef(1);
  const isUpdatingRef = useRef(false);
  const seenUrlsRef = useRef<Set<string>>(new Set());
  const slotsRef = useRef(slots);
  const headlinesRef = useRef(headlines);
  const layoutRef = useRef(layout);

  slotsRef.current = slots;
  headlinesRef.current = headlines;
  layoutRef.current = layout;

  const slotCount = slotCountFor(layout);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const applySize = () => {
      const { width } = el.getBoundingClientRect();
      setLayout((prev) => {
        const next = computeMosaic(width);
        if (
          prev.cols === next.cols &&
          prev.rows === next.rows &&
          prev.hero === next.hero &&
          prev.gap === next.gap
        ) {
          return prev;
        }
        return next;
      });
    };

    applySize();
    const observer = new ResizeObserver(applySize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const applyHeadlines = (items: Headline[]) => {
      const shuffled = shuffleHeadlines(items);
      setHeadlines(shuffled);

      const count = slotCountFor(layoutRef.current);
      const initialSlots = fillSlots(shuffled, count);
      seenUrlsRef.current = new Set(
        initialSlots.filter(Boolean).map((h) => h!.url)
      );
      setSlots(initialSlots);
      setFlipState(Array(count).fill(false));
      mosaicIndexRef.current = 1;
      setIsLoading(false);
    };

    fetch(`${API_BASE_URL}/api/headline`)
      .then((res) => {
        if (!res.ok) throw new Error(`headline fetch failed (${res.status})`);
        return res.json();
      })
      .then((data) => {
        const items = Array.isArray(data?.headlines)
          ? data.headlines.filter(
              (entry: { url?: unknown }) =>
                typeof entry?.url === "string" && entry.url.length > 0
            )
          : [];

        if (items.length === 0) {
          if (IS_DEV) applyHeadlines(DEV_DUMMY_HEADLINES);
          else {
            setHeadlines([]);
            setIsLoading(false);
          }
          return;
        }

        applyHeadlines(items);
      })
      .catch(() => {
        if (IS_DEV) {
          applyHeadlines(DEV_DUMMY_HEADLINES);
        } else {
          setIsLoading(false);
        }
      });
  }, []);

  useEffect(() => {
    setSlots((prev) => {
      if (prev.length === slotCount) return prev;

      const next = fillSlots(
        [
          ...prev.filter((item): item is Headline => item !== null),
          ...headlines.filter(
            (h) => !prev.some((item) => item?.url === h.url)
          ),
        ],
        slotCount
      );
      seenUrlsRef.current = new Set(
        next.filter(Boolean).map((h) => h!.url)
      );
      return next;
    });
    setFlipState(Array(slotCount).fill(false));
    mosaicIndexRef.current = 1;
  }, [slotCount, headlines]);

  useEffect(() => {
    if (!headlines.length) return;

    const rotateSlot = (slotIndex: number) => {
      if (isUpdatingRef.current) return;
      const current = slotsRef.current;
      const pool = headlinesRef.current;
      const count = current.length;
      if (slotIndex < 0 || slotIndex >= count) return;

      const usedUrls = current.filter(Boolean).map((s) => s!.url);
      let candidates = pool.filter(
        (h) => !seenUrlsRef.current.has(h.url) && !usedUrls.includes(h.url)
      );
      if (candidates.length === 0) {
        candidates = pool.filter((h) => !usedUrls.includes(h.url));
      }
      if (candidates.length === 0) {
        candidates = pool.filter((h) => h.url !== current[slotIndex]?.url);
      }
      if (candidates.length === 0) return;

      const nextHeadline =
        candidates[Math.floor(Math.random() * candidates.length)];

      isUpdatingRef.current = true;
      setFlipState((prev) => {
        const next = [...prev];
        if (slotIndex < next.length) next[slotIndex] = true;
        return next;
      });

      window.setTimeout(() => {
        setSlots((prev) => {
          const next = [...prev];
          if (slotIndex < next.length) next[slotIndex] = nextHeadline;
          return next;
        });
        seenUrlsRef.current.add(nextHeadline.url);
        setFlipState((prev) => {
          const next = [...prev];
          if (slotIndex < next.length) next[slotIndex] = false;
          return next;
        });
        isUpdatingRef.current = false;
      }, ANIMATION_MS / 2);
    };

    const tileTimer = window.setInterval(() => {
      const count = slotsRef.current.length;
      if (count <= 1) {
        rotateSlot(0);
        return;
      }
      const start = layoutRef.current.hero ? 1 : 0;
      const idx =
        start +
        (mosaicIndexRef.current % Math.max(1, count - start));
      mosaicIndexRef.current += 1;
      rotateSlot(idx);
    }, TILE_INTERVAL);

    const heroTimer = window.setInterval(() => {
      if (layoutRef.current.hero) rotateSlot(0);
    }, HERO_INTERVAL);

    return () => {
      window.clearInterval(tileTimer);
      window.clearInterval(heroTimer);
    };
  }, [headlines]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden bg-[#050505]"
    >
      <div
        className="home-headline-grid absolute inset-2 grid h-auto sm:inset-3 lg:inset-4"
        style={{
          gap: layout.gap,
          gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: slotCount }).map((_, idx) => {
          const isHero = layout.hero && idx === 0;
          return (
            <div
              key={`slot-${idx}`}
              className="h-full min-h-0 min-w-0 w-full"
              style={
                isHero
                  ? { gridColumn: "span 2", gridRow: "span 2" }
                  : undefined
              }
            >
              <HeadlineTile
                item={slots[idx] ?? null}
                flipping={Boolean(flipState[idx])}
                hero={isHero}
                loading={isLoading}
              />
            </div>
          );
        })}
      </div>
      <div className="home-film-grain pointer-events-none absolute inset-0" aria-hidden />
    </div>
  );
}
