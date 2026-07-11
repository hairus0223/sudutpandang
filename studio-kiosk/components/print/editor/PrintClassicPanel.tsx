"use client";

import { useGalleryStore } from "@/stores/useGalleryStore";
import { PRINT_TEMPLATES } from "@/lib/printTemplates";
import { PanelSection, panelScrollClass, panelShellClass } from "./printEditorUi";
import { PrintModeToggle } from "./PrintModeToggle";
import { cn } from "@/lib/utils";

export function PrintClassicPanel({ embedded = false }: { embedded?: boolean }) {
  const { printTemplate, setPrintTemplate } = useGalleryStore();

  const body = (
    <div className={embedded ? "flex flex-col gap-4" : panelScrollClass}>
      <div className="flex flex-col gap-4">
        <PrintModeToggle />
        <PanelSection title="Ukuran halaman" description="Pilih layout 4R">
          <div className="flex flex-col gap-1.5">
            {PRINT_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => setPrintTemplate(tpl)}
                className={cn(
                  "flex min-h-[44px] items-center rounded-lg border px-3 py-2 text-left text-sm transition",
                  printTemplate.id === tpl.id
                    ? "border-violet-500/60 bg-violet-600/20 text-white"
                    : "border-white/10 bg-white/5 text-white/80 hover:border-white/20"
                )}
              >
                {tpl.label}
              </button>
            ))}
          </div>
        </PanelSection>
      </div>
    </div>
  );

  if (embedded) return body;

  return (
    <aside
      className={cn(
        panelShellClass,
        "w-full shrink-0 border-r md:w-[240px] lg:w-[280px] xl:w-[300px]"
      )}
    >
      <div className="border-b border-white/10 px-3 py-2.5">
        <p className="text-sm font-medium text-white">Template</p>
        <p className="text-[11px] text-white/45">Mode cetak klasik</p>
      </div>
      {body}
    </aside>
  );
}
