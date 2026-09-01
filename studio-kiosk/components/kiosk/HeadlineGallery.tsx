"use client";

import { useEffect, useState, useRef } from "react";
import { API_BASE_URL } from "@/lib/env";
import { DEV_DUMMY_HEADLINES, IS_DEV } from "@/lib/devHeadlines";
import { PhotoCard } from "../cards/PhotoCard";
import { cn } from "@/lib/utils";

type Headline = {
  filename: string;
  url: string;
};

function shuffleHeadlines(items: Headline[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

const SLOT_COUNT = 6;
const INTERVAL = 4000;
const ANIMATION_MS = 400;

export function HeadlineGallery() {
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [slots, setSlots] = useState<(Headline | null)[]>(
    Array(SLOT_COUNT).fill(null)
  );
  const [flipState, setFlipState] = useState<boolean[]>(
    Array(SLOT_COUNT).fill(false)
  );

  const slotIndexRef = useRef(0);
  const isUpdatingRef = useRef(false);
  const seenUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const applyHeadlines = (items: Headline[]) => {
      const shuffled = shuffleHeadlines(items);
      setHeadlines(shuffled);

      const initialSlots = shuffled.slice(0, SLOT_COUNT);
      seenUrlsRef.current = new Set(initialSlots.map((h) => h.url));
      setSlots(initialSlots);
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
    if (!headlines.length) return;

    const interval = setInterval(() => {
      if (isUpdatingRef.current) return;
      isUpdatingRef.current = true;

      const slotIndex = slotIndexRef.current;
      const usedUrls = slots.filter(Boolean).map((s) => s!.url);

      let candidates = headlines.filter(
        (h) => !seenUrlsRef.current.has(h.url) && !usedUrls.includes(h.url)
      );

      if (candidates.length === 0) {
        candidates = headlines.filter((h) => !usedUrls.includes(h.url));
      }

      if (candidates.length === 0) {
        isUpdatingRef.current = false;
        slotIndexRef.current = (slotIndex + 1) % SLOT_COUNT;
        return;
      }

      const nextHeadline =
        candidates[Math.floor(Math.random() * candidates.length)];

      setFlipState((prev) => {
        const next = [...prev];
        next[slotIndex] = true;
        return next;
      });

      setTimeout(() => {
        setSlots((prev) => {
          const next = [...prev];
          next[slotIndex] = nextHeadline;
          return next;
        });

        seenUrlsRef.current.add(nextHeadline.url);

        setFlipState((prev) => {
          const next = [...prev];
          next[slotIndex] = false;
          return next;
        });

        isUpdatingRef.current = false;
        slotIndexRef.current = (slotIndex + 1) % SLOT_COUNT;
      }, ANIMATION_MS / 2);
    }, INTERVAL);

    return () => clearInterval(interval);
  }, [headlines, slots]);

  return (
    <div className="absolute inset-0 grid grid-cols-2 grid-rows-3 gap-1 sm:grid-cols-3 sm:grid-rows-2 sm:gap-1.5">
      {Array.from({ length: SLOT_COUNT }).map((_, idx) => {
        const item = slots[idx];

        return (
          <div
            key={idx}
            className="perspective relative min-h-0 overflow-hidden bg-[#111]"
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
  );
}
