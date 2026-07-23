"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  FlaskConical,
  Loader2,
  Upload,
  Trash2,
  Sparkles,
  Save,
  Rocket,
  Plus,
  History,
  KeyRound,
  DollarSign,
  CheckCircle2,
  Circle,
  Layers,
  ScanFace,
} from "lucide-react";
import { BeforeAfterReveal } from "@/components/gallery/BeforeAfterReveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/ToastProvider";
import { getAdminToken, setAdminToken, clearAdminToken } from "@/lib/adminToken";
import type {
  DraftInput,
  ResearchDraft,
  ResearchMeta,
  ResearchQualityPreset,
  ResearchRun,
  ResearchSample,
} from "@/lib/aiThemeResearchTypes";
import { slugifyThemeId } from "@/lib/slugifyThemeId";
import { formatUsd } from "@/lib/formatUsd";
import {
  btnAi,
  btnDanger,
  btnNeutral,
  btnPrimary,
  btnSuccess,
  galleryPanelClass,
} from "@/lib/galleryUiStyles";
import {
  AiThemeResearchError,
  createResearchDraft,
  deleteResearchDraft,
  deleteResearchSample,
  fetchAdminHealth,
  fetchResearchDrafts,
  fetchResearchMeta,
  fetchResearchRuns,
  fetchResearchSamples,
  fetchResearchUsage,
  publishResearchDraft,
  runResearchPreview,
  updateResearchDraft,
  uploadResearchSample,
} from "@/services/aiThemeResearch.service";
import { cn } from "@/lib/utils";

const PROMPT_TEMPLATE = `Transform the provided photo into a highly realistic [TEMA] portrait while preserving the person's exact identity.

IDENTITY LOCK (highest priority): Keep the exact same person — facial features, face shape, skin tone, hairstyle, expression, eye direction, body proportions, pose, hand positions, camera angle, and full-body framing identical to the source photo.

WARDROBE REPLACEMENT ONLY: [Detail kostum autentik — hat, jacket, shirt, jeans, boots, aksesori]

Do not change the background in this step — costume and material textures only. Photorealistic fabric, natural skin, sharp focus.`;

const DEFAULT_NEGATIVE = `different person, face swap, changed pose, altered expression, different body proportions,
turned head, different hand position, reposed subject,
background change, studio backdrop removal, outdoor scene generation,
cartoon, anime, painting, CGI, illustration, low quality, blurry, oversaturated,
duplicate face, extra limbs, bad anatomy, unrealistic skin, plastic texture`;

const FALLBACK_QUALITY_PRESETS: ResearchQualityPreset[] = [
  {
    id: "economy",
    label: "Economy",
    description: "Iterasi prompt murah (~$0.02). Wajah bisa bergeser.",
    quality: "low",
    inputFidelity: "low",
    costUsd: 0.02,
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Kompromi biaya & detail (~$0.06).",
    quality: "medium",
    inputFidelity: "medium",
    costUsd: 0.06,
  },
  {
    id: "identity",
    label: "Identity-first",
    description: "Sama dengan gallery production (~$0.08). Terbaik untuk cek wajah.",
    quality: "medium",
    inputFidelity: "high",
    recommended: true,
    costUsd: 0.08,
  },
];

const WORKFLOW_STEPS = [
  { id: 1, label: "Sample", hint: "Upload foto studio" },
  { id: 2, label: "Prompt", hint: "Tulis & simpan draft" },
  { id: 3, label: "Preview", hint: "Generate AI" },
  { id: 4, label: "Publish", hint: "Ke registrasi" },
] as const;

const emptyDraft = (): DraftInput => ({
  workingTitle: "",
  transformPrompt: PROMPT_TEMPLATE,
  negativePrompt: DEFAULT_NEGATIVE,
  notes: "",
});

const fieldClass =
  "w-full rounded-xl border-2 border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-violet-400/60";

export function AiThemeResearchClient() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tokenInput, setTokenInput] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [adminEnabled, setAdminEnabled] = useState<boolean | null>(null);
  const [booting, setBooting] = useState(true);

  const [samples, setSamples] = useState<ResearchSample[]>([]);
  const [drafts, setDrafts] = useState<ResearchDraft[]>([]);
  const [runs, setRuns] = useState<ResearchRun[]>([]);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [form, setForm] = useState<DraftInput>(emptyDraft);

  const [loadingSamples, setLoadingSamples] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [latestRun, setLatestRun] = useState<ResearchRun | null>(null);
  const [meta, setMeta] = useState<ResearchMeta | null>(null);
  const [usageCostUsd, setUsageCostUsd] = useState(0);
  const [usageCalls, setUsageCalls] = useState(0);
  const [qualityPresetId, setQualityPresetId] = useState("identity");

  const [publishOpen, setPublishOpen] = useState(false);
  const [publishId, setPublishId] = useState("");
  const [publishLabel, setPublishLabel] = useState("");
  const [publishDescription, setPublishDescription] = useState("");
  const [publishColor, setPublishColor] = useState("#A67B5B");
  const [publishing, setPublishing] = useState(false);

  const selectedSample = useMemo(
    () => samples.find((sample) => sample.id === selectedSampleId) ?? null,
    [samples, selectedSampleId]
  );

  const workflowStep = useMemo(() => {
    if (!selectedSampleId) return 1;
    if (!form.transformPrompt.trim() || !activeDraftId) return 2;
    if (!latestRun || latestRun.status !== "ready") return 3;
    return 4;
  }, [selectedSampleId, form.transformPrompt, activeDraftId, latestRun]);

  const qualityPresets = meta?.qualityPresets?.length
    ? meta.qualityPresets
    : FALLBACK_QUALITY_PRESETS;

  const selectedQualityPreset = useMemo(
    () => qualityPresets.find((preset) => preset.id === qualityPresetId) ?? qualityPresets[2],
    [qualityPresets, qualityPresetId]
  );

  const previewCostEstimate = selectedQualityPreset.costUsd ?? 0.08;
  const productionCostEstimate = meta?.pricing?.productionGenerateUsd ?? 0.08;

  const refreshMeta = useCallback(async (activeToken: string) => {
    const [nextMeta, usageRes] = await Promise.all([
      fetchResearchMeta(activeToken),
      fetchResearchUsage(activeToken, 30, "research").catch(() => null),
    ]);
    setMeta(nextMeta);
    if (usageRes?.usage) {
      setUsageCostUsd(usageRes.usage.totalCostUsd);
      setUsageCalls(usageRes.usage.totalCalls);
    } else if (nextMeta.usageSummary) {
      setUsageCostUsd(nextMeta.usageSummary.researchCostUsd);
      setUsageCalls(nextMeta.usageSummary.researchCalls);
    }
  }, []);

  const refreshAll = useCallback(
    async (activeToken: string) => {
      setLoadingSamples(true);
      try {
        const [nextSamples, nextDrafts, nextRuns] = await Promise.all([
          fetchResearchSamples(activeToken),
          fetchResearchDrafts(activeToken),
          fetchResearchRuns(activeToken, 15),
        ]);
        setSamples(nextSamples);
        setDrafts(nextDrafts);
        setRuns(nextRuns);
        setSelectedSampleId((prev) => {
          if (prev && nextSamples.some((sample) => sample.id === prev)) return prev;
          return nextSamples[0]?.id ?? null;
        });
        await refreshMeta(activeToken);
      } finally {
        setLoadingSamples(false);
      }
    },
    [refreshMeta]
  );

  const authenticate = useCallback(
    async (candidate: string) => {
      const trimmed = candidate.trim();
      if (!trimmed) {
        toast("Token admin wajib diisi.", "error");
        return false;
      }

      try {
        await fetchResearchMeta(trimmed);
        setAdminToken(trimmed);
        setToken(trimmed);
        await refreshAll(trimmed);
        toast("Terhubung ke Theme Research Lab.", "success");
        return true;
      } catch (err) {
        if (err instanceof AiThemeResearchError && err.status === 503) {
          toast("Admin API belum aktif — set ADMIN_API_TOKEN di api/.env", "error");
        } else if (err instanceof AiThemeResearchError && err.status === 401) {
          toast("Token admin salah.", "error");
        } else {
          toast("Gagal menghubungkan ke admin API.", "error");
        }
        return false;
      }
    },
    [refreshAll, toast]
  );

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const health = await fetchAdminHealth();
        if (cancelled) return;
        setAdminEnabled(health.adminEnabled);

        const stored = getAdminToken();
        if (stored && health.adminEnabled) {
          const ok = await authenticate(stored);
          if (!ok && !cancelled) clearAdminToken();
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, [authenticate]);

  const handleLogout = () => {
    clearAdminToken();
    setToken(null);
    setSamples([]);
    setDrafts([]);
    setRuns([]);
    setLatestRun(null);
    setActiveDraftId(null);
    setForm(emptyDraft());
  };

  const handleSelectDraft = (draft: ResearchDraft) => {
    setActiveDraftId(draft.id);
    setForm({
      workingTitle: draft.workingTitle,
      transformPrompt: draft.transformPrompt,
      negativePrompt: draft.negativePrompt,
      notes: draft.notes,
    });
    setPublishLabel(draft.workingTitle);
    setPublishDescription(draft.workingTitle);
    setPublishId(slugifyThemeId(draft.workingTitle));
  };

  const handleNewDraft = () => {
    setActiveDraftId(null);
    setForm(emptyDraft());
    setPublishLabel("");
    setPublishDescription("");
    setPublishId("");
  };

  const handleSaveDraft = async () => {
    if (!token) return;
    if (!form.workingTitle.trim() || !form.transformPrompt.trim() || !form.negativePrompt.trim()) {
      toast("Judul, prompt, dan negative prompt wajib diisi.", "error");
      return;
    }

    setSavingDraft(true);
    try {
      const draft = activeDraftId
        ? await updateResearchDraft(token, activeDraftId, form)
        : await createResearchDraft(token, form);
      setActiveDraftId(draft.id);
      setDrafts((prev) => {
        const rest = prev.filter((entry) => entry.id !== draft.id);
        return [draft, ...rest];
      });
      setPublishLabel(draft.workingTitle);
      setPublishDescription(draft.workingTitle);
      setPublishId(slugifyThemeId(draft.workingTitle));
      toast(activeDraftId ? "Draft diperbarui." : "Draft disimpan.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gagal menyimpan draft.", "error");
    } finally {
      setSavingDraft(false);
    }
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !token) return;

    setUploading(true);
    try {
      const sample = await uploadResearchSample(token, file);
      setSamples((prev) => [sample, ...prev]);
      setSelectedSampleId(sample.id);
      toast("Sample foto diunggah.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Upload gagal.", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteSample = async (sampleId: string) => {
    if (!token) return;
    if (!window.confirm("Hapus sample foto ini?")) return;

    try {
      await deleteResearchSample(token, sampleId);
      setSamples((prev) => prev.filter((sample) => sample.id !== sampleId));
      if (selectedSampleId === sampleId) {
        setSelectedSampleId(null);
      }
      toast("Sample dihapus.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gagal menghapus sample.", "error");
    }
  };

  const handleGenerate = async () => {
    if (!token) return;
    if (!selectedSampleId) {
      toast("Pilih foto sample dulu.", "error");
      return;
    }
    if (!form.transformPrompt.trim() || !form.negativePrompt.trim()) {
      toast("Prompt wajib diisi sebelum generate.", "error");
      return;
    }

    setGenerating(true);
    try {
      const { run } = await runResearchPreview(token, {
        sampleId: selectedSampleId,
        transformPrompt: form.transformPrompt,
        negativePrompt: form.negativePrompt,
        draftId: activeDraftId,
        qualityPreset: qualityPresetId,
      });

      setLatestRun(run);
      setRuns((prev) => [run, ...prev.filter((entry) => entry.id !== run.id)]);

      if (token) {
        await refreshMeta(token).catch(() => {});
      }

      if (run.status === "ready") {
        const costLabel = run.costUsd != null ? ` · ${formatUsd(run.costUsd)}` : "";
        toast(`Preview siap (${Math.round(run.durationMs / 1000)}s${costLabel}).`, "success");
      } else {
        toast(run.error || "Generate preview gagal.", "error");
      }
    } catch (err) {
      toast(
        err instanceof AiThemeResearchError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Generate gagal.",
        "error"
      );
    } finally {
      setGenerating(false);
    }
  };

  const openPublish = () => {
    if (!activeDraftId) {
      toast("Simpan draft dulu sebelum publish.", "error");
      return;
    }
    setPublishLabel(form.workingTitle);
    setPublishDescription(form.workingTitle);
    setPublishId(slugifyThemeId(form.workingTitle));
    setPublishOpen(true);
  };

  const handlePublish = async () => {
    if (!token || !activeDraftId) return;
    if (!publishId.trim() || !publishLabel.trim()) {
      toast("ID slug dan label wajib diisi.", "error");
      return;
    }

    setPublishing(true);
    try {
      const result = await publishResearchDraft(token, {
        draftId: activeDraftId,
        id: publishId.trim(),
        label: publishLabel.trim(),
        description: publishDescription.trim() || publishLabel.trim(),
        previewColor: publishColor,
      });
      setPublishOpen(false);
      toast(`Tema "${result.theme.label}" dipublish ke registrasi.`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Publish gagal.", "error");
    } finally {
      setPublishing(false);
    }
  };

  const handleDeleteDraft = async (draftId: string) => {
    if (!token) return;
    if (!window.confirm("Hapus draft ini?")) return;

    try {
      await deleteResearchDraft(token, draftId);
      setDrafts((prev) => prev.filter((draft) => draft.id !== draftId));
      if (activeDraftId === draftId) handleNewDraft();
      toast("Draft dihapus.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gagal menghapus draft.", "error");
    }
  };

  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white/70">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-white">
        <div className={cn(galleryPanelClass, "w-full max-w-md space-y-4")}>
          <div className="flex items-center gap-3">
            <FlaskConical className="size-8 text-violet-300" />
            <div>
              <h1 className="text-xl font-semibold">AI Theme Research</h1>
              <p className="text-sm text-white/55">
                Uji prompt tema baru sebelum dipublish ke registrasi.
              </p>
            </div>
          </div>

          {adminEnabled === false ? (
            <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              Admin API nonaktif. Set <code className="text-amber-50">ADMIN_API_TOKEN</code> di{" "}
              <code className="text-amber-50">api/.env</code> lalu restart API.
            </p>
          ) : null}

          <label className="block space-y-2 text-sm">
            <span className="text-white/70">Admin token</span>
            <Input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Sama dengan ADMIN_API_TOKEN"
              className="border-white/20 bg-black/50 text-white"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnPrimary()}
              onClick={() => authenticate(tokenInput)}
            >
              <KeyRound className="size-4" />
              Masuk
            </button>
            <Link href="/" className={btnNeutral()}>
              Kembali
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <FlaskConical className="size-7 text-violet-300" />
            <div>
              <h1 className="text-lg font-semibold sm:text-xl">AI Theme Research Lab</h1>
              <p className="text-xs text-white/50 sm:text-sm">
                Iterasi prompt murah → publish ke gallery production
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100">
              <DollarSign className="size-3.5 shrink-0" />
              <span>
                Lab 30h: {formatUsd(usageCostUsd)} · {usageCalls} call
              </span>
            </div>
            <Link href="/" className={btnNeutral()}>
              Home
            </Link>
            <Link href="/session" className={btnNeutral()}>
              Sesi
            </Link>
            <button type="button" className={btnDanger()} onClick={handleLogout}>
              Keluar
            </button>
          </div>
        </div>

        <div className="border-t border-white/5 bg-[#0a0a0c]/90">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2 px-4 py-2.5 sm:px-6">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-white/35">
              Pipeline
            </span>
            <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-0.5 text-[11px] text-violet-100">
              {meta?.pipeline?.name ?? "hybrid-v2"}
            </span>
            <span
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[11px]",
                meta?.maskedEditEnabled
                  ? "border-sky-400/30 bg-sky-500/10 text-sky-100"
                  : "border-white/15 text-white/40"
              )}
            >
              <Layers className="mr-1 inline size-3" />
              masked {meta?.maskedEditEnabled ? "on" : "off"}
            </span>
            <span
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[11px]",
                meta?.pipeline?.faceRefine?.available
                  ? "border-amber-400/30 bg-amber-500/10 text-amber-100"
                  : "border-white/15 text-white/40"
              )}
            >
              <ScanFace className="mr-1 inline size-3" />
              face refine {meta?.pipeline?.faceRefine?.available ? "on" : "off"}
            </span>
            <span className="ml-auto text-[11px] text-white/45">
              Preview ~{formatUsd(previewCostEstimate)} ({selectedQualityPreset.quality}/
              {selectedQualityPreset.inputFidelity}) · Gallery ~{formatUsd(productionCostEstimate)}
            </span>
          </div>
        </div>

        <div className="border-t border-white/5 bg-[#0f0f12]/80">
          <div className="mx-auto grid max-w-[1600px] grid-cols-2 gap-2 px-4 py-3 sm:grid-cols-4 sm:px-6">
            {WORKFLOW_STEPS.map((step) => {
              const done = workflowStep > step.id;
              const active = workflowStep === step.id;
              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3 py-2 transition",
                    active
                      ? "border-violet-400/50 bg-violet-500/10"
                      : done
                        ? "border-emerald-400/25 bg-emerald-500/5"
                        : "border-white/10 bg-black/20"
                  )}
                >
                  {done ? (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                  ) : (
                    <Circle
                      className={cn(
                        "size-4 shrink-0",
                        active ? "text-violet-300" : "text-white/25"
                      )}
                    />
                  )}
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-xs font-semibold",
                        active ? "text-violet-100" : done ? "text-emerald-100" : "text-white/55"
                      )}
                    >
                      {step.id}. {step.label}
                    </p>
                    <p className="truncate text-[10px] text-white/40">{step.hint}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1600px] gap-4 px-4 py-4 sm:px-6 lg:grid-cols-12 lg:gap-5 lg:py-6">
        {/* Samples */}
        <section className={cn(galleryPanelClass, "lg:col-span-3 space-y-4")}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70">
              Sample foto
            </h2>
            <button
              type="button"
              className={btnNeutral(false, "px-3 py-1.5 text-xs")}
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Upload className="size-3.5" />
              )}
              Upload
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleUpload}
            />
          </div>

          {loadingSamples ? (
            <div className="flex justify-center py-8 text-white/50">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : samples.length === 0 ? (
            <p className="text-sm text-white/45">
              Unggah 2–3 foto portrait studio sebagai bahan uji prompt.
            </p>
          ) : (
            <ul className="space-y-2">
              {samples.map((sample) => {
                const active = sample.id === selectedSampleId;
                return (
                  <li
                    key={sample.id}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border-2 p-2 transition",
                      active
                        ? "border-violet-400/70 bg-violet-500/10"
                        : "border-white/10 bg-black/30"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedSampleId(sample.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <img
                        src={sample.url}
                        alt={sample.originalName}
                        className="size-14 shrink-0 rounded-lg object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{sample.originalName}</p>
                        <p className="text-[11px] text-white/40">
                          {new Date(sample.createdAt).toLocaleString("id-ID")}
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-red-300 hover:bg-red-500/10"
                      onClick={() => handleDeleteSample(sample.id)}
                      aria-label="Hapus sample"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Editor */}
        <section className={cn(galleryPanelClass, "lg:col-span-5 space-y-4")}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70">
              Draft prompt
            </h2>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnNeutral(false, "px-3 py-1.5 text-xs")} onClick={handleNewDraft}>
                <Plus className="size-3.5" />
                Baru
              </button>
              <button
                type="button"
                className={btnPrimary(false, "px-3 py-1.5 text-xs")}
                disabled={savingDraft}
                onClick={handleSaveDraft}
              >
                {savingDraft ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                Simpan
              </button>
            </div>
          </div>

          {drafts.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {drafts.slice(0, 8).map((draft) => (
                <button
                  key={draft.id}
                  type="button"
                  onClick={() => handleSelectDraft(draft)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition",
                    draft.id === activeDraftId
                      ? "border-violet-400 bg-violet-500/15 text-violet-100"
                      : "border-white/15 text-white/65 hover:border-white/30"
                  )}
                >
                  {draft.workingTitle}
                </button>
              ))}
            </div>
          ) : null}

          <label className="block space-y-1.5 text-sm">
            <span className="text-white/65">Judul kerja</span>
            <input
              className={fieldClass}
              value={form.workingTitle}
              onChange={(e) => {
                const value = e.target.value;
                setForm((prev) => ({ ...prev, workingTitle: value }));
                setPublishLabel(value);
                setPublishDescription(value);
                setPublishId(slugifyThemeId(value));
              }}
              placeholder="Contoh: Viking Warrior"
            />
          </label>

          <label className="block space-y-1.5 text-sm">
            <span className="text-white/65">Transform prompt</span>
            <textarea
              className={cn(fieldClass, "min-h-[220px] resize-y font-mono text-[13px] leading-relaxed")}
              value={form.transformPrompt}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, transformPrompt: e.target.value }))
              }
            />
          </label>

          <label className="block space-y-1.5 text-sm">
            <span className="text-white/65">Negative prompt</span>
            <textarea
              className={cn(fieldClass, "min-h-[100px] resize-y font-mono text-[13px]")}
              value={form.negativePrompt}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, negativePrompt: e.target.value }))
              }
            />
          </label>

          <label className="block space-y-1.5 text-sm">
            <span className="text-white/65">Catatan (opsional)</span>
            <textarea
              className={cn(fieldClass, "min-h-[72px] resize-y")}
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Iterasi prompt, feedback hasil, dll."
            />
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-white/65">Kualitas & biaya preview</span>
              <span className="text-[11px] text-white/40">
                Pilih <strong className="font-medium text-violet-200">Identity-first</strong> untuk cek wajah
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {qualityPresets.map((preset) => {
                const active = preset.id === qualityPresetId;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setQualityPresetId(preset.id)}
                    className={cn(
                      "rounded-xl border-2 p-3 text-left transition",
                      active
                        ? "border-violet-400/70 bg-violet-500/10"
                        : "border-white/10 bg-black/25 hover:border-white/25"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-white/90">{preset.label}</p>
                      <span className="shrink-0 text-xs text-emerald-300/90">
                        {formatUsd(preset.costUsd ?? 0)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-white/45">
                      {preset.quality}/{preset.inputFidelity}
                    </p>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-white/55">
                      {preset.description}
                    </p>
                    {preset.recommended ? (
                      <span className="mt-2 inline-block rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-100">
                        Recommended untuk QA wajah
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              className={btnAi()}
              disabled={generating || !selectedSampleId}
              onClick={handleGenerate}
            >
              {generating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Generate preview
              <span className="text-xs font-normal opacity-75">
                (~{formatUsd(previewCostEstimate)})
              </span>
            </button>
            <button type="button" className={btnSuccess()} onClick={openPublish}>
              <Rocket className="size-4" />
              Publish tema
            </button>
            {activeDraftId ? (
              <button
                type="button"
                className={btnDanger()}
                onClick={() => handleDeleteDraft(activeDraftId)}
              >
                <Trash2 className="size-4" />
                Hapus draft
              </button>
            ) : null}
          </div>
        </section>

        {/* Preview */}
        <section className={cn(galleryPanelClass, "lg:col-span-4 space-y-4")}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70">
            Hasil preview
          </h2>

          {selectedSample && latestRun?.status === "ready" && latestRun.resultUrl ? (
            <BeforeAfterReveal
              beforeSrc={selectedSample.url}
              afterSrc={latestRun.resultUrl}
              beforeLabel="Sample"
              afterLabel="AI"
              autoReveal
              className="rounded-xl"
            />
          ) : selectedSample ? (
            <div className="overflow-hidden rounded-xl border border-white/10">
              <img
                src={selectedSample.url}
                alt={selectedSample.originalName}
                className="aspect-[3/4] w-full object-cover"
              />
            </div>
          ) : (
            <p className="text-sm text-white/45">Pilih sample foto untuk preview.</p>
          )}

          {latestRun ? (
            <div
              className={cn(
                "space-y-2 rounded-xl border px-3 py-2.5 text-sm",
                latestRun.status === "ready"
                  ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                  : "border-red-400/30 bg-red-500/10 text-red-100"
              )}
            >
              {latestRun.status === "ready" ? (
                <>
                  <p className="font-medium">
                    Preview selesai · {Math.round(latestRun.durationMs / 1000)}s
                    {latestRun.costUsd != null ? ` · ${formatUsd(latestRun.costUsd)}` : ""}
                  </p>
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    {latestRun.editMode ? (
                      <span className="rounded-full border border-white/20 px-2 py-0.5">
                        edit: {latestRun.editMode}
                      </span>
                    ) : null}
                    {latestRun.qualityPreset ? (
                      <span className="rounded-full border border-violet-400/30 px-2 py-0.5 text-violet-100">
                        {latestRun.qualityPreset}
                        {latestRun.quality && latestRun.inputFidelity
                          ? ` ${latestRun.quality}/${latestRun.inputFidelity}`
                          : ""}
                      </span>
                    ) : null}
                    {latestRun.faceRefined ? (
                      <span className="rounded-full border border-amber-400/30 px-2 py-0.5 text-amber-100">
                        face refined
                      </span>
                    ) : null}
                  </div>
                </>
              ) : (
                <p>{latestRun.error || "Generate gagal."}</p>
              )}
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-wide text-white/45">
              <div className="flex items-center gap-2">
                <History className="size-3.5" />
                Riwayat run
              </div>
              <span>{runs.length} entri</span>
            </div>
            {runs.length === 0 ? (
              <p className="text-sm text-white/40">Belum ada preview — mulai dari Generate.</p>
            ) : (
              <ul className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-black/25 p-1 text-xs">
                {runs.map((run) => {
                  const active = latestRun?.id === run.id;
                  return (
                    <li key={run.id}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-white/5",
                          active && "bg-violet-500/10"
                        )}
                        onClick={() => {
                          setLatestRun(run);
                          setSelectedSampleId(run.sampleId);
                          if (run.qualityPreset) setQualityPresetId(run.qualityPreset);
                          setForm((prev) => ({
                            ...prev,
                            transformPrompt: run.transformPrompt,
                            negativePrompt: run.negativePrompt,
                          }));
                        }}
                      >
                        <span
                          className={cn(
                            "size-2 shrink-0 rounded-full",
                            run.status === "ready" ? "bg-emerald-400" : "bg-red-400"
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate text-white/75">
                          {new Date(run.createdAt).toLocaleString("id-ID", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="shrink-0 text-white/40">
                          {Math.round(run.durationMs / 1000)}s
                        </span>
                        {run.costUsd != null ? (
                          <span className="shrink-0 text-emerald-300/90">{formatUsd(run.costUsd)}</span>
                        ) : null}
                        {run.editMode ? (
                          <span className="shrink-0 rounded border border-white/15 px-1.5 py-0.5 text-[10px] uppercase text-white/45">
                            {run.editMode}
                          </span>
                        ) : null}
                        {run.qualityPreset ? (
                          <span className="shrink-0 rounded border border-violet-400/20 px-1.5 py-0.5 text-[10px] text-violet-200/80">
                            {run.qualityPreset}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </main>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="border-white/15 bg-[#141418] text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Publish tema ke registrasi</DialogTitle>
            <DialogDescription className="text-white/55">
              Tema akan muncul di wizard AI Self Photo. Upload preview card manual ke{" "}
              <code className="text-white/80">themes/&#123;id&#125;/after.jpg</code> bila perlu.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <label className="block space-y-1 text-sm">
              <span className="text-white/65">ID slug</span>
              <Input
                value={publishId}
                onChange={(e) => setPublishId(slugifyThemeId(e.target.value))}
                className="border-white/20 bg-black/40 text-white"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-white/65">Label</span>
              <Input
                value={publishLabel}
                onChange={(e) => setPublishLabel(e.target.value)}
                className="border-white/20 bg-black/40 text-white"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-white/65">Deskripsi</span>
              <Input
                value={publishDescription}
                onChange={(e) => setPublishDescription(e.target.value)}
                className="border-white/20 bg-black/40 text-white"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-white/65">Preview color</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={publishColor}
                  onChange={(e) => setPublishColor(e.target.value)}
                  className="size-10 cursor-pointer rounded border border-white/20 bg-transparent"
                />
                <Input
                  value={publishColor}
                  onChange={(e) => setPublishColor(e.target.value)}
                  className="border-white/20 bg-black/40 text-white"
                />
              </div>
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishOpen(false)}>
              Batal
            </Button>
            <button type="button" className={btnSuccess()} disabled={publishing} onClick={handlePublish}>
              {publishing ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
              Publish
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
