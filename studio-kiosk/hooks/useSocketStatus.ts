"use client";

import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "@/lib/env";

export function useSocketStatus(enabled = true) {
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    if (!enabled) return;

    let socket: Socket | null = null;

    socket = io(API_BASE_URL, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
    });

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    if (!socket.connected) {
      setConnected(false);
    }

    return () => {
      socket?.off("connect", onConnect);
      socket?.off("disconnect", onDisconnect);
      socket?.disconnect();
    };
  }, [enabled]);

  return connected;
}
