import { useCallback, useEffect, useRef } from "react";
import {
  getPreviewUrl,
  pollImageUntilSettled,
  refreshLatestPreview,
} from "../services/api";

/**
 * Sync latest shot preview with socket + polling fallback.
 */
export function useKioskPreview({ userSlug, enabled, onPreviewUpdate }) {
  const pollAbortRef = useRef(null);

  const cancelPoll = useCallback(() => {
    pollAbortRef.current?.abort();
    pollAbortRef.current = null;
  }, []);

  const refreshPreview = useCallback(async () => {
    if (!userSlug || !enabled) return;

    const result = await refreshLatestPreview(userSlug);
    onPreviewUpdate({
      previewUrl: result.previewUrl,
      isProcessing: result.isProcessing,
      image: result.image,
    });
    return result;
  }, [userSlug, enabled, onPreviewUpdate]);

  const waitForImageProcessing = useCallback(
    async (imageId) => {
      if (!userSlug || !imageId) return;

      cancelPoll();
      const controller = new AbortController();
      pollAbortRef.current = controller;

      try {
        const status = await pollImageUntilSettled({
          userSlug,
          imageId,
          signal: controller.signal,
        });

        const latest = await refreshLatestPreview(userSlug);
        onPreviewUpdate({
          previewUrl: latest.previewUrl,
          isProcessing: false,
          image: latest.image,
          failed: status.status === "failed",
          error: status.error ?? null,
        });
      } catch (err) {
        if (err instanceof Error && err.message === "poll_aborted") {
          return;
        }
        await refreshPreview();
      } finally {
        if (pollAbortRef.current === controller) {
          pollAbortRef.current = null;
        }
      }
    },
    [userSlug, cancelPoll, onPreviewUpdate, refreshPreview]
  );

  const handlePhotoProcessed = useCallback(
    (payload) => {
      if (!userSlug || payload.user !== userSlug) return;

      cancelPoll();

      if (payload.status === "ready") {
        const previewUrl = payload.originalUrl ?? payload.subjectUrl ?? null;
        onPreviewUpdate({
          previewUrl,
          isProcessing: false,
          failed: false,
          error: null,
        });
        return;
      }

      if (payload.status === "failed") {
        onPreviewUpdate({
          isProcessing: false,
          failed: true,
          error: payload.error ?? "Proses foto gagal.",
        });
      }
    },
    [userSlug, cancelPoll, onPreviewUpdate]
  );

  useEffect(() => cancelPoll, [cancelPoll]);

  return {
    refreshPreview,
    waitForImageProcessing,
    handlePhotoProcessed,
    cancelPoll,
  };
}

export { getPreviewUrl };
