"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePhotoProcessedSocket } from "@/hooks/usePhotoProcessedSocket";
import {
  applyTheme,
  pollImageStatus,
  processRemoveBackground,
} from "@/services/image.service";
import { useGalleryStore } from "@/stores/useGalleryStore";
import type { ProcessingStatus } from "@/lib/imageTypes";

type UseImageProcessingOptions = {
  user: string;
  enabled?: boolean;
  initialThemeId?: string;
  onRefresh: () => void | Promise<void>;
  onError?: (message: string) => void;
};

type PollEntry = {
  controller: AbortController;
};

export function useImageProcessing({
  user,
  enabled = true,
  initialThemeId,
  onRefresh,
  onError,
}: UseImageProcessingOptions) {
  const setImages = useGalleryStore((state) => state.setImages);
  const [processingImageId, setProcessingImageId] = useState<string | null>(
    null
  );
  const [selectedThemeId, setSelectedThemeId] = useState(
    initialThemeId ?? "wc2026-stadium-night"
  );
  const pollsRef = useRef<Map<string, PollEntry>>(new Map());
  const processingImageIdRef = useRef<string | null>(null);
  const onRefreshRef = useRef(onRefresh);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    processingImageIdRef.current = processingImageId;
  }, [processingImageId]);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (initialThemeId) {
      setSelectedThemeId(initialThemeId);
    }
  }, [initialThemeId]);

  const cancelPoll = useCallback((imageId: string) => {
    const entry = pollsRef.current.get(imageId);
    if (entry) {
      entry.controller.abort();
      pollsRef.current.delete(imageId);
    }
  }, []);

  const setOptimisticPending = useCallback(
    (imageId: string) => {
      const current = useGalleryStore.getState().images;
      setImages(
        current.map((img) =>
          img.imageId === imageId
            ? {
                ...img,
                processingStatus: "pending" as ProcessingStatus,
                processingError: null,
              }
            : img
        )
      );
    },
    [setImages]
  );

  const waitForProcessing = useCallback(
    async (imageId: string) => {
      cancelPoll(imageId);

      const controller = new AbortController();
      pollsRef.current.set(imageId, { controller });

      try {
        const result = await pollImageStatus(user, imageId, {
          intervalMs: 2000,
          maxMs: 120_000,
          signal: controller.signal,
        });

        if (result.status === "failed") {
          throw new Error(
            result.error || "Proses foto gagal. Silakan coba lagi."
          );
        }
      } catch (err) {
        if (err instanceof Error && err.message === "poll_aborted") {
          return;
        }
        if (err instanceof Error && err.message === "poll_timeout") {
          throw new Error(
            "Proses foto terlalu lama. Silakan refresh halaman atau coba lagi."
          );
        }
        throw err;
      } finally {
        pollsRef.current.delete(imageId);
      }
    },
    [user, cancelPoll]
  );

  const runProcessingJob = useCallback(
    async (imageId: string, startJob: () => Promise<unknown>) => {
      if (!user || !enabled || processingImageIdRef.current) return;

      setProcessingImageId(imageId);
      setOptimisticPending(imageId);

      try {
        await startJob();
        await waitForProcessing(imageId);
        await onRefreshRef.current();
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Proses foto gagal. Silakan coba lagi.";
        onErrorRef.current?.(message);
        await onRefreshRef.current();
      } finally {
        setProcessingImageId(null);
      }
    },
    [user, enabled, setOptimisticPending, waitForProcessing]
  );

  const runRemoveBackground = useCallback(
    (imageId: string) =>
      runProcessingJob(imageId, () => processRemoveBackground(user, imageId)),
    [runProcessingJob, user]
  );

  const runApplyTheme = useCallback(
    (imageId: string, themeId?: string) => {
      const resolvedThemeId = themeId ?? selectedThemeId;
      return runProcessingJob(imageId, () =>
        applyTheme(user, imageId, resolvedThemeId)
      );
    },
    [runProcessingJob, selectedThemeId, user]
  );

  usePhotoProcessedSocket({
    user,
    enabled: enabled && Boolean(user),
    onPhotoProcessed: (payload) => {
      cancelPoll(payload.imageId);
      void onRefreshRef.current();

      if (payload.status === "failed" && payload.error) {
        onErrorRef.current?.(payload.error);
      }

      if (processingImageIdRef.current === payload.imageId) {
        setProcessingImageId(null);
      }
    },
  });

  useEffect(() => {
    const polls = pollsRef.current;
    return () => {
      for (const imageId of polls.keys()) {
        const entry = polls.get(imageId);
        entry?.controller.abort();
        polls.delete(imageId);
      }
    };
  }, []);

  return {
    processingImageId,
    selectedThemeId,
    setSelectedThemeId,
    runRemoveBackground,
    runApplyTheme,
    isProcessing: (imageId: string) => processingImageId === imageId,
    isBusy: processingImageId !== null,
  };
}
