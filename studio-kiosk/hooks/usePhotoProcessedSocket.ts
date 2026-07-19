import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { API_BASE_URL } from "@/lib/env";
import type { ProcessingStatus } from "@/lib/imageTypes";

export type PhotoProcessedPayload = {
  user: string;
  imageId: string;
  status: Extract<ProcessingStatus, "ready" | "failed">;
  subjectUrl?: string;
  passportUrl?: string;
  themedUrl?: string;
  bakedLookId?: string;
  error?: string;
};

type UsePhotoProcessedSocketOptions = {
  user: string;
  onPhotoProcessed: (payload: PhotoProcessedPayload) => void;
  enabled?: boolean;
};

export function usePhotoProcessedSocket({
  user,
  onPhotoProcessed,
  enabled = true,
}: UsePhotoProcessedSocketOptions) {
  const onPhotoProcessedRef = useRef(onPhotoProcessed);

  useEffect(() => {
    onPhotoProcessedRef.current = onPhotoProcessed;
  }, [onPhotoProcessed]);

  useEffect(() => {
    if (!enabled || !user) return;

    const socket = io(API_BASE_URL, {
      transports: ["websocket"],
    });

    socket.on("photo-processed", (payload: PhotoProcessedPayload) => {
      if (payload.user !== user) return;
      onPhotoProcessedRef.current(payload);
    });

    return () => {
      socket.disconnect();
    };
  }, [user, enabled]);
}
