"use client";

import { useEffect, useState, useRef } from "react";
import { AccessForm } from "./AccessForm";
import { API_BASE_URL } from "@/lib/env";
import { DEV_DUMMY_HEADLINES, IS_DEV } from "@/lib/devHeadlines";
import { PhotoCard } from "../cards/PhotoCard";
import Link from "next/link";

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
  const [slots, setSlots] = useState<(Headline | null)[]>(
    Array(SLOT_COUNT).fill(null)
  );
  const [flipState, setFlipState] = useState<boolean[]>(
    Array(SLOT_COUNT).fill(false)
  );
  const [activeForm, setActiveForm] = useState<"access" | null>(null);

  const slotIndexRef = useRef(0); // ⬅️ SEQUENTIAL
  const isUpdatingRef = useRef(false);
  const seenUrlsRef = useRef<Set<string>>(new Set());

  /* ---------------------------------- */
  /* Fetch headlines & init slots */
  /* ---------------------------------- */
  useEffect(() => {
    const applyHeadlines = (items: Headline[]) => {
      const shuffled = shuffleHeadlines(items);
      setHeadlines(shuffled);

      const initialSlots = shuffled.slice(0, SLOT_COUNT);
      initialSlots.forEach((h) => seenUrlsRef.current.add(h.url));
      setSlots(initialSlots);
    };

    const applyDevDummyHeadlines = () => {
      applyHeadlines(DEV_DUMMY_HEADLINES);
    };

    fetch(`${API_BASE_URL}/api/headline`)
      .then((res) => {
        if (!res.ok) throw new Error(`headline fetch failed (${res.status})`);
        return res.json();
      })
      .then((data) => {
        const headlines = Array.isArray(data?.headlines) ? data.headlines : [];

        if (headlines.length === 0 && IS_DEV) {
          applyDevDummyHeadlines();
          return;
        }

        applyHeadlines(headlines);
      })
      .catch(() => {
        if (IS_DEV) {
          applyDevDummyHeadlines();
        }
      });
  }, []);

  /* ---------------------------------- */
  /* Sequential rotation logic */
  /* ---------------------------------- */
  useEffect(() => {
    if (!headlines.length) return;

    const interval = setInterval(() => {
      if (isUpdatingRef.current) return;
      isUpdatingRef.current = true;

      const slotIndex = slotIndexRef.current;
      const usedUrls = slots
        .filter(Boolean)
        .map((s) => s!.url);

      /* PRIORITY 1: never shown before */
      let candidates = headlines.filter(
        (h) =>
          !seenUrlsRef.current.has(h.url) &&
          !usedUrls.includes(h.url)
      );

      /* PRIORITY 2: already shown, but not visible */
      if (candidates.length === 0) {
        candidates = headlines.filter(
          (h) => !usedUrls.includes(h.url)
        );
      }

      /* FALLBACK: do nothing */
      if (candidates.length === 0) {
        isUpdatingRef.current = false;
        slotIndexRef.current = (slotIndex + 1) % SLOT_COUNT;
        return;
      }

      const nextHeadline =
        candidates[Math.floor(Math.random() * candidates.length)];

      /* Flip + Fade out */
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

        /* Flip + Fade in */
        setFlipState((prev) => {
          const next = [...prev];
          next[slotIndex] = false;
          return next;
        });

        isUpdatingRef.current = false;

        // ⬅️ PASTI URUT 1 → 6
        slotIndexRef.current =
          (slotIndex + 1) % SLOT_COUNT;
      }, ANIMATION_MS / 2);
    }, INTERVAL);

    return () => clearInterval(interval);
  }, [headlines, slots]);

  /* ---------------------------------- */
  /* UI */
  /* ---------------------------------- */
  return (
    <div className="relative flex min-h-0 flex-1 w-full flex-col bg-black">
      {!activeForm && (
        <>
          <div className="flex flex-1 min-h-0 w-full items-center justify-center p-2">
            <div className="grid h-full w-full max-w-[1920px] max-h-[1080px] grid-cols-2 sm:grid-cols-3 grid-rows-2 sm:grid-rows-2 gap-1 sm:gap-2">
              {slots.map((item, idx) => (
                <div
                  key={idx}
                  className="relative h-full w-full overflow-hidden perspective"
                >
                  <div
                    className={`absolute inset-0 transform-gpu transition-all duration-400 ease-in-out
                      ${
                        flipState[idx]
                          ? "rotate-y-90 opacity-0"
                          : "rotate-y-0 opacity-100"
                      }`}
                    style={{
                      transformStyle: "preserve-3d",
                      backfaceVisibility: "hidden",
                    }}
                  >
                    {item && (
                      <PhotoCard
                        src={item.url}
                        filename={item.filename}
                        onClick={() => console.log("Clicked", item.filename)}
                        hideFilename={true}
                        hidePrintToggle={true}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer — operator actions */}
          <div className="fixed bottom-4 left-4 right-4 z-50 flex flex-wrap items-end justify-between gap-3 sm:bottom-6 sm:left-6 sm:right-6">
            <p className="max-w-xs text-xs text-white/45">
              Self Photo Studio · operator controls
            </p>
            <div className="flex flex-wrap gap-2 sm:gap-3 justify-end">
              <Link href="/admin/ai-theme-research">
                <button
                  type="button"
                  className="min-h-11 rounded-lg border border-violet-400/40 bg-violet-500/10 px-5 py-2.5 text-sm text-violet-100 hover:bg-violet-500/20 sm:px-6 sm:text-base"
                >
                  AI Research
                </button>
              </Link>
              <Link href="/session">
                <button
                  type="button"
                  className="min-h-11 rounded-lg bg-[#B59240] px-5 py-2.5 text-sm font-semibold text-black shadow-lg hover:bg-[#C9A855] sm:px-6 sm:text-base"
                >
                  Mulai Sesi
                </button>
              </Link>
              <button
                type="button"
                onClick={() => setActiveForm("access")}
                className="min-h-11 rounded-lg border border-white/20 bg-white/10 px-5 py-2.5 text-sm text-white hover:bg-white/15 sm:px-6 sm:text-base"
              >
                Akses Foto
              </button>
            </div>
          </div>
        </>
      )}

      {activeForm && (
        <div className="flex h-full w-full items-center justify-center p-4">
          {activeForm === "access" && <AccessForm />}

          <button
            onClick={() => setActiveForm(null)}
            className="z-[9999] fixed bottom-4 right-4 sm:bottom-6 sm:right-6 rounded bg-gray-800 px-4 py-2 text-sm sm:text-base text-white hover:bg-gray-900"
          >
            Back
          </button>
        </div>
      )}
    </div>
  );
}
