import { Router } from "express";
import multer from "multer";
import { isAdminApiEnabled, requireAdminToken } from "../../services/adminAuth.js";
import {
  addResearchSample,
  createResearchDraft,
  deleteResearchDraft,
  deleteResearchSample,
  getResearchMeta,
  listResearchDraftsPublic,
  listResearchRuns,
  listResearchSamples,
  mapResearchError,
  publishDraftAsTheme,
  runResearchPreview,
  updateResearchDraft,
  uploadDraftBackground,
  listCostumePresets,
} from "../../services/aiThemeResearch.js";
import { toPublicDraftBackground } from "../../services/aiThemeStudio.js";
import { getActiveAiThemes } from "../../services/aiThemeCatalog.js";
import { getAiCostSummary } from "../../services/aiAnalytics.js";
import { getOpenAiPricingHints } from "../../services/openAiPricing.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.AI_RESEARCH_IMAGE_MAX_BYTES) || 20 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|jpg|png|webp)$/i.test(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("invalid_file_type"));
  },
});

/**
 * @param {{ baseDir: string, publicHost: string }} options
 */
export function createAiThemeResearchRouter({ baseDir, publicHost }) {
  const router = Router();

  router.get("/meta", requireAdminToken, (_req, res) => {
    res.json(getResearchMeta(baseDir, publicHost));
  });

  router.get("/samples", requireAdminToken, (_req, res) => {
    try {
      res.json({
        ok: true,
        samples: listResearchSamples(baseDir, publicHost),
      });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post("/samples", requireAdminToken, upload.single("file"), (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ ok: false, error: "file_required" });
        return;
      }

      const sample = addResearchSample(baseDir, {
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
      });

      res.status(201).json({
        ok: true,
        sample: {
          id: sample.id,
          originalName: sample.originalName,
          url: `http://${publicHost}/research/files/samples/${sample.filename}`,
          createdAt: sample.createdAt,
        },
      });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.delete("/samples/:id", requireAdminToken, (req, res) => {
    try {
      deleteResearchSample(baseDir, req.params.id);
      res.json({ ok: true });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get("/costume-presets", requireAdminToken, (_req, res) => {
    res.json({ ok: true, presets: listCostumePresets() });
  });

  router.get("/drafts", requireAdminToken, (_req, res) => {
    try {
      res.json({ ok: true, drafts: listResearchDraftsPublic(baseDir, publicHost) });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post("/drafts", requireAdminToken, (req, res) => {
    try {
      const draft = createResearchDraft(baseDir, req.body ?? {});
      res.status(201).json({ ok: true, draft });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.put("/drafts/:id", requireAdminToken, (req, res) => {
    try {
      const draft = updateResearchDraft(baseDir, req.params.id, req.body ?? {});
      res.json({ ok: true, draft });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.delete("/drafts/:id", requireAdminToken, (req, res) => {
    try {
      deleteResearchDraft(baseDir, req.params.id);
      res.json({ ok: true });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post(
    "/drafts/:id/background",
    requireAdminToken,
    upload.single("file"),
    async (req, res) => {
      try {
        if (!req.file) {
          res.status(400).json({ ok: false, error: "file_required" });
          return;
        }

        const draft = await uploadDraftBackground(baseDir, req.params.id, req.file.buffer);
        const background = toPublicDraftBackground(baseDir, publicHost, draft);

        res.status(201).json({
          ok: true,
          draft: {
            ...draft,
            ...background,
          },
        });
      } catch (err) {
        sendError(res, err);
      }
    }
  );

  router.get("/runs", requireAdminToken, (req, res) => {
    try {
      const limit = Number(req.query.limit) || 50;
      res.json({
        ok: true,
        runs: listResearchRuns(baseDir, publicHost, { limit }),
      });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get("/usage", requireAdminToken, (req, res) => {
    try {
      const days = Number(req.query.days) || 30;
      const source = req.query.source ? String(req.query.source) : null;
      res.json({
        ok: true,
        pricing: getOpenAiPricingHints(),
        usage: getAiCostSummary(baseDir, { days, source }),
      });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post("/preview", requireAdminToken, async (req, res) => {
    try {
      const run = await runResearchPreview(baseDir, publicHost, req.body ?? {});
      const ok = run.status === "ready";
      res.status(ok ? 201 : 200).json({ ok, run });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post("/publish", requireAdminToken, (req, res) => {
    try {
      const theme = publishDraftAsTheme(baseDir, req.body ?? {});
      res.status(201).json({
        ok: true,
        theme: {
          id: theme.id,
          label: theme.label,
          description: theme.description,
          previewColor: theme.previewColor,
          publishedAt: theme.publishedAt,
        },
        activeThemeCount: getActiveAiThemes(baseDir).length,
      });
    } catch (err) {
      sendError(res, err);
    }
  });

  return router;
}

/**
 * @param {import("express").Response} res
 * @param {unknown} err
 */
function sendError(res, err) {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    res.status(400).json({ ok: false, error: "file_too_large" });
    return;
  }
  if (err instanceof Error && err.message === "invalid_file_type") {
    res.status(400).json({ ok: false, error: "invalid_file_type" });
    return;
  }

  const mapped = mapResearchError(err);
  console.error("[ai-theme-research]", err);
  res.status(mapped.status).json(mapped.body);
}

/**
 * @param {{ baseDir: string, publicHost: string }} options
 */
export function createAdminRouter({ baseDir, publicHost }) {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({
      ok: isAdminApiEnabled(),
      service: "admin",
      adminEnabled: isAdminApiEnabled(),
      endpoints: [
        "GET /api/admin/ai-theme-research/meta",
        "GET /api/admin/ai-theme-research/samples",
        "POST /api/admin/ai-theme-research/samples",
        "GET /api/admin/ai-theme-research/drafts",
        "POST /api/admin/ai-theme-research/preview",
        "POST /api/admin/ai-theme-research/publish",
        "POST /api/admin/ai-theme-research/drafts/:id/background",
        "GET /api/admin/ai-theme-research/costume-presets",
        "GET /api/admin/ai-theme-research/usage",
      ],
    });
  });

  router.use(
    "/ai-theme-research",
    createAiThemeResearchRouter({ baseDir, publicHost })
  );

  return router;
}
