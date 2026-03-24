"use client";

import { useGalleryStore } from "@/stores/useGalleryStore";
import { PRINT_TEMPLATES } from "@/lib/printTemplates";

export function TemplateSelector() {
  const { printTemplate, setPrintTemplate } = useGalleryStore();

  if (!printTemplate) return null;

  return (
    <div className="flex gap-3">
      {PRINT_TEMPLATES.map((tpl) => (
        <button
          key={tpl.id}
          onClick={() => setPrintTemplate(tpl)}
          className={`px-4 py-2 rounded ${
            printTemplate.id === tpl.id
              ? "bg-green-600 text-white"
              : "bg-white/10 text-white"
          }`}
        >
          {tpl.label}
        </button>
      ))}
    </div>
  );
}