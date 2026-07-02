"use client";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { CredentialView, GroupBrief, OcrResult } from "@/lib/types";
import { Button, Card, Field, Spinner, TextInput, useToast } from "./ui";
import CaptureButtons from "./CaptureButtons";

type Mode = "choose" | "reading" | "confirm";
type Row = { id: string; name: string; password: string };

const blankRow = (): Row => ({ id: crypto.randomUUID(), name: "", password: "" });

export default function PostCredential({ onPosted }: { onPosted: (cred: CredentialView) => void }) {
  const { show } = useToast();
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("choose");
  const [rows, setRows] = useState<Row[]>([]);
  const [shotPath, setShotPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Which groups the posted login(s) are shared with — defaults to the group
  // you're playing with. Only shown when the user is in more than one group.
  const [myGroups, setMyGroups] = useState<GroupBrief[]>([]);
  const [shareIds, setShareIds] = useState<string[]>(user?.active_group_id ? [user.active_group_id] : []);

  useEffect(() => {
    if (mode === "confirm" && myGroups.length === 0 && (user?.groups_count ?? 0) > 1) {
      api.get<GroupBrief[]>("/api/groups").then(setMyGroups).catch(() => {});
    }
  }, [mode, myGroups.length, user?.groups_count]);

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
      setRows(
        res.logins.length > 0
          ? res.logins.map((l) => ({ id: crypto.randomUUID(), name: l.bintang_name, password: l.bintang_password }))
          : [blankRow()]
      );
      setShotPath(res.screenshot_path);
      show(res.message, res.ok ? "ok" : "info");
      setMode("confirm");
    } catch (err) {
      setRows([blankRow()]);
      setShotPath(null);
      show(err instanceof ApiError ? err.message : "Auto-read unavailable — enter manually.", "err");
      setMode("confirm");
    }
  }

  function update(id: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function removeRow(id: string) {
    setRows((rs) => (rs.length <= 1 ? rs : rs.filter((r) => r.id !== id)));
  }

  async function post() {
    const valid = rows
      .map((r) => ({ name: r.name.trim(), password: r.password.trim() }))
      .filter((r) => r.name && r.password);
    if (valid.length === 0) {
      show("Name and password are required.", "err");
      return;
    }
    setBusy(true);
    let created: CredentialView | null = null;
    let ok = 0;
    let fail = 0;
    const group_ids = shareIds.length > 0 ? shareIds : undefined; // default = active group
    for (const r of valid) {
      try {
        created = await api.post<CredentialView>("/api/credentials", {
          bintang_name: r.name,
          bintang_password: r.password,
          screenshot_path: shotPath,
          group_ids,
        });
        ok++;
      } catch {
        fail++;
      }
    }
    setBusy(false);
    if (ok === 0) {
      show("Could not post", "err");
      return;
    }
    show(fail === 0 ? `Posted ${ok} login${ok === 1 ? "" : "s"}` : `Posted ${ok}, ${fail} failed`, fail === 0 ? "ok" : "err");
    reset();
    if (created) onPosted(created);
  }

  function reset() {
    setMode("choose");
    setRows([]);
    setShotPath(null);
  }

  if (mode === "choose") {
    return (
      <Card>
        <p className="mb-1 text-sm font-semibold">Post a court login</p>
        <p className="mb-3 text-xs text-muted">
          Snap the kiosk screen or a note — we&apos;ll read every name &amp; password — or enter them yourself.
        </p>
        <CaptureButtons onFile={onFile} />
        <Button variant="ghost" className="mt-2 w-full" onClick={() => { setRows([blankRow()]); setShotPath(null); setMode("confirm"); }}>
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
          <span className="text-sm text-muted">Reading the login(s)…</span>
        </div>
      </Card>
    );
  }

  const fillable = rows.filter((r) => r.name.trim() && r.password.trim()).length || rows.length;

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold">{rows.length > 1 ? `Confirm ${rows.length} logins` : "Confirm login"}</h2>
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
        {rows.map((r, i) => (
          <div key={r.id} className={rows.length > 1 ? "rounded-xl border border-gray-200 p-3" : ""}>
            {rows.length > 1 && (
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted">Login {i + 1}</span>
                <button type="button" onClick={() => removeRow(r.id)} className="text-xs font-medium text-pass">
                  Remove
                </button>
              </div>
            )}
            <Field label="Name (blue text)">
              <TextInput
                value={r.name}
                onChange={(e) => update(r.id, { name: e.target.value })}
                className="text-name font-bold"
                placeholder="Suchi"
              />
            </Field>
            <div className="mt-2">
              <Field label="Password (red text)">
                <TextInput
                  value={r.password}
                  onChange={(e) => update(r.id, { password: e.target.value })}
                  className="text-pass font-bold"
                  placeholder="lion16"
                />
              </Field>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setRows((rs) => [...rs, blankRow()])}
          className="text-sm font-medium text-brand-dark"
        >
          ＋ Add another login
        </button>

        {myGroups.length > 1 && (
          <div className="rounded-xl border border-gray-200 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Share with</p>
            <div className="flex flex-col gap-1.5">
              {myGroups.map((g) => (
                <label key={g.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={shareIds.includes(g.id)}
                    onChange={(e) =>
                      setShareIds((ids) =>
                        e.target.checked ? [...new Set([...ids, g.id])] : ids.filter((x) => x !== g.id)
                      )
                    }
                  />
                  <span className="font-medium">{g.name}</span>
                  {g.is_active && <span className="text-xs text-muted">(current)</span>}
                </label>
              ))}
            </div>
          </div>
        )}

        <Button className="w-full" loading={busy} disabled={shareIds.length === 0 && myGroups.length > 1} onClick={post}>
          {rows.length > 1 ? `Post ${fillable} logins` : "Confirm & Post"}
        </Button>
      </div>
    </Card>
  );
}
