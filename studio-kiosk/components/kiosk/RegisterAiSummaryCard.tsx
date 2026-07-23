"use client";

import type { AiTheme, PackageType } from "@/lib/imageTypes";
import { getPackageLabel, resolveAiGenerateLimit } from "@/lib/packageTypes";

type RegisterAiSummaryCardProps = {
  packageType: PackageType;
  peopleCount: number;
  sessionMinutes: number;
  theme: AiTheme | null;
};

export function RegisterAiSummaryCard({
  packageType,
  peopleCount,
  sessionMinutes,
  theme,
}: RegisterAiSummaryCardProps) {
  const aiQuota = resolveAiGenerateLimit(packageType, peopleCount);

  return (
    <div className="rounded-xl border border-[#B59240]/25 bg-[#B59240]/10 p-4">
      <p className="text-xs font-medium tracking-[0.18em] text-[#E8C872]">
        RINGKASAN SESI
      </p>

      <div className="mt-3 flex gap-3">
        {theme?.previewUrl ? (
          <img
            src={theme.previewUrl}
            alt={theme.label}
            className="h-24 w-20 shrink-0 rounded-lg object-cover ring-1 ring-white/15"
          />
        ) : theme ? (
          <div
            className="h-24 w-20 shrink-0 rounded-lg ring-1 ring-white/15"
            style={{ backgroundColor: theme.previewColor }}
          />
        ) : null}

        <dl className="min-w-0 flex-1 space-y-1 text-sm text-white/85">
          <div className="flex justify-between gap-2">
            <dt className="text-white/50">Paket</dt>
            <dd className="font-medium">{getPackageLabel(packageType)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-white/50">Orang</dt>
            <dd className="font-medium">{peopleCount}</dd>
          </div>
          {packageType === "ai-self-photo" && theme ? (
            <>
              <div className="flex justify-between gap-2">
                <dt className="text-white/50">Tema sesi</dt>
                <dd className="truncate font-medium text-violet-100">
                  {theme.label}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-white/50">Kuota AI</dt>
                <dd className="font-medium">{aiQuota}×</dd>
              </div>
            </>
          ) : null}
          <div className="flex justify-between gap-2">
            <dt className="text-white/50">Durasi</dt>
            <dd className="font-medium">{sessionMinutes} menit</dd>
          </div>
        </dl>
      </div>

      {packageType === "ai-self-photo" && theme ? (
        <p className="mt-3 text-[11px] leading-relaxed text-white/45">
          Tema <b className="text-white/70">{theme.label}</b> berlaku untuk seluruh
          sesi — semua generate memakai contoh di atas.
        </p>
      ) : null}
    </div>
  );
}
