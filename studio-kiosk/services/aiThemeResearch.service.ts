import { API_BASE_URL } from "@/lib/env";
import type {
  DraftInput,
  PublishInput,
  ResearchDraft,
  ResearchMeta,
  ResearchRun,
  ResearchSample,
  ResearchUsageSummary,
} from "@/lib/aiThemeResearchTypes";
import { AiThemeResearchError } from "@/lib/aiThemeResearchTypes";

export { AiThemeResearchError };

type RequestOptions = {
  token: string;
  method?: string;
  body?: unknown;
  formData?: FormData;
};

async function adminFetch<T>(path: string, options: RequestOptions): Promise<T> {
  const headers: Record<string, string> = {
    "X-Admin-Token": options.token,
  };

  if (options.body !== undefined && !options.formData) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.formData
      ? options.formData
      : options.body !== undefined
        ? JSON.stringify(options.body)
        : undefined,
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  const code = typeof data.error === "string" ? data.error : "request_failed";

  if (!res.ok) {
    throw new AiThemeResearchError(
      res.status,
      code,
      typeof data.message === "string" ? data.message : code
    );
  }

  return data as T;
}

export async function fetchAdminHealth(): Promise<{
  ok: boolean;
  adminEnabled: boolean;
}> {
  const res = await fetch(`${API_BASE_URL}/api/admin/health`, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  return {
    ok: Boolean(body.ok),
    adminEnabled: Boolean(body.adminEnabled),
  };
}

export async function fetchResearchMeta(token: string): Promise<ResearchMeta> {
  return adminFetch<ResearchMeta>("/api/admin/ai-theme-research/meta", { token });
}

export async function fetchResearchUsage(
  token: string,
  days = 30,
  source?: string
): Promise<{ pricing: ResearchMeta["pricing"]; usage: ResearchUsageSummary }> {
  const qs = new URLSearchParams({ days: String(days) });
  if (source) qs.set("source", source);
  return adminFetch(`/api/admin/ai-theme-research/usage?${qs.toString()}`, { token });
}

export async function fetchResearchSamples(token: string): Promise<ResearchSample[]> {
  const data = await adminFetch<{ samples: ResearchSample[] }>(
    "/api/admin/ai-theme-research/samples",
    { token }
  );
  return data.samples;
}

export async function uploadResearchSample(
  token: string,
  file: File
): Promise<ResearchSample> {
  const formData = new FormData();
  formData.append("file", file);
  const data = await adminFetch<{ sample: ResearchSample }>(
    "/api/admin/ai-theme-research/samples",
    { token, method: "POST", formData }
  );
  return data.sample;
}

export async function deleteResearchSample(token: string, sampleId: string): Promise<void> {
  await adminFetch(`/api/admin/ai-theme-research/samples/${encodeURIComponent(sampleId)}`, {
    token,
    method: "DELETE",
  });
}

export async function fetchResearchDrafts(token: string): Promise<ResearchDraft[]> {
  const data = await adminFetch<{ drafts: ResearchDraft[] }>(
    "/api/admin/ai-theme-research/drafts",
    { token }
  );
  return data.drafts;
}

export async function createResearchDraft(
  token: string,
  input: DraftInput
): Promise<ResearchDraft> {
  const data = await adminFetch<{ draft: ResearchDraft }>(
    "/api/admin/ai-theme-research/drafts",
    { token, method: "POST", body: input }
  );
  return data.draft;
}

export async function updateResearchDraft(
  token: string,
  draftId: string,
  input: DraftInput
): Promise<ResearchDraft> {
  const data = await adminFetch<{ draft: ResearchDraft }>(
    `/api/admin/ai-theme-research/drafts/${encodeURIComponent(draftId)}`,
    { token, method: "PUT", body: input }
  );
  return data.draft;
}

export async function deleteResearchDraft(token: string, draftId: string): Promise<void> {
  await adminFetch(`/api/admin/ai-theme-research/drafts/${encodeURIComponent(draftId)}`, {
    token,
    method: "DELETE",
  });
}

export async function fetchResearchRuns(token: string, limit = 20): Promise<ResearchRun[]> {
  const data = await adminFetch<{ runs: ResearchRun[] }>(
    `/api/admin/ai-theme-research/runs?limit=${limit}`,
    { token }
  );
  return data.runs;
}

export async function runResearchPreview(
  token: string,
  params: {
    sampleId: string;
    transformPrompt: string;
    negativePrompt: string;
    draftId?: string | null;
    qualityPreset?: string;
  }
): Promise<{ ok: boolean; run: ResearchRun }> {
  return adminFetch<{ ok: boolean; run: ResearchRun }>(
    "/api/admin/ai-theme-research/preview",
    { token, method: "POST", body: params }
  );
}

export async function publishResearchDraft(
  token: string,
  input: PublishInput
): Promise<{ theme: { id: string; label: string; publishedAt?: string } }> {
  const data = await adminFetch<{
    theme: { id: string; label: string; publishedAt?: string };
    activeThemeCount: number;
  }>("/api/admin/ai-theme-research/publish", {
    token,
    method: "POST",
    body: input,
  });
  return data;
}
