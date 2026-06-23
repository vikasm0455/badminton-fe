"use client";
import { useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { CredentialView, OcrResult } from "@/lib/types";
import { Button, Card, Field, Spinner, TextInput, useToast } from "./ui";

type Mode = "choose" | "reading" | "confirm";

export default function PostCredential({ onPosted }: { onPosted: () => void }) {
  const { show } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("choose");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [shotPath, setShotPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      show("Photo too large (max 10MB). Retake or enter manually.", "err");
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
      await api.post<CredentialView>("/api/credentials", {
        bintang_name: name.trim(),
        bintang_password: password.trim(),
        screenshot_path: shotPath,
      });
      show("Login posted", "ok");
      reset();
      onPosted();
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
        <p className="mb-3 text-sm font-semibold">Post a court login</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            📷 Screenshot
          </Button>
          <Button variant="secondary" onClick={() => setMode("confirm")}>
            ⌨️ Manual
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg"
          capture="environment"
          className="hidden"
          onChange={onFile}
        />
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
      <div className="flex flex-col gap-3">
        <Field label="Name (blue text)">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} className="text-name font-bold" placeholder="Sharan" />
        </Field>
        <Field label="Password (red text)">
          <TextInput value={password} onChange={(e) => setPassword(e.target.value)} className="text-pass font-bold" placeholder="tiger77" />
        </Field>
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={reset}>
            Cancel
          </Button>
          <Button className="flex-1" loading={busy} onClick={post}>
            Confirm &amp; Post
          </Button>
        </div>
      </div>
    </Card>
  );
}
