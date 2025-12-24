import React, { useState } from "react";
import PhotoEditorBox from "./PhotoEditorBox";

export default function PrintPreviewModal({
  open,
  images,
  onClose,
  onPrint
}) {
  if (!open) return null;

  const [template, setTemplate] = useState("single"); // single | double | grid
  const [editorData, setEditorData] = useState(
    images.map(() => ({
      crop: { x: 0, y: 0 },
      zoom: 1,
      rotation: 0,
      brightness: 100,
      contrast: 100
    }))
  );

  const setEdit = (i, data) => {
    const copy = [...editorData];
    copy[i] = data;
    setEditorData(copy);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">

      <div className="bg-white rounded-lg p-6 w-full max-w-5xl max-h-[90vh] overflow-auto">

        <h2 className="font-bold text-xl mb-4">Preview Cetak 4R</h2>

        {/* Template Selector */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setTemplate("single")}
            className={`px-4 py-2 rounded ${template==="single"?"bg-blue-600 text-white":"bg-gray-200"}`}
          >
            Template 1 Foto
          </button>

          <button
            onClick={() => setTemplate("double")}
            className={`px-4 py-2 rounded ${template==="double"?"bg-blue-600 text-white":"bg-gray-200"}`}
          >
            Template 2 Foto
          </button>

          <button
            onClick={() => setTemplate("grid")}
            className={`px-4 py-2 rounded ${template==="grid"?"bg-blue-600 text-white":"bg-gray-200"}`}
          >
            Template Grid 2×2
          </button>
        </div>

        {/* Editor per foto */}
        <div className="space-y-6">
          {images.map((img, i) => (
            <PhotoEditorBox
              key={i}
              imageUrl={img}
              value={editorData[i]}
              onChange={(data) => setEdit(i, data)}
            />
          ))}
        </div>

        <div className="flex justify-end mt-6 gap-4">
          <button onClick={onClose} className="px-4 py-2 bg-gray-300 rounded">
            Batal
          </button>
          <button
            onClick={() => onPrint({ template, editorData })}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Print Sekarang
          </button>
        </div>

      </div>
    </div>
  );
}
