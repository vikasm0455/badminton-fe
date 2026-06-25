"use client";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { CredentialView, OcrResult } from "@/lib/types";
import { Button, Card, Field, Spinner, TextInput, useToast } from "./ui";
import CaptureButtons from "./CaptureButtons";

type Mode = "choose" | "reading" | "confirm";

export default function PostCredential({ onPosted }: { onPosted: (cred: CredentialView) => void }) {
  const { show } = useToast();
  const [mode, setMode] = useState<Mode>("choose");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [shotPath, setShotPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File) {
    // Images are downscaled in CaptureButtons before they reach here; this is
    // just a sanity ceiling for a pathological un-decodable file.
    if (file.size > 40 * 1024 * 1024) {
      show("That image is too large. Try a screenshot or enter manually.", "err");
      return;
    }
    setMode("reading");
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await api.postForm<OcrResult>("/api/credentials/ocr", form);
      setName(res.bintang_name);
      setPassword(res.bintang_password);
      setShotPath(res.screenshot_path);
      show(res.message, res.ok ? "ok" : "info");
      setMode("confirm");
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Auto-read unavailable — enter manually.", "err");
      setMode("confirm");
    }
  }

  async function post() {
    if (!name.trim() || !password.trim()) {
      show("Name and password are required.", "err");
      return;
    }
    setBusy(true);
    try {
      const created = await api.post<CredentialView>("/api/credentials", {
        bintang_name: name.trim(),
        bintang_password: password.trim(),
        screenshot_path: shotPath,
      });
      show("Login posted", "ok");
      reset();
      onPosted(created);
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Could not post", "err");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setMode("choose");
    setName("");
    setPassword("");
    setShotPath(null);
  }

  if (mode === "choose") {
    return (
      <Card>
        <p className="mb-1 text-sm font-semibold">Post a court login</p>
        <p className="mb-3 text-xs text-muted">
          Snap the kiosk screen and we&apos;ll read the name &amp; password — or enter them yourself.
        </p>
        <CaptureButtons onFile={onFile} />
        <Button variant="ghost" className="mt-2 w-full" onClick={() => setMode("confirm")}>
          ⌨️ Enter manually
        </Button>
      </Card>
    );
  }

  if (mode === "reading") {
    return (
      <Card>
        <div className="flex items-center gap-3">
          <Spinner small />
          <span className="text-sm text-muted">Reading the kiosk screen…</span>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold">Confirm login</h2>
        <button
          type="button"
          onClick={reset}
          className="-mr-1 rounded-lg px-2 py-1 text-sm font-medium text-muted active:bg-gray-100"
          aria-label="Back"
        >
          ✕ Back
        </button>
      </div>
      <div className="flex flex-col gap-3">
        <Field label="Name (blue text)">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} className="text-name font-bold" placeholder="Sharan" />
        </Field>
        <Field label="Password (red text)">
          <TextInput value={password} onChange={(e) => setPassword(e.target.value)} className="text-pass font-bold" placeholder="tiger77" />
        </Field>
        <Button className="w-full" loading={busy} onClick={post}>
          Confirm &amp; Post
        </Button>
      </div>
    </Card>
  );
}
