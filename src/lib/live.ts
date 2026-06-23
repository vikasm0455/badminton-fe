"use client";
import { useEffect, useRef } from "react";

export interface LiveEvent {
  type:
    | "reservations_changed"
    | "poll_changed"
    | "credentials_changed"
    | "kcal_changed"
    | "ping";
  poll_id?: string;
}

/**
 * Subscribe to the server's SSE nudge stream (PRD §14.4). The browser handles
 * reconnection automatically; we just hand each parsed event to the callback.
 */
export function useLiveEvents(onEvent: (ev: LiveEvent) => void) {
  const cb = useRef(onEvent);
  cb.current = onEvent;

  useEffect(() => {
    let es: EventSource | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      es = new EventSource("/api/reservations/stream", { withCredentials: true });
      es.onmessage = (e) => {
        try {
          cb.current(JSON.parse(e.data) as LiveEvent);
        } catch {
          /* keep-alive / non-JSON line */
        }
      };
      es.onerror = () => {
        // EventSource auto-reconnects; nothing to do.
      };
    };
    connect();

    return () => {
      closed = true;
      es?.close();
    };
  }, []);
}

/** Also relay in-app push messages forwarded by the Service Worker. */
export function useForegroundPush(onPush: (payload: { title: string; body: string }) => void) {
  const cb = useRef(onPush);
  cb.current = onPush;
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "push") cb.current(e.data.payload);
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);
}
