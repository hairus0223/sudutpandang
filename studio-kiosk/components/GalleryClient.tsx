"use client";

import { useCallback, useEffect, useState } from "react";
import { useNewPhotoSocket } from "@/hooks/useNewPhotoSocket";
import { usePhotoProcessedSocket } from "@/hooks/usePhotoProcessedSocket";
import { useAiGenerationSocket } from "@/hooks/useAiGenerationSocket";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchImages } from "@/services/image.service";
import { requestAiGenerate } from "@/services/ai.service";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { GallerySelfPhotoGrid } from "@/components/gallery/GallerySelfPhotoGrid";
import { PhotoModal } from "@/components/modals/PhotoModal";
import { BottomPrintBar } from "@/components/bottom/BottomPrintBar";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import { GallerySkeleton } from "@/components/gallery/GallerySkeleton";
import { GalleryAiWizard } from "@/components/gallery/GalleryAiWizard";
import { ConnectionBanner } from "@/components/kiosk/ConnectionBanner";
import { API_BASE_URL } from "@/lib/env";
import { resolveGalleryPreviewUrl } from "@/lib/resolveImageUrl";
import { PRINT_TEMPLATES } from "@/lib/printTemplates";
import { useSocketStatus } from "@/hooks/useSocketStatus";
import { useToast } from "@/components/ui/ToastProvider";
import { getPackageLabel } from "@/lib/packageTypes";
import type { PackageType } from "@/lib/imageTypes";
import { ArrowLeft, ImageOff, Sparkles } from "lucide-react";

export default function GalleryClient() {
  const router = useRouter();
  const params = useSearchParams();
  const user = params.get("user") ?? "";
  const { toast } = useToast();
  const connected = useSocketStatus(Boolean(user));

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [pendingRevealImageId, setPendingRevealImageId] = useState<string | null>(
    null
  );
  const [aiActivePhase, setAiActivePhase] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const {
    images,
    setImages,
    setAllowedPrint,
    setPrintTemplate,
    setPackageType,
    setAiQuota,
    setSessionTheme,
    loadPersistedSheetTransforms,
    selectedForPrint,
    printVariantByFilename,
    selectedImageIds,
    toggleGallerySelection,
    allowedPrint,
    packageType,
    aiGenerateRemaining,
    aiGenerateLimit,
    aiThemeId,
    aiThemeLabel,
    aiThemeLocked,
    aiThemePreviewUrl,
    aiThemeType,
  } = useGalleryStore();

  const refreshGallery = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetchImages(user);
      setImages(res.images);
    } catch (err) {
      console.error(err);
      toast("Gagal memuat galeri. Periksa koneksi API.", "error");
    } finally {
      setLoading(false);
    }
  }, [user, setImages, toast]);

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

  useAiGenerationSocket({
    user,
    enabled: Boolean(user) && packageType === "ai-self-photo",
    onProgress: (payload) => {
      setAiActivePhase(payload.phase ?? "processing");
      void refreshGallery();
    },
    onComplete: (payload) => {
      setAiActivePhase(null);
      if (payload.status === "ready") {
        toast("Hasil AI siap!", "success");
        setPendingRevealImageId(payload.imageId);
      } else if (payload.error) {
        toast(payload.error, "error");
      }
      void refreshGallery();
    },
  });

  useEffect(() => {
    if (!user) return;

    fetch(`${API_BASE_URL}/api/print-config/${user}`)
      .then((r) => {
        if (!r.ok) throw new Error("print_config_failed");
        return r.json();
      })
      .then((d) => {
        setAllowedPrint(d.allowedPrint);
        setPackageType((d.packageType ?? "self-photo") as PackageType);
        setAiQuota({
          limit: d.aiGenerateLimit ?? 0,
          used: d.aiGenerateUsed ?? 0,
          remaining: d.aiGenerateRemaining ?? 0,
        });
        setSessionTheme({
          aiThemeId: d.aiThemeId ?? null,
          aiThemeLabel: d.aiThemeLabel ?? null,
          aiThemeLocked: Boolean(d.aiThemeLocked),
          aiThemePreviewUrl: d.aiThemePreviewUrl ?? null,
          aiThemeType: d.aiThemeType ?? null,
        });
        if (d.name) setCustomerName(String(d.name));

        const tpl = PRINT_TEMPLATES.find((t) => t.id === d.templateId);
        if (tpl) {
          setPrintTemplate(tpl);
        }
      })
      .catch(() => {
        toast("Konfigurasi cetak tidak ditemukan.", "error");
      });
  }, [
    user,
    setAllowedPrint,
    setPackageType,
    setAiQuota,
    setSessionTheme,
    setPrintTemplate,
    toast,
  ]);

  const isAiPackage = packageType === "ai-self-photo";

  return (
    <>
      <ConnectionBanner connected={connected} />
      <main className="p-3 sm:p-4 pb-28 sm:pb-32 max-w-[1960px] mx-auto min-h-screen">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-sm sm:text-base text-white/90 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" /> Kembali
          </button>

          <div className="flex flex-wrap items-center gap-3 text-sm sm:text-base text-white/50">
            {user && (
              <span>
                Customer: <b className="text-white/80">{customerName || user}</b>
              </span>
            )}
            <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-white/70">
              {getPackageLabel(packageType)}
            </span>
            {isAiPackage && aiThemeLabel ? (
              <span className="rounded-full bg-violet-500/10 px-2.5 py-0.5 text-xs text-violet-200">
                {aiThemeLabel}
                {aiThemeLocked ? " 🔒" : ""}
              </span>
            ) : null}
            {isAiPackage && aiGenerateLimit > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2.5 py-0.5 text-xs text-violet-200">
                <Sparkles className="size-3" />
                AI {aiGenerateRemaining}/{aiGenerateLimit} tersisa
              </span>
            ) : null}
            <span>
              Total: <b className="text-white/80">{images.length}</b>
            </span>
            {selectedImageIds.length > 0 ? (
              <span className={isAiPackage ? "text-violet-300" : "text-[#E8C872]"}>
                {selectedImageIds.length} foto terpilih
              </span>
            ) : null}
            {selectedForPrint.length > 0 && (
              <span className="text-[#E8C872]">
                {selectedForPrint.length}/{allowedPrint} dipilih
                {selectedForPrint.some(
                  (f) => printVariantByFilename[f] === "ai"
                ) ? (
                  <span className="ml-1 text-violet-300">
                    (
                    {
                      selectedForPrint.filter(
                        (f) => printVariantByFilename[f] === "ai"
                      ).length
                    }{" "}
                    AI)
                  </span>
                ) : null}
              </span>
            )}
          </div>
        </div>

        {!user && (
          <div className="flex flex-col items-center gap-3 py-20 text-white/50">
            <ImageOff className="size-10" />
            <p>Masukkan nama customer dari beranda → Akses Foto</p>
          </div>
        )}

        {user && loading && <GallerySkeleton />}

        {user && !loading && images.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-20 text-center text-white/50">
            <ImageOff className="size-10" />
            <p>Belum ada foto untuk sesi ini.</p>
            <p className="text-sm">Capture dari layar sesi operator akan muncul otomatis.</p>
          </div>
        )}

        {user && !loading && images.length > 0 && isAiPackage ? (
          <GalleryAiWizard
            user={user}
            userName={customerName || user}
            images={images}
            aiThemeId={aiThemeId}
            aiThemeLabel={aiThemeLabel}
            aiThemeLocked={aiThemeLocked}
            aiThemePreviewUrl={aiThemePreviewUrl}
            aiThemeType={aiThemeType}
            aiGenerateRemaining={aiGenerateRemaining}
            aiGenerateLimit={aiGenerateLimit}
            activePhase={aiActivePhase}
            onOpenPhoto={setActiveIndex}
            onRefresh={() => void refreshGallery()}
            onQuotaChange={(remaining, used) =>
              setAiQuota({
                limit: aiGenerateLimit,
                used,
                remaining,
              })
            }
            pendingRevealImageId={pendingRevealImageId}
            onRevealDismiss={() => setPendingRevealImageId(null)}
          />
        ) : null}

        {user && !loading && images.length > 0 && !isAiPackage ? (
          <GallerySelfPhotoGrid
            userName={customerName || user}
            images={images}
            onOpenPhoto={setActiveIndex}
          />
        ) : null}

        <PhotoModal
          open={activeIndex !== null}
          index={activeIndex}
          images={images}
          onClose={() => setActiveIndex(null)}
          onChange={setActiveIndex}
          aiMode={isAiPackage}
          selectedImageIds={selectedImageIds}
          onToggleGallerySelection={toggleGallerySelection}
          generating={generatingAi}
          onGenerateAi={
            isAiPackage && user
              ? async (imageId) => {
                  setGeneratingAi(true);
                  try {
                    const result = await requestAiGenerate({ user, imageId });
                    if (result.quota) {
                      setAiQuota({
                        limit: aiGenerateLimit,
                        used: result.quota.used,
                        remaining: result.quota.remaining,
                      });
                    }
                    if (result.status === "ready") {
                      toast("Hasil AI siap!", "success");
                      setPendingRevealImageId(imageId);
                    } else {
                      toast("Generate AI dimulai…", "default");
                    }
                    await refreshGallery();
                  } catch (err) {
                    const code =
                      err instanceof Error ? err.message : "ai_generate_failed";
                    toast(
                      code === "quota_exhausted"
                        ? "Kuota AI habis."
                        : "Gagal memulai generate AI.",
                      "error"
                    );
                  } finally {
                    setGeneratingAi(false);
                  }
                }
              : undefined
          }
        />

        <BottomPrintBar
          onContinue={() =>
            router.push(`/print?user=${encodeURIComponent(user)}`)
          }
        />
        <ScrollToTop />
      </main>
    </>
  );
}
