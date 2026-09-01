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
import type { AiThemeType, GalleryImageData } from "@/lib/imageTypes";
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
import { useGalleryStore } from "@/stores/useGalleryStore";

const PHASE_LABELS: Record<string, string> = {
  segmenting: "Memisahkan subjek…",
  generating: "Mengganti kostum AI…",
  refining: "Menjaga wajah asli…",
  compositing: "Menyusun background…",
  finishing: "Finishing…",
  transform: "Transformasi AI…",
};

type GalleryAiWizardProps = {
  user: string;
  userName: string;
  images: GalleryImageData[];
  aiThemeId: string | null;
  aiThemeLabel: string | null;
  aiThemeLocked: boolean;
  aiThemePreviewUrl?: string | null;
  aiThemeType?: AiThemeType | null;
  aiGenerateRemaining: number;
  aiGenerateLimit: number;
  activePhase?: string | null;
  onOpenPhoto: (index: number) => void;
  onRefresh: () => void;
  onQuotaChange?: (remaining: number, used: number) => void;
  pendingRevealImageId?: string | null;
  onRevealDismiss?: () => void;
};

function AiTileStatusBadge({ status }: { status: string | null }) {
  if (!status) return null;

  if (status === "ready") {
    return (
      <span className="absolute left-3 bottom-3 z-20 inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-medium text-white">
        <CheckCircle2 className="size-3" />
        AI selesai
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="absolute left-3 bottom-3 z-20 inline-flex items-center gap-1 rounded-full bg-red-500/90 px-2 py-0.5 text-[10px] font-medium text-white">
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
  aiThemeType = null,
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
    togglePrint,
    printVariantByFilename,
    bulkTogglePrint,
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
        toast("Foto terpilih sudah di-generate. Lihat hasil atau pilih foto lain.", "default");
        setStep("results");
      } else {
        toast("Foto terpilih sedang diproses atau tidak bisa di-generate.", "default");
      }
      return;
    }

    if (quotaExhausted) {
      toast("Kuota AI habis.", "error");
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
        toast(`${finished} hasil AI siap!`, "success");
        setStep("results");
      } else if (started > 0) {
        toast(`Generate dimulai untuk ${started} foto…`, "default");
      }
    } catch (err) {
      const code = err instanceof Error ? err.message : "ai_generate_failed";
      const message =
        code === "quota_exhausted"
          ? "Kuota AI habis."
          : code === "theme_required"
            ? "Tema sesi belum di-set. Daftar ulang di layar sesi."
            : "Gagal memulai generate AI.";
      toast(message, "error");
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

  const handleBulkTogglePrint = useCallback(
    (variant: "original" | "ai") => {
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

      const allMatch = filenames.every(
        (f) =>
          selectedForPrint.includes(f) &&
          (printVariantByFilename[f] ?? "original") === variant
      );

      bulkTogglePrint(filenames, variant);
      toast(
        allMatch
          ? `${filenames.length} foto dihapus dari cetak.`
          : `${filenames.length} foto ditambah ke cetak (${variant === "ai" ? "AI" : "Asli"}).`,
        allMatch ? "default" : "success"
      );
    },
    [
      selectedImages,
      aiThemeId,
      selectedForPrint,
      printVariantByFilename,
      bulkTogglePrint,
      toast,
    ]
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
      aiThemeType={aiThemeType}
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

  const allSelectedPrintOriginal =
    selectedImages.length > 0 &&
    selectedImages.every(
      (img) =>
        selectedForPrint.includes(img.filename) &&
        (printVariantByFilename[img.filename] ?? "original") === "original"
    );

  const aiReadySelected = selectedImages.filter((img) =>
    hasAiPrintVariant(img, aiThemeId)
  );

  const allSelectedPrintAi =
    aiReadySelected.length > 0 &&
    aiReadySelected.every(
      (img) =>
        selectedForPrint.includes(img.filename) &&
        printVariantByFilename[img.filename] === "ai"
    );

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
                Pilih foto → Generate atau cetak
              </h2>
              <p className="mt-1 text-xs text-white/45">
                Tap foto untuk pilih (bisa banyak) · tap ikon perbesar untuk zoom
                · cetak asli atau hasil AI
              </p>
            </div>
            {sessionBanner}
          </div>

          {quotaExhausted && readyCount > 0 ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Kuota AI habis.{" "}
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
                  aiStatusBadge={<AiTileStatusBadge status={aiStatus} />}
                  onToggleSelect={() => toggleGallerySelection(img.imageId!)}
                  onTogglePrint={() => togglePrint(img.filename, printVariant)}
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
              allSelectedPrintOriginal={allSelectedPrintOriginal}
              allSelectedPrintAi={allSelectedPrintAi}
              aiPrintReadyCount={aiPrintReadyCount}
              onClearSelection={clearGallerySelection}
              onBulkTogglePrint={handleBulkTogglePrint}
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
                      Generate AI ({eligibleGenerateCount})
                    </button>
                  ) : readySelectedCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => setStep("results")}
                        className={cn(btnPrimary(), "flex-1 sm:flex-none")}
                    >
                      Lihat hasil AI
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
                Bandingkan before/after · pilih versi AI atau asli untuk cetak
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
              <p>Belum ada hasil AI.</p>
              <p className="mt-1 text-sm">
                {quotaExhausted
                  ? "Kuota generate habis untuk sesi ini."
                  : "Pilih foto lalu generate di langkah sebelumnya."}
              </p>
              {!quotaExhausted ? (
                <button
                  type="button"
                  onClick={() => setStep("compose")}
                  className={cn(btnPrimary(), "mt-4")}
                >
                  Pilih & generate
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
                    <div className="flex flex-wrap items-center gap-3 px-1">
                      <button
                        type="button"
                        onClick={() => togglePrint(img.filename, "original")}
                        className={toggleChipClass(originalSelected, "original")}
                      >
                        {originalSelected ? (
                          <CheckSquare className="size-3.5" />
                        ) : (
                          <Square className="size-3.5" />
                        )}
                        {originalSelected ? "Batalkan asli" : "Cetak asli"}
                      </button>
                      <button
                        type="button"
                        onClick={() => togglePrint(img.filename, "ai")}
                        className={toggleChipClass(aiSelected, "ai")}
                      >
                        {aiSelected ? (
                          <CheckSquare className="size-3.5" />
                        ) : (
                          <Square className="size-3.5" />
                        )}
                        {aiSelected ? "Batalkan AI" : "Cetak AI"}
                      </button>
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
