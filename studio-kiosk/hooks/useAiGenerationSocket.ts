import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { API_BASE_URL } from "@/lib/env";

export type AiGenerationProgressPayload = {
  user: string;
  imageId: string;
  themeId: string;
  jobId: string;
  status: "processing" | "queued";
  phase?: string | null;
};

export type AiGenerationCompletePayload = {
  user: string;
  imageId: string;
  themeId: string;
  jobId: string;
  status: "ready" | "failed";
  aiUrl?: string;
  outputPath?: string;
  error?: string;
  errorCode?: string;
};

type UseAiGenerationSocketOptions = {
  user: string;
  enabled?: boolean;
  onProgress?: (payload: AiGenerationProgressPayload) => void;
  onComplete?: (payload: AiGenerationCompletePayload) => void;
};

export function useAiGenerationSocket({
  user,
  enabled = true,
  onProgress,
  onComplete,
}: UseAiGenerationSocketOptions) {
  const onProgressRef = useRef(onProgress);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!enabled || !user) return;

    const socket = io(API_BASE_URL, {
      transports: ["websocket"],
    });

    socket.on("ai-generation-progress", (payload: AiGenerationProgressPayload) => {
      if (payload.user !== user) return;
      onProgressRef.current?.(payload);
    });

    socket.on("ai-generation-complete", (payload: AiGenerationCompletePayload) => {
      if (payload.user !== user) return;
      onCompleteRef.current?.(payload);
    });

    return () => {
      socket.disconnect();
    };
  }, [user, enabled]);
}
