"use client";

import { useEffect, useState } from "react";
import { useGalleryStore, type ImageData } from "@/stores/useGalleryStore";
import { cn } from "@/lib/utils";
import {
  panelScrollClass,
  panelShellClass,
} from "./printEditorUi";
import { PrintAdjustPanel } from "./PrintAdjustPanel";
import { PrintFilterPanel } from "./PrintFilterPanel";

type InspectorTab = "adjust" | "filter";

export function PrintInspectorPanel({ images }: { images: ImageData[] }) {
  const { printMode } = useGalleryStore();
  const [tab, setTab] = useState<InspectorTab>(
    printMode === "sheet" ? "adjust" : "filter"
  );

  useEffect(() => {
    if (printMode !== "sheet" && tab === "adjust") {
      setTab("filter");
    }
  }, [printMode, tab]);

  const tabs: { id: InspectorTab; label: string; sheetOnly?: boolean }[] =
    printMode === "sheet"
      ? [
          { id: "adjust", label: "Sesuaikan" },
          { id: "filter", label: "Filter" },
        ]
      : [{ id: "filter", label: "Filter" }];

  const activeTab = printMode === "sheet" ? tab : "filter";

  return (
    <aside
      className={cn(
        panelShellClass,
        "w-full shrink-0 border-l md:w-[220px] lg:w-[260px] xl:w-[280px]"
      )}
    >
      <div className="border-b border-white/10 px-2 py-2">
        <div className="flex gap-1 rounded-lg bg-white/5 p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "min-h-[36px] flex-1 rounded-md text-xs font-medium transition",
                activeTab === t.id
                  ? "bg-violet-600 text-white"
                  : "text-white/65 hover:bg-white/10 hover:text-white"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className={panelScrollClass}>
        {activeTab === "adjust" ? (
          <PrintAdjustPanel images={images} />
        ) : (
          <PrintFilterPanel images={images} />
        )}
      </div>
    </aside>
  );
}
