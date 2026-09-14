"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  Loader2,
  CheckSquare,
  Square,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Printer,
} from "lucide-react";
import type { GalleryImageData, PrintVariant } from "@/lib/imageTypes";
import { requestAiGenerate } from "@/services/ai.service";
import {
  canGenerateAiSelection,
  countReadyAiResults,
  countUsedAiSlots,
  getAiResultUrl,
  getAiSelectionStatus,
  getImagesWithAiResults,
  getOriginalPreviewUrl,
} from "@/lib/aiGalleryUtils";
import { hasAiPrintVariant } from "@/lib/resolveImageUrl";
import { GalleryPhotoTile } from "@/components/gallery/GalleryPhotoTile";
import { GalleryPrintSelectionBar } from "@/components/gallery/GalleryPrintSelectionBar";
import { InfoCard } from "@/components/cards/InfoCard";
import { BeforeAfterReveal } from "@/components/gallery/BeforeAfterReveal";
import { AiResultRevealModal } from "@/components/gallery/AiResultRevealModal";
import {
  AiMissingThemeBanner,
  AiSessionBanner,
} from "@/components/gallery/AiSessionBanner";
import {
  AiWizardStepper,
  type AiWizardStep,
} from "@/components/gallery/AiWizardStepper";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/utils";
import {
  btnPrimary,
  btnGhost,
  toggleChipClass,
} from "@/lib/galleryUiStyles";
import { mapAiClientError } from "@/lib/aiUiCopy";
import { useGalleryStore } from "@/stores/useGalleryStore";

const PHASE_LABELS: Record<string, string> = {
  queued: "Antrian edit…",
  processing: "Masih mengedit…",
  segmenting: "Memisahkan subjek…",
  costume: "Mengedit pakaian…",
  generating: "Mengedit pakaian…",
  refining: "Menjaga wajah asli…",
  compositing: "Menyusun latar…",
  lighting: "Menyesuaikan cahaya…",
  finishing: "Finishing…",
  transform: "Mengedit foto…",
};

type GalleryAiWizardProps = {
  user: string;
  userName: string;
  images: GalleryImageData[];
  aiThemeId: string | null;
  aiThemeLabel: string | null;
  aiThemeLocked: boolean;
  aiThemePreviewUrl?: string | null;
  aiGenerateRemaining: number;
  aiGenerateLimit: number;
  activePhase?: string | null;
  onOpenPhoto: (index: number) => void;
  onRefresh: () => void;
  onQuotaChange?: (remaining: number, used: number) => void;
  pendingRevealImageId?: string | null;
  onRevealDismiss?: () => void;
};

function AiTileStatusBadge({
  status,
  error,
}: {
  status: string | null;
  error?: string | null;
}) {
  if (!status) return null;

  if (status === "ready") {
    return (
      <span className="absolute left-3 bottom-3 z-20 inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-medium text-white">
        <CheckCircle2 className="size-3" />
        Edit selesai
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span
        className="absolute left-3 bottom-3 z-20 inline-flex items-center gap-1 rounded-full bg-red-500/90 px-2 py-0.5 text-[10px] font-medium text-white"
        title={error || "Edit gagal"}
      >
        <AlertCircle className="size-3" />
        Gagal
      </span>
    );
  }
  if (["pending", "queued", "processing"].includes(status)) {
    return (
      <span className="absolute left-3 bottom-3 z-20 inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-medium text-white">
        <Loader2 className="size-3 animate-spin" />
        Proses…
      </span>
    );
  }
  return null;
}

export function GalleryAiWizard({
  user,
  userName,
  images,
  aiThemeId,
  aiThemeLabel,
  aiThemeLocked,
  aiThemePreviewUrl = null,
  aiGenerateRemaining,
  aiGenerateLimit,
  activePhase = null,
  onOpenPhoto,
  onRefresh,
  onQuotaChange,
  pendingRevealImageId = null,
  onRevealDismiss,
}: GalleryAiWizardProps) {
  const { toast } = useToast();
  const {
    selectedImageIds,
    toggleGallerySelection,
    clearGallerySelection,
    selectedForPrint,
    printVariantByFilename,
    enqueuePrint,
    enqueuePrintMany,
    removeFromPrint,
    bulkRemoveFromPrint,
    allowedPrint,
  } = useGalleryStore();
  const [step, setStep] = useState<AiWizardStep>("compose");
  const [generating, setGenerating] = useState(false);
  const [revealImageId, setRevealImageId] = useState<string | null>(null);
  const [revealAutoPlay, setRevealAutoPlay] = useState(false);

  const readyCount = useMemo(
    () => countReadyAiResults(images, aiThemeId),
    [images, aiThemeId]
  );

  const aiSlotsUsed = useMemo(() => countUsedAiSlots(images), [images]);
  const quotaExhausted = aiGenerateRemaining <= 0;

  const resultImages = useMemo(
    () => getImagesWithAiResults(images, aiThemeId),
    [images, aiThemeId]
  );

  const selectedImages = useMemo(
    () =>
      images.filter(
        (img) => img.imageId && selectedImageIds.includes(img.imageId)
      ),
    [images, selectedImageIds]
  );

  useEffect(() => {
    if (!pendingRevealImageId) return;
    setStep("results");
    setRevealImageId(pendingRevealImageId);
    setRevealAutoPlay(true);
  }, [pendingRevealImageId]);

  const revealImage = useMemo(
    () => images.find((img) => img.imageId === revealImageId) ?? null,
    [images, revealImageId]
  );

  const revealAiUrl = revealImage ? getAiResultUrl(revealImage, aiThemeId) : null;

  const closeRevealModal = useCallback(() => {
    setRevealImageId(null);
    setRevealAutoPlay(false);
    onRevealDismiss?.();
  }, [onRevealDismiss]);

  const generateOne = useCallback(
    async (imageId: string): Promise<boolean> => {
      if (!aiThemeId) {
        toast("Tema sesi belum di-set. Daftar ulang di layar sesi.", "error");
        return false;
      }

      const image = images.find((img) => img.imageId === imageId);
      if (!image) return false;

      const status = getAiSelectionStatus(image);
      if (status === "ready") return true;
      if (["queued", "processing", "pending"].includes(status || "")) return false;
      if (!canGenerateAiSelection(status)) return false;

      const result = await requestAiGenerate({ user, imageId });

      if (result.quota) {
        onQuotaChange?.(result.quota.remaining, result.quota.used);
      }

      if (result.status === "ready" && result.aiUrl) {
        setRevealImageId(imageId);
        setRevealAutoPlay(true);
        return true;
      }

      return false;
    },
    [aiThemeId, images, user, toast, onQuotaChange]
  );

  const handleGenerateSelected = useCallback(async () => {
    if (!aiThemeId) {
      toast("Tema sesi belum di-set. Daftar ulang di layar sesi.", "error");
      return;
    }
    if (selectedImages.length === 0) {
      toast("Pilih minimal satu foto.", "error");
      return;
    }

    const eligible = selectedImages.filter((img) =>
      canGenerateAiSelection(getAiSelectionStatus(img))
    );

    if (eligible.length === 0) {
      const hasReady = selectedImages.some(
        (img) => getAiSelectionStatus(img) === "ready"
      );
      if (hasReady) {
        toast("Foto terpilih sudah diedit. Lihat hasil atau pilih foto lain.", "default");
        setStep("results");
      } else {
        toast("Foto terpilih sedang diproses atau tidak bisa diedit.", "default");
      }
      return;
    }

    if (quotaExhausted) {
      toast("Kuota edit habis.", "error");
      if (readyCount > 0) setStep("results");
      return;
    }

    setGenerating(true);
    let started = 0;
    let finished = 0;

    try {
      for (const img of eligible) {
        if (!img.imageId) continue;
        if (aiGenerateRemaining - started <= 0 && started > 0) break;

        const status = getAiSelectionStatus(img);
        if (!canGenerateAiSelection(status)) continue;

        const done = await generateOne(img.imageId);
        started += 1;
        if (done) finished += 1;
        onRefresh();
      }

      if (finished > 0) {
        toast(`${finished} hasil edit siap!`, "success");
        setStep("results");
      } else if (started > 0) {
        toast(`Edit dimulai untuk ${started} foto…`, "default");
      }
    } catch (err) {
      const code = err instanceof Error ? err.message : "ai_generate_failed";
      toast(mapAiClientError(code), "error");
      if (code === "quota_exhausted" && readyCount > 0) setStep("results");
    } finally {
      setGenerating(false);
    }
  }, [
    aiThemeId,
    selectedImages,
    quotaExhausted,
    readyCount,
    aiGenerateRemaining,
    generateOne,
    onRefresh,
    toast,
  ]);

  const handleEnqueuePrint = useCallback(
    (variant: PrintVariant) => {
      if (selectedImages.length === 0) {
        toast("Pilih foto dulu.", "error");
        return;
      }

      const filenames =
        variant === "ai"
          ? selectedImages
              .filter((img) => hasAiPrintVariant(img, aiThemeId))
              .map((img) => img.filename)
          : selectedImages.map((img) => img.filename);

      if (filenames.length === 0) {
        toast("Belum ada hasil AI pada foto terpilih.", "error");
        return;
      }

      const result = enqueuePrintMany(filenames, variant);
      if (result.skippedLimit > 0) {
        toast(`Antrian penuh (maks. ${allowedPrint} foto).`, "error");
      } else if (result.added === 0 && result.updated === 0) {
        toast(
          variant === "ai"
            ? "Foto ini sudah di antrian sebagai AI."
            : "Foto ini sudah di antrian sebagai asli.",
          "default"
        );
      } else if (result.updated > 0 && result.added === 0) {
        toast(
          variant === "ai"
            ? "Versi cetak diganti ke AI."
            : "Versi cetak diganti ke asli.",
          "success"
        );
      } else {
        toast(
          `${result.added + result.updated} foto masuk antrian cetak (${
            variant === "ai" ? "AI" : "asli"
          }).`,
          "success"
        );
      }
    },
    [selectedImages, aiThemeId, enqueuePrintMany, allowedPrint, toast]
  );

  const handleRemovePrintFromSelection = useCallback(() => {
    bulkRemoveFromPrint(selectedImages.map((img) => img.filename));
    toast("Foto terpilih dihapus dari antrian cetak.", "default");
  }, [selectedImages, bulkRemoveFromPrint, toast]);

  const activePhaseLabel =
    activePhase && PHASE_LABELS[activePhase]
      ? PHASE_LABELS[activePhase]
      : activePhase
        ? "Memproses…"
        : null;

  const sessionBanner = aiThemeId ? (
    <AiSessionBanner
      aiThemeLabel={aiThemeLabel}
      aiThemeLocked={aiThemeLocked}
      aiThemePreviewUrl={aiThemePreviewUrl}
      aiGenerateRemaining={aiGenerateRemaining}
      aiGenerateLimit={aiGenerateLimit}
    />
  ) : (
    <AiMissingThemeBanner />
  );

  const eligibleGenerateCount = selectedImages.filter((img) =>
    canGenerateAiSelection(getAiSelectionStatus(img))
  ).length;

  const readySelectedCount = selectedImages.filter(
    (img) => getAiSelectionStatus(img) === "ready"
  ).length;

  const aiPrintReadyCount = selectedImages.filter((img) =>
    hasAiPrintVariant(img, aiThemeId)
  ).length;

  const printSelectedCount = selectedImages.filter((img) =>
    selectedForPrint.includes(img.filename)
  ).length;

  const originalQueuedCount = selectedImages.filter(
    (img) =>
      selectedForPrint.includes(img.filename) &&
      (printVariantByFilename[img.filename] ?? "original") === "original"
  ).length;

  const aiQueuedCount = selectedImages.filter(
    (img) =>
      selectedForPrint.includes(img.filename) &&
      printVariantByFilename[img.filename] === "ai"
  ).length;

  return (
    <div className="mb-4 space-y-4">
      <AiWizardStepper
        step={step}
        onStepChange={setStep}
        readyCount={readyCount}
        aiSlotsUsed={aiSlotsUsed}
        aiGenerateLimit={aiGenerateLimit}
        quotaExhausted={quotaExhausted}
      />

      {step === "compose" ? (
        <section className="space-y-4 pb-44">
          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-medium text-violet-100 sm:text-base">
                Pilih foto → Edit atau cetak
              </h2>
              <p className="mt-1 text-xs text-white/45">
                Pilih foto, lalu edit ke tema sesi atau masukkan ke antrian cetak
                Asli / AI. Badge emas/ungu = sudah di antrian.
              </p>
            </div>
            {sessionBanner}
          </div>

          {quotaExhausted && readyCount > 0 ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Kuota edit habis.{" "}
              <button
                type="button"
                onClick={() => setStep("results")}
                className="font-medium underline underline-offset-2"
              >
                Lihat {readyCount} hasil →
              </button>
            </div>
          ) : null}

          <div className="columns-1 gap-3 sm:columns-2 sm:gap-4 xl:columns-3 2xl:columns-4">
            <InfoCard userName={userName} />
            {images.map((img, index) => {
              if (!img.imageId) return null;
              const isSelected = selectedImageIds.includes(img.imageId);
              const selectionIndex = isSelected
                ? selectedImageIds.indexOf(img.imageId) + 1
                : null;
              const aiStatus = getAiSelectionStatus(img);
              const isBusy = ["pending", "queued", "processing"].includes(
                aiStatus || ""
              );
              const isPrintSelected = selectedForPrint.includes(img.filename);
              const printVariant = printVariantByFilename[img.filename] ?? "original";

              return (
                <GalleryPhotoTile
                  key={img.filename}
                  image={img}
                  index={index}
                  isSelected={isSelected}
                  selectionIndex={selectionIndex}
                  isPrintSelected={isPrintSelected}
                  printVariant={printVariant}
                  isBusy={isBusy}
                  aiStatusBadge={
                    <AiTileStatusBadge
                      status={aiStatus}
                      error={img.aiSelection?.error ?? img.processingError}
                    />
                  }
                  onToggleSelect={() => toggleGallerySelection(img.imageId!)}
                  onTogglePrint={() => removeFromPrint(img.filename)}
                  onOpenPhoto={() => onOpenPhoto(index)}
                />
              );
            })}
          </div>

          <div className="sticky bottom-28 z-30 mx-auto max-w-4xl">
            <GalleryPrintSelectionBar
              accent="violet"
              selectedImages={selectedImages}
              printSelectedCount={printSelectedCount}
              allowedPrint={allowedPrint}
              totalPrintSelected={selectedForPrint.length}
              originalQueuedCount={originalQueuedCount}
              aiQueuedCount={aiQueuedCount}
              aiPrintReadyCount={aiPrintReadyCount}
              showAiPrint
              hint="Pilih foto, lalu edit ke tema sesi atau masukkan antrian cetak Asli / AI."
              onClearSelection={clearGallerySelection}
              onEnqueuePrint={handleEnqueuePrint}
              onRemovePrintFromSelection={handleRemovePrintFromSelection}
              extraActions={
                <>
                  {eligibleGenerateCount > 0 && !quotaExhausted ? (
                    <button
                      type="button"
                      onClick={() => void handleGenerateSelected()}
                      disabled={generating}
                      className={cn(btnPrimary(), "flex-1 sm:flex-none")}
                    >
                      {generating ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Sparkles className="size-4" />
                      )}
                      Edit {eligibleGenerateCount} foto · {aiThemeLabel ?? "tema"}
                    </button>
                  ) : quotaExhausted && selectedImages.length > 0 && readySelectedCount === 0 ? (
                    <span className="inline-flex w-full items-center justify-center rounded-xl border-2 border-white/15 px-4 py-2 text-xs font-semibold text-white/45 sm:w-auto">
                      Kuota 0 / {aiGenerateLimit}
                    </span>
                  ) : readySelectedCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => setStep("results")}
                        className={cn(btnPrimary(), "flex-1 sm:flex-none")}
                    >
                      Lihat hasil edit
                      <ArrowRight className="size-4" />
                    </button>
                  ) : null}
                  {activePhaseLabel &&
                  selectedImages.some((img) =>
                    ["pending", "queued", "processing"].includes(
                      getAiSelectionStatus(img) || ""
                    )
                  ) ? (
                    <span className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-amber-400/60 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-200 sm:w-auto">
                      <Loader2 className="size-3.5 animate-spin" />
                      {activePhaseLabel}
                    </span>
                  ) : null}
                  {readyCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => setStep("results")}
                      className={btnGhost()}
                    >
                      Hasil ({readyCount})
                    </button>
                  ) : null}
                </>
              }
            />
          </div>
        </section>
      ) : null}

      {step === "results" ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-violet-100 sm:text-base">
                Hasil & cetak
              </h2>
              <p className="mt-1 text-xs text-white/45">
                Bandingkan before/after, lalu pilih versi yang dicetak. Satu
                foto hanya bisa satu versi di antrian.
              </p>
            </div>
            {!quotaExhausted ? (
              <button
                type="button"
                onClick={() => setStep("compose")}
                className="text-xs text-violet-300/80 hover:text-violet-200"
              >
                ← Pilih foto lain
              </button>
            ) : null}
          </div>

          {sessionBanner}

          {resultImages.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 py-16 text-center text-white/50">
              <Sparkles className="mx-auto mb-3 size-8 opacity-40" />
              <p>Belum ada hasil edit.</p>
              <p className="mt-1 text-sm">
                {quotaExhausted
                  ? "Kuota edit habis untuk sesi ini."
                  : "Pilih foto lalu edit di langkah sebelumnya."}
              </p>
              {!quotaExhausted ? (
                <button
                  type="button"
                  onClick={() => setStep("compose")}
                  className={cn(btnPrimary(), "mt-4")}
                >
                  Pilih & edit
                </button>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {resultImages.map((img) => {
                const aiUrl = getAiResultUrl(img, aiThemeId);
                if (!aiUrl) return null;
                const aiSelected =
                  selectedForPrint.includes(img.filename) &&
                  printVariantByFilename[img.filename] === "ai";
                const originalSelected =
                  selectedForPrint.includes(img.filename) &&
                  printVariantByFilename[img.filename] === "original";
                const shouldAutoReveal =
                  revealAutoPlay && revealImageId === img.imageId;

                return (
                  <div key={img.filename} className="space-y-2">
                    <BeforeAfterReveal
                      beforeSrc={getOriginalPreviewUrl(img)}
                      afterSrc={aiUrl}
                      autoReveal={shouldAutoReveal}
                      onExpand={() => {
                        setRevealImageId(img.imageId ?? null);
                        setRevealAutoPlay(false);
                      }}
                    />
                    <div className="flex flex-wrap items-center gap-2 px-1">
                      <span className="mr-1 text-[11px] text-white/40">
                        Antrian:
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const result = enqueuePrint(img.filename, "original");
                          if (result === "limit") {
                            toast(`Antrian penuh (maks. ${allowedPrint} foto).`, "error");
                          }
                        }}
                        className={toggleChipClass(originalSelected, "original")}
                      >
                        {originalSelected ? (
                          <CheckSquare className="size-3.5" />
                        ) : (
                          <Square className="size-3.5" />
                        )}
                        Asli
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const result = enqueuePrint(img.filename, "ai");
                          if (result === "limit") {
                            toast(`Antrian penuh (maks. ${allowedPrint} foto).`, "error");
                          }
                        }}
                        className={toggleChipClass(aiSelected, "ai")}
                      >
                        {aiSelected ? (
                          <CheckSquare className="size-3.5" />
                        ) : (
                          <Square className="size-3.5" />
                        )}
                        AI
                      </button>
                      {originalSelected || aiSelected ? (
                        <button
                          type="button"
                          onClick={() => removeFromPrint(img.filename)}
                          className="text-[11px] text-white/45 underline-offset-2 hover:text-white/80 hover:underline"
                        >
                          Hapus
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {selectedForPrint.length > 0 ? (
            <div className="rounded-xl border border-[#E8C872]/25 bg-[#E8C872]/5 px-4 py-3 text-sm text-[#E8C872]">
              <Printer className="mr-2 inline size-4" />
              {selectedForPrint.length} foto di antrian cetak — gunakan tombol{" "}
              <b>Lanjut Cetak</b> di bawah layar.
            </div>
          ) : null}
        </section>
      ) : null}

      <AiResultRevealModal
        open={Boolean(revealImageId && revealAiUrl && revealImage)}
        beforeSrc={revealImage ? getOriginalPreviewUrl(revealImage) : ""}
        afterSrc={revealAiUrl ?? ""}
        filename={revealImage?.filename}
        themeLabel={aiThemeLabel}
        autoReveal={revealAutoPlay}
        onClose={closeRevealModal}
      />
    </div>
  );
}
