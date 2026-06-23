"use client";
import { useEffect } from "react";
import { useForegroundPush } from "@/lib/live";
import { useToast } from "./ui";

/** Registers the Service Worker and surfaces foreground push as in-app toasts. */
export default function AppBootstrap() {
  const { show } = useToast();

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((e) => {
        console.warn("SW registration failed", e);
      });
    }
  }, []);

  useForegroundPush((payload) => {
    show(`${payload.title} — ${payload.body}`, "info");
  });

  return null;
}
