import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { API_BASE_URL } from "@/lib/env";

export type NewPhotoPayload = {
  user: string;
  filename: string;
  fullPath: string;
};

type UseNewPhotoSocketOptions = {
  user: string;
  onNewPhoto: (payload: NewPhotoPayload) => void;
  enabled?: boolean;
};

export function useNewPhotoSocket({
  user,
  onNewPhoto,
  enabled = true,
}: UseNewPhotoSocketOptions) {
  const onNewPhotoRef = useRef(onNewPhoto);
  onNewPhotoRef.current = onNewPhoto;

  useEffect(() => {
    if (!enabled || !user) return;

    const socket = io(API_BASE_URL, {
      transports: ["websocket"],
    });

    socket.on("new-photo", (payload: NewPhotoPayload) => {
      if (payload.user !== user) return;
      onNewPhotoRef.current(payload);
    });

    return () => {
      socket.disconnect();
    };
  }, [user, enabled]);
}
