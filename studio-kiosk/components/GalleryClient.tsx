"use client";

import { useCallback, useEffect, useState } from "react";
import { useNewPhotoSocket } from "@/hooks/useNewPhotoSocket";
import { usePhotoProcessedSocket } from "@/hooks/usePhotoProcessedSocket";
import { useImageProcessing } from "@/hooks/useImageProcessing";
import { countProcessingImages } from "@/lib/processingLabels";
import { useThemes } from "@/hooks/useThemes";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchImages, uploadImage } from "@/services/image.service";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { PhotoCard } from "@/components/cards/PhotoCard";
import { InfoCard } from "@/components/cards/InfoCard";
import { PhotoModal } from "@/components/modals/PhotoModal";
import { GalleryAiToolbar } from "@/components/gallery/GalleryAiToolbar";
import { BottomPrintBar } from "@/components/bottom/BottomPrintBar";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import { API_BASE_URL } from "@/lib/env";
import {
  hasSubjectVariant,
  resolveGalleryPreviewUrl,
  type GalleryPreviewVariant,
} from "@/lib/resolveImageUrl";
import { PRINT_TEMPLATES } from "@/lib/printTemplates";
import { configurePasPhotoPrintDefaults } from "@/lib/passportPrint";
import { normalizeLookId } from "@/lib/lookPresets";
import { ArrowLeft } from "lucide-react";

export default function GalleryClient() {
  const router = useRouter();
  const params = useSearchParams();
  const user = params.get("user") ?? "";

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [sessionThemeId, setSessionThemeId] = useState<string | undefined>();
  const [previewVariant, setPreviewVariant] =
    useState<GalleryPreviewVariant>("auto");
  const [uploading, setUploading] = useState(false);
  const {
    images,
    setImages,
    setAllowedPrint,
    setPrintTemplate,
    setPackageType,
    setPrintMode,
    setSheetRecipe,
    loadPersistedSheetTransforms,
    packageType,
    setSessionLookId,
  } = useGalleryStore();

  const { themeGroups, loading: themesLoading } = useThemes();

  const refreshGallery = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetchImages(user);
      setImages(res.images);
    } catch (err) {
      console.error(err);
    }
  }, [user, setImages]);

  const handleProcessingError = useCallback((message: string) => {
    alert(message);
  }, []);

  const {
    selectedThemeId,
    setSelectedThemeId,
    runRemoveBackground,
    runApplyTheme,
    isProcessing,
    isBusy,
  } = useImageProcessing({
    user,
    enabled: Boolean(user),
    initialThemeId: sessionThemeId,
    onRefresh: refreshGallery,
    onError: handleProcessingError,
  });

  const handleUpload = useCallback(
    async (file: File) => {
      if (!user || uploading || isBusy) return;

      setUploading(true);
      try {
        await uploadImage(user, file);
        await refreshGallery();
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Upload foto gagal. Silakan coba lagi.";
        alert(message);
      } finally {
        setUploading(false);
      }
    },
    [user, uploading, isBusy, refreshGallery]
  );

  useEffect(() => {
    void refreshGallery();
  }, [refreshGallery]);

  useEffect(() => {
    if (!user) return;
    loadPersistedSheetTransforms(user);
  }, [user, loadPersistedSheetTransforms]);

  useNewPhotoSocket({
    user,
    enabled: Boolean(user),
    onNewPhoto: () => {
      void refreshGallery();
    },
  });

  usePhotoProcessedSocket({
    user,
    enabled: Boolean(user),
    onPhotoProcessed: () => {
      void refreshGallery();
    },
  });

  const processingCount = countProcessingImages(images);

  useEffect(() => {
    if (!user || processingCount === 0) return;

    const timer = window.setInterval(() => {
      void refreshGallery();
    }, 4000);

    return () => window.clearInterval(timer);
  }, [user, processingCount, refreshGallery]);

  useEffect(() => {
    if (!user) return;

    fetch(`${API_BASE_URL}/api/print-config/${user}`)
      .then((r) => r.json())
      .then((d) => {
        setAllowedPrint(d.allowedPrint);
        const resolvedPackageType = d.packageType || "self-photo";
        setPackageType(resolvedPackageType);

        if (d.themeId) {
          setSessionThemeId(d.themeId);
          setSelectedThemeId(d.themeId);
        }

        setSessionLookId(normalizeLookId(d.lookId, resolvedPackageType));

        if (resolvedPackageType === "ai-photo") {
          setPreviewVariant("themed");
        }

        configurePasPhotoPrintDefaults({
          packageType: resolvedPackageType,
          passportSizeId: d.passportSizeId,
          setPrintMode,
          setSheetRecipe,
        });

        const tpl = PRINT_TEMPLATES.find((t) => t.id === d.templateId);
        if (tpl) {
          setPrintTemplate(tpl);
        }
      });
  }, [
    user,
    setAllowedPrint,
    setPackageType,
    setPrintTemplate,
    setPrintMode,
    setSheetRecipe,
    setSelectedThemeId,
    setSessionLookId,
  ]);

  return (
    <main className="p-3 sm:p-4 pb-28 sm:pb-32 max-w-[1960px] mx-auto min-h-screen">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-sm sm:text-base text-white/90 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" /> Kembali
        </button>

        <span className="text-white/50 text-sm sm:text-base">
          Total Foto: <b>{images.length}</b>
        </span>
      </div>

      {user && (
        <GalleryAiToolbar
          packageType={packageType}
          sessionThemeId={sessionThemeId}
          selectedThemeId={selectedThemeId}
          onThemeChange={setSelectedThemeId}
          onUpload={handleUpload}
          uploading={uploading}
          previewVariant={previewVariant}
          onPreviewVariantChange={setPreviewVariant}
          themeGroups={themeGroups}
          themesLoading={themesLoading}
          isBusy={isBusy || uploading}
          processingCount={processingCount}
        />
      )}

      <div className="columns-1 sm:columns-2 xl:columns-3 2xl:columns-4 gap-3 sm:gap-4">
        <InfoCard userName={user} />

        {images.map((img, index) => {
          const imageId = img.imageId ?? "";
          const processing = isProcessing(imageId);

          return (
            <PhotoCard
              key={img.filename}
              src={resolveGalleryPreviewUrl(img, packageType, previewVariant)}
              filename={img.filename}
              processingStatus={img.processingStatus}
              processingPhase={img.processingPhase}
              packageType={packageType}
              processingError={img.processingError}
              onRemoveBackground={
                img.imageId
                  ? () => void runRemoveBackground(img.imageId!)
                  : undefined
              }
              removeBackgroundLoading={processing}
              showApplyTheme={hasSubjectVariant(img)}
              onApplyTheme={
                img.imageId
                  ? () => void runApplyTheme(img.imageId!)
                  : undefined
              }
              applyThemeLoading={processing}
              onClick={() => setActiveIndex(index)}
            />
          );
        })}
      </div>

      <PhotoModal
        open={activeIndex !== null}
        index={activeIndex}
        images={images}
        packageType={packageType}
        previewVariant={previewVariant}
        onPreviewVariantChange={setPreviewVariant}
        onClose={() => setActiveIndex(null)}
        onChange={setActiveIndex}
        onRemoveBackground={(imageId) => void runRemoveBackground(imageId)}
        onApplyTheme={(imageId) => void runApplyTheme(imageId)}
        isProcessing={isProcessing}
      />

      <BottomPrintBar
        onContinue={() =>
          router.push(`/print?user=${encodeURIComponent(user)}`)
        }
      />
      <ScrollToTop />
    </main>
  );
}
