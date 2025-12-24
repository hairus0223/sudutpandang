import React, { useState, useCallback } from "react";
import Cropper from "react-easy-crop";

export default function PhotoEditorBox({ imageUrl, value, onChange }) {
  const [crop, setCrop] = useState(value?.crop || { x: 0, y: 0 });
  const [zoom, setZoom] = useState(value?.zoom || 1);
  const [rotation, setRotation] = useState(value?.rotation || 0);
  const [brightness, setBrightness] = useState(value?.brightness || 100);
  const [contrast, setContrast] = useState(value?.contrast || 100);

  const handleCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    onChange({
      crop,
      zoom,
      rotation,
      brightness,
      contrast,
      croppedAreaPixels
    });
  }, [crop, zoom, rotation, brightness, contrast]);

  return (
    <div className="relative w-full h-[380px] bg-black rounded overflow-hidden">

      <Cropper
        image={imageUrl}
        crop={crop}
        zoom={zoom}
        rotation={rotation}
        aspect={2 / 3}
        onCropChange={setCrop}
        onZoomChange={setZoom}
        onRotationChange={setRotation}
        onCropComplete={handleCropComplete}
        cropShape="rect"
        objectFit="cover"
      />

      {/* Controls */}
      <div className="mt-3 space-y-3">

        <label className="text-sm text-gray-700">Zoom</label>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full"
        />

        <label className="text-sm text-gray-700">Rotate</label>
        <input
          type="range"
          min={-180}
          max={180}
          value={rotation}
          onChange={(e) => setRotation(Number(e.target.value))}
          className="w-full"
        />

        <label className="text-sm text-gray-700">Brightness</label>
        <input
          type="range"
          min={50}
          max={150}
          value={brightness}
          onChange={(e) => setBrightness(Number(e.target.value))}
          className="w-full"
        />

        <label className="text-sm text-gray-700">Contrast</label>
        <input
          type="range"
          min={50}
          max={150}
          value={contrast}
          onChange={(e) => setContrast(Number(e.target.value))}
          className="w-full"
        />

      </div>
    </div>
  );
}
