"use client";

import { useEffect, useLayoutEffect, useState, useRef } from "react";
import { API_BASE_URL } from "@/lib/env";
import { DEV_DUMMY_HEADLINES, IS_DEV } from "@/lib/devHeadlines";
import { PhotoCard } from "../cards/PhotoCard";
import { cn } from "@/lib/utils";

type Headline = {
  filename: string;
  url: string;
};

type PhotoGrid = {
  cols: number;
  rows: number;
  tileW: number;
  tileH: number;
  gap: number;
};

/** Portrait photo tiles: width / height = 3 / 5 */
const PHOTO_ASPECT = 3 / 5;
const MIN_COLS = 2;
const MIN_TILE_WIDTH = 88;
const MAX_SLOTS = 36;
const DESKTOP_MIN_WIDTH = 1024;
const DESKTOP_COLS = 6;
const DESKTOP_ROWS = 2;
const INTERVAL = 4000;
const ANIMATION_MS = 400;

function shuffleHeadlines(items: Headline[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function fillSlots(items: Headline[], count: number): (Headline | null)[] {
  if (items.length === 0) return Array.from({ length: count }, () => null);
  return Array.from({ length: count }, (_, i) => items[i % items.length]);
}

function layoutForCols(
  width: number,
  height: number,
  cols: number,
  gap: number
): PhotoGrid {
  const widthBasedTileW = (width - gap * (cols - 1)) / cols;
  const widthBasedTileH = widthBasedTileW / PHOTO_ASPECT;
  let rows = Math.max(1, Math.floor((height + gap) / (widthBasedTileH + gap)));
  while (cols * rows > MAX_SLOTS && rows > 1) rows -= 1;

  const fitted = fitTiles(width, height, cols, rows, gap);
  return { cols, rows, tileW: fitted.tileW, tileH: fitted.tileH, gap };
}

function computePhotoGrid(width: number, height: number): PhotoGrid {
  const gap = width < 640 ? 4 : width < 1280 ? 6 : 8;

  if (width <= 0 || height <= 0) {
    return { cols: 3, rows: 2, tileW: 160, tileH: 160 / PHOTO_ASPECT, gap };
  }

  if (width >= DESKTOP_MIN_WIDTH) {
    const fitted = fitTiles(width, height, DESKTOP_COLS, DESKTOP_ROWS, gap);
    return {
      cols: DESKTOP_COLS,
      rows: DESKTOP_ROWS,
      tileW: fitted.tileW,
      tileH: fitted.tileH,
      gap,
    };
  }

  const maxCols = Math.max(
    MIN_COLS,
    Math.min(12, Math.floor((width + gap) / (MIN_TILE_WIDTH + gap)))
  );

  let best: PhotoGrid & { coverage: number } = {
    cols: MIN_COLS,
    rows: 1,
    tileW: MIN_TILE_WIDTH,
    tileH: MIN_TILE_WIDTH / PHOTO_ASPECT,
    gap,
    coverage: -1,
  };

  for (let cols = MIN_COLS; cols <= maxCols; cols++) {
    const candidate = layoutForCols(width, height, cols, gap);
    if (candidate.tileW < MIN_TILE_WIDTH && cols > MIN_COLS) continue;

    const usedW = cols * candidate.tileW + (cols - 1) * gap;
    const usedH = candidate.rows * candidate.tileH + (candidate.rows - 1) * gap;
    const coverage = Math.min(1, (usedW * usedH) / (width * height));
    const slots = cols * candidate.rows;
    const bestSlots = best.cols * best.rows;
    const betterCoverage = coverage > best.coverage + 0.01;
    const sameCoverageMoreTiles =
      Math.abs(coverage - best.coverage) <= 0.01 && slots > bestSlots;

    if (betterCoverage || sameCoverageMoreTiles) {
      best = { ...candidate, coverage };
    }
  }

  const { coverage: _coverage, ...grid } = best;
  return grid;
}

function fitTiles(
  width: number,
  height: number,
  cols: number,
  rows: number,
  gap: number
) {
  const maxTileW = (width - gap * (cols - 1)) / cols;
  const maxTileH = (height - gap * (rows - 1)) / rows;

  if (maxTileW / maxTileH > PHOTO_ASPECT) {
    const tileH = maxTileH;
    return { tileW: tileH * PHOTO_ASPECT, tileH };
  }

  const tileW = maxTileW;
  return { tileW, tileH: tileW / PHOTO_ASPECT };
}

export function HeadlineGallery() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [grid, setGrid] = useState<PhotoGrid>(() =>
    typeof window === "undefined"
      ? computePhotoGrid(0, 0)
      : computePhotoGrid(window.innerWidth, window.innerHeight)
  );
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [slots, setSlots] = useState<(Headline | null)[]>(() =>
    fillSlots([], grid.cols * grid.rows)
  );
  const [flipState, setFlipState] = useState<boolean[]>(() =>
    Array(grid.cols * grid.rows).fill(false)
  );

  const slotIndexRef = useRef(0);
  const isUpdatingRef = useRef(false);
  const seenUrlsRef = useRef<Set<string>>(new Set());
  const slotCountRef = useRef(grid.cols * grid.rows);

  const slotCount = grid.cols * grid.rows;
  slotCountRef.current = slotCount;

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const applySize = () => {
      const { width, height } = el.getBoundingClientRect();
      const next = computePhotoGrid(width, height);
      setGrid((prev) => {
        if (
          prev.cols === next.cols &&
          prev.rows === next.rows &&
          prev.gap === next.gap &&
          Math.abs(prev.tileW - next.tileW) < 0.5 &&
          Math.abs(prev.tileH - next.tileH) < 0.5
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

      const count = slotCountRef.current;
      const initialSlots = fillSlots(shuffled, count);
      seenUrlsRef.current = new Set(
        initialSlots.filter(Boolean).map((h) => h!.url)
      );
      setSlots(initialSlots);
      setFlipState(Array(count).fill(false));
      slotIndexRef.current = 0;
      setIsLoading(false);
    };

    fetch(`${API_BASE_URL}/api/headline`)
      .then((res) => {
        if (!res.ok) throw new Error(`headline fetch failed (${res.status})`);
        return res.json();
      })
      .then((data) => {
        const items = Array.isArray(data?.headlines) ? data.headlines : [];

        if (items.length === 0 && IS_DEV) {
          applyHeadlines(DEV_DUMMY_HEADLINES);
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
    slotIndexRef.current = 0;
  }, [slotCount, headlines]);

  useEffect(() => {
    if (!headlines.length) return;

    const interval = setInterval(() => {
      if (isUpdatingRef.current) return;
      isUpdatingRef.current = true;

      const count = slotCountRef.current;
      const slotIndex = slotIndexRef.current % count;
      const usedUrls = slots.filter(Boolean).map((s) => s!.url);

      let candidates = headlines.filter(
        (h) => !seenUrlsRef.current.has(h.url) && !usedUrls.includes(h.url)
      );

      if (candidates.length === 0) {
        candidates = headlines.filter((h) => !usedUrls.includes(h.url));
      }

      if (candidates.length === 0) {
        candidates = headlines.filter((h) => h.url !== slots[slotIndex]?.url);
      }

      if (candidates.length === 0) {
        isUpdatingRef.current = false;
        slotIndexRef.current = (slotIndex + 1) % count;
        return;
      }

      const nextHeadline =
        candidates[Math.floor(Math.random() * candidates.length)];

      setFlipState((prev) => {
        const next = [...prev];
        if (slotIndex < next.length) next[slotIndex] = true;
        return next;
      });

      setTimeout(() => {
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
        slotIndexRef.current = (slotIndex + 1) % slotCountRef.current;
      }, ANIMATION_MS / 2);
    }, INTERVAL);

    return () => clearInterval(interval);
  }, [headlines, slots]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
    >
      <div
        className="grid"
        style={{
          width: grid.cols * grid.tileW + (grid.cols - 1) * grid.gap,
          height: grid.rows * grid.tileH + (grid.rows - 1) * grid.gap,
          gridTemplateColumns: `repeat(${grid.cols}, ${grid.tileW}px)`,
          gridTemplateRows: `repeat(${grid.rows}, ${grid.tileH}px)`,
          gap: grid.gap,
        }}
      >
        {Array.from({ length: slotCount }).map((_, idx) => {
          const item = slots[idx];

          return (
            <div
              key={idx}
              className="perspective relative min-h-0 overflow-hidden bg-[#111]"
              style={{ aspectRatio: "3 / 5" }}
            >
              {isLoading || !item ? (
                <div className="size-full animate-pulse bg-gradient-to-br from-white/[0.07] to-white/[0.02]" />
              ) : (
                <div
                  className={cn(
                    "absolute inset-0 transform-gpu transition-all duration-300 ease-in-out",
                    flipState[idx] ? "flip-hidden" : "flip-visible"
                  )}
                >
                  <PhotoCard
                    src={item.url}
                    filename={item.filename}
                    onClick={() => {}}
                    hideFilename
                    hidePrintToggle
                    compact
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
