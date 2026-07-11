"use client";

import { useGalleryStore } from "@/stores/useGalleryStore";
import { SegmentedControl } from "./printEditorUi";

export function PrintModeToggle() {
  const { printMode, setPrintMode } = useGalleryStore();

  return (
    <SegmentedControl
      value={printMode}
      onChange={setPrintMode}
      options={[
        { id: "classic", label: "Klasik 4R" },
        { id: "sheet", label: "Cetak Lembar" },
      ]}
    />
  );
}
