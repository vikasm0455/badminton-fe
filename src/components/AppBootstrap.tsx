"use client";
import { useEffect } from "react";
import { useForegroundPush } from "@/lib/live";
import { useToast } from "./ui";

/** Registers the Service Worker and surfaces foreground push as in-app toasts. */
export default function AppBootstrap() {
  const { show } = useToast();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Auto-reload once when a NEW worker takes control (guarded so a first-ever
    // install doesn't reload itself). This is what makes deploys show up without
    // deleting/re-adding the home-screen app.
    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    }

    let reg: ServiceWorkerRegistration | undefined;
    const checkForUpdate = () => reg?.update().catch(() => {});
    const onVisible = () => {
      if (document.visibilityState === "visible") checkForUpdate();
    };

    navigator.serviceWorker
      .register("/sw.js")
      .then((r) => {
        reg = r;
        checkForUpdate(); // check immediately on load
      })
      .catch((e) => console.warn("SW registration failed", e));

    // Re-check whenever the PWA is reopened/refocused, plus hourly while open.
    document.addEventListener("visibilitychange", onVisible);
    const iv = window.setInterval(checkForUpdate, 60 * 60 * 1000);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(iv);
    };
  }, []);

  useForegroundPush((payload) => {
    show(`${payload.title} — ${payload.body}`, "info");
  });

  return null;
}
