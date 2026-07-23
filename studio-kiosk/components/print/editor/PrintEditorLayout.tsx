"use client";

import { useEffect, useState } from "react";
import { LayoutGrid, SlidersHorizontal, Sparkles } from "lucide-react";
import { useGalleryStore, type ImageData } from "@/stores/useGalleryStore";
import { cn } from "@/lib/utils";
import { PrintEditorHeader } from "./PrintEditorHeader";
import { PrintLayoutPanel } from "./PrintLayoutPanel";
import { PrintClassicPanel } from "./PrintClassicPanel";
import { PrintInspectorPanel } from "./PrintInspectorPanel";
import { PrintAdjustPanel } from "./PrintAdjustPanel";
import { PrintFilterPanel } from "./PrintFilterPanel";
type MobileTab = "layout" | "adjust" | "filter";

export function PrintEditorLayout({
  images,
  children,
}: {
  images: ImageData[];
  children: React.ReactNode;
}) {
  const { printMode } = useGalleryStore();
  const [mobileTab, setMobileTab] = useState<MobileTab | null>(null);

  useEffect(() => {
    setMobileTab(null);
  }, [printMode]);

  const mobileTabs: {
    id: MobileTab;
    label: string;
    icon: React.ReactNode;
    sheetOnly?: boolean;
  }[] =
    printMode === "sheet"
      ? [
          { id: "layout", label: "Layout", icon: <LayoutGrid className="h-4 w-4" /> },
          {
            id: "adjust",
            label: "Sesuaikan",
            icon: <SlidersHorizontal className="h-4 w-4" />,
            sheetOnly: true,
          },
          { id: "filter", label: "Filter", icon: <Sparkles className="h-4 w-4" /> },
        ]
      : [
          { id: "layout", label: "Template", icon: <LayoutGrid className="h-4 w-4" /> },
          { id: "filter", label: "Filter", icon: <Sparkles className="h-4 w-4" /> },
        ];

  const toggleMobileTab = (tab: MobileTab) => {
    setMobileTab((prev) => (prev === tab ? null : tab));
  };

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-neutral-900 text-white">
      <PrintEditorHeader images={images} />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="hidden h-full shrink-0 md:flex">
          {printMode === "sheet" ? (
            <PrintLayoutPanel images={images} />
          ) : (
            <PrintClassicPanel />
          )}
        </div>

        <main
          className={cn(
            "relative flex min-h-0 min-w-0 flex-1 flex-col items-center overflow-x-hidden overflow-y-auto",
            "justify-start px-2 py-4 sm:px-4 sm:py-5",
            mobileTab ? "pb-[min(42vh,360px)] md:pb-5" : "pb-16 md:pb-5"
          )}
        >
          <div className="flex w-full max-w-[min(100%,960px)] flex-col items-center">
            {children}
          </div>
        </main>

        <div className="hidden h-full shrink-0 md:flex">
          <PrintInspectorPanel images={images} />
        </div>
      </div>

      {mobileTab ? (
        <div
          className={cn(
            "fixed inset-x-0 bottom-14 z-30 max-h-[min(42vh,360px)] overflow-y-auto",
            "border-t border-white/10 bg-neutral-950/98 backdrop-blur md:hidden"
          )}
        >
          <div className="p-3">
            {mobileTab === "layout" ? (
              printMode === "sheet" ? (
                <PrintLayoutPanel images={images} embedded />
              ) : (
                <PrintClassicPanel embedded />
              )
            ) : null}
            {mobileTab === "adjust" && printMode === "sheet" ? (
              <PrintAdjustPanel images={images} />
            ) : null}
            {mobileTab === "filter" ? (
              <PrintFilterPanel images={images} />
            ) : null}
          </div>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/10 bg-neutral-950/95 backdrop-blur md:hidden">
        {mobileTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => toggleMobileTab(tab.id)}
            className={cn(
              "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition",
              mobileTab === tab.id
                ? "bg-violet-600/20 text-violet-200"
                : "text-white/55 hover:bg-white/5 hover:text-white"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
