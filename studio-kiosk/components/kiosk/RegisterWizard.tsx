"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AiTheme, PackageType } from "@/lib/imageTypes";
import {
  PACKAGE_OPTIONS,
  resolveAiGenerateLimit,
} from "@/lib/packageTypes";
import { getPackageDurationMinutes } from "@/services/session.service";
import { RegisterAiSummaryCard } from "@/components/kiosk/RegisterAiSummaryCard";
import { ThemePickerGrid, useAiThemes } from "@/components/kiosk/ThemePickerGrid";
import { ThemePreviewModal } from "@/components/kiosk/ThemePreviewModal";
import { cn } from "@/lib/utils";

type RegisterStep = 1 | 2 | 3;

type RegisterWizardProps = {
  packageDurations: Record<PackageType, number>;
  onSubmit: (
    name: string,
    phone: string,
    peopleCount: number,
    packageType: PackageType,
    aiThemeId?: string
  ) => Promise<void>;
  onBack: () => void;
  onError: (message: string) => void;
  onStepChange?: (step: RegisterStep) => void;
};

function RegisterStepDots({
  step,
  isAiPackage,
}: {
  step: RegisterStep;
  isAiPackage: boolean;
}) {
  const labels = isAiPackage
    ? (["Paket", "Tema", "Data"] as const)
    : (["Paket", "Data"] as const);

  const activeIndex = isAiPackage ? step - 1 : step === 1 ? 0 : 1;

  return (
    <div className="mb-5 flex items-center justify-center gap-2">
      {labels.map((label, index) => {
        const active = index === activeIndex;
        const done = index < activeIndex;
        return (
          <div key={label} className="flex items-center gap-2">
            <div
              className={cn(
                "flex size-7 items-center justify-center rounded-full text-[11px] font-semibold transition",
                active
                  ? "bg-[#B59240] text-black"
                  : done
                    ? "bg-[#B59240]/30 text-[#E8C872]"
                    : "bg-white/10 text-white/45"
              )}
            >
              {index + 1}
            </div>
            <span
              className={cn(
                "hidden text-xs sm:inline",
                active ? "text-[#E8C872]" : "text-white/45"
              )}
            >
              {label}
            </span>
            {index < labels.length - 1 ? (
              <div className="h-px w-6 bg-white/15 sm:w-10" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function RegisterWizard({
  packageDurations,
  onSubmit,
  onBack,
  onError,
  onStepChange,
}: RegisterWizardProps) {
  const [step, setStep] = React.useState<RegisterStep>(1);
  const [packageType, setPackageType] = React.useState<PackageType>("self-photo");
  const [peopleCount, setPeopleCount] = React.useState(1);
  const [aiThemeId, setAiThemeId] = React.useState<string | null>(null);
  const [previewTheme, setPreviewTheme] = React.useState<AiTheme | null>(null);
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const { themes } = useAiThemes();
  const isAiPackage = packageType === "ai-self-photo";
  const sessionMinutes = getPackageDurationMinutes(packageType, packageDurations);
  const aiQuotaPreview = resolveAiGenerateLimit(packageType, peopleCount);
  const selectedTheme =
    themes.find((theme) => theme.id === aiThemeId) ?? null;

  React.useEffect(() => {
    onStepChange?.(step);
  }, [step, onStepChange]);

  const goNextFromStep1 = () => {
    if (isAiPackage) {
      setStep(2);
      return;
    }
    setStep(3);
  };

  const goBack = () => {
    if (step === 3) {
      setStep(isAiPackage ? 2 : 1);
      return;
    }
    if (step === 2) {
      setStep(1);
      return;
    }
    onBack();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    if (isAiPackage && !aiThemeId) {
      onError("Pilih tema AI untuk sesi ini.");
      setStep(2);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(
        trimmedName,
        phone.trim(),
        Math.max(1, Math.min(8, peopleCount)),
        packageType,
        aiThemeId ?? undefined
      );
    } catch {
      onError("Registrasi gagal. Hubungi staf.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <RegisterStepDots step={step} isAiPackage={isAiPackage} />

      {step === 1 ? (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold tracking-wide text-white sm:text-xl">
              Paket & jumlah orang
            </h2>
            <p className="mt-2 text-xs text-white/60 sm:text-sm">
              Sesi {sessionMinutes} menit · nama dipakai sebagai folder foto
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs tracking-[0.22em] text-white/60">PAKET</label>
            <div className="grid gap-2 sm:grid-cols-2">
              {PACKAGE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setPackageType(option.id)}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-left transition",
                    packageType === option.id
                      ? "border-[#B59240]/50 bg-[#B59240]/15 ring-1 ring-[#B59240]/40"
                      : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                  )}
                >
                  <p className="text-sm font-semibold text-white">{option.label}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-white/55">
                    {option.description}
                  </p>
                  {option.badge ? (
                    <p className="mt-2 text-[10px] font-medium text-[#E8C872]">
                      {option.badge}
                    </p>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs tracking-[0.22em] text-white/60">
              JUMLAH ORANG
            </label>
            <Input
              type="number"
              min={1}
              max={8}
              value={peopleCount}
              onChange={(e) =>
                setPeopleCount(Math.max(1, Math.min(8, Number(e.target.value) || 1)))
              }
              className="h-11"
            />
            {isAiPackage ? (
              <p className="text-[11px] text-[#E8C872]">
                Kuota generate AI: {aiQuotaPreview} (sesuai jumlah orang)
              </p>
            ) : null}
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 border-white/20 bg-white/5 text-white hover:bg-white/10"
              onClick={onBack}
            >
              Kembali
            </Button>
            <Button
              type="button"
              className="h-11 flex-1 bg-[#B59240] font-semibold text-black hover:bg-[#C9A855]"
              onClick={goNextFromStep1}
            >
              Lanjut
              <ChevronRight className="ml-1 size-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {step === 2 && isAiPackage ? (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold tracking-wide text-white sm:text-xl">
              Pilih tema sesi
            </h2>
            <p className="mt-2 text-xs text-white/60 sm:text-sm">
              Satu tema untuk seluruh sesi — contoh hasil di bawah
            </p>
          </div>

          <ThemePickerGrid
            selectedThemeId={aiThemeId}
            onSelect={setAiThemeId}
            onExpand={setPreviewTheme}
            onError={onError}
          />

          {selectedTheme ? (
            <div className="flex items-center gap-3 rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 py-2">
              {selectedTheme.previewUrl ? (
                <img
                  src={selectedTheme.previewUrl}
                  alt=""
                  className="size-12 rounded-lg object-cover"
                />
              ) : null}
              <p className="text-sm text-violet-100">
                Terpilih: <b>{selectedTheme.label}</b>
              </p>
            </div>
          ) : null}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 border-white/20 bg-white/5 text-white hover:bg-white/10"
              onClick={goBack}
            >
              <ChevronLeft className="mr-1 size-4" />
              Kembali
            </Button>
            <Button
              type="button"
              className="h-11 flex-1 bg-[#B59240] font-semibold text-black hover:bg-[#C9A855]"
              disabled={!aiThemeId}
              onClick={() => setStep(3)}
            >
              Lanjut
              <ChevronRight className="ml-1 size-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <form className="space-y-5" onSubmit={(e) => void handleSubmit(e)}>
          <div>
            <h2 className="text-lg font-semibold tracking-wide text-white sm:text-xl">
              Data customer
            </h2>
            <p className="mt-2 text-xs text-white/60 sm:text-sm">
              Periksa ringkasan sebelum mulai sesi
            </p>
          </div>

          <RegisterAiSummaryCard
            packageType={packageType}
            peopleCount={peopleCount}
            sessionMinutes={sessionMinutes}
            theme={selectedTheme}
          />

          <div className="space-y-2">
            <label className="text-xs tracking-[0.22em] text-white/60">NAMA</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              className="h-11"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs tracking-[0.22em] text-white/60">
              WHATSAPP (OPSIONAL)
            </label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="off"
              className="h-11"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 border-white/20 bg-white/5 text-white hover:bg-white/10"
              onClick={goBack}
            >
              <ChevronLeft className="mr-1 size-4" />
              Kembali
            </Button>
            <Button
              type="submit"
              className="h-11 flex-1 bg-[#B59240] font-semibold text-black hover:bg-[#C9A855]"
              disabled={submitting || !name.trim()}
            >
              {submitting ? "Memproses…" : "Daftarkan & Mulai"}
            </Button>
          </div>
        </form>
      ) : null}

      <ThemePreviewModal
        theme={previewTheme}
        open={Boolean(previewTheme)}
        onClose={() => setPreviewTheme(null)}
        onSelect={(themeId) => setAiThemeId(themeId)}
      />
    </>
  );
}

export function getRegisterWizardContainerClass(step: RegisterStep): string {
  return step === 2 ? "max-w-3xl" : "max-w-md";
}
