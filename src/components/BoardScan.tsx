"use client";
import { useState } from "react";
import { api, ApiError, serverNow } from "@/lib/api";
import type { BoardMatch, BoardScanResult } from "@/lib/types";
import { Button, Card, Spinner, useToast } from "./ui";
import CaptureButtons from "./CaptureButtons";

type Row = BoardMatch & { selected: boolean };
type Mode = "choose" | "reading" | "review";

/** Scan the facility status board: OCR every court, match the user's posted
 *  logins onto Current Players / Queue, and turn each into a reservation whose
 *  timer is read straight off the board (minutes-left). The user reviews and
 *  edits before anything is created. */
export default function BoardScan({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { show } = useToast();
  const [mode, setMode] = useState<Mode>("choose");
  const [rows, setRows] = useState<Row[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function onFile(file: File) {
    // Downscaled in CaptureButtons; sanity ceiling only.
    if (file.size > 40 * 1024 * 1024) {
      show("That image is too large. Try again with a screenshot.", "err");
      return;
    }
    setMode("reading");
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await api.postForm<BoardScanResult>("/api/reservations/scan-board", form);
      setRows(res.matches.map((m) => ({ ...m, selected: !m.already_in_use })));
      setMessage(res.message);
      setMode("review");
      if (res.matches.length === 0) show(res.message, "info");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Scan failed — try again or log manually.", "err");
      setMode("choose");
    }
  }

  function update(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function createSelected() {
    const chosen = rows.filter((r) => r.selected);
    if (chosen.length === 0) {
      show("Pick at least one court.", "err");
      return;
    }
    setBusy(true);
    let ok = 0;
    let fail = 0;
    for (const r of chosen) {
      try {
        const start_at =
          r.start_type === "at_time"
            ? new Date(serverNow() + r.start_in_minutes * 60000).toISOString()
            : undefined;
        await api.post("/api/reservations", {
          court_number: r.court_number,
          court_type: r.court_type,
          // A login that's already locked elsewhere can't be re-attached — log the
          // court without it rather than 409.
          credential_id: r.already_in_use ? null : r.credential_id,
          player_count: r.player_count,
          duration_minutes: r.duration_minutes,
          start_type: r.start_type,
          start_at,
          queue_number: r.location === "queue" ? Math.min(5, r.queue_position ?? 1) : null,
          notes: null,
        });
        ok++;
      } catch {
        fail++;
      }
    }
    setBusy(false);
    show(fail === 0 ? `Logged ${ok} court${ok === 1 ? "" : "s"}` : `Logged ${ok}, ${fail} failed`, fail === 0 ? "ok" : "err");
    onDone();
  }

  if (mode === "choose") {
    return (
      <Card>
        <div className="mb-3 flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold">Scan the court board</p>
            <p className="text-xs text-muted">
              Snap the facility board — we&apos;ll match your posted logins and read the minutes left for each court.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="-mr-1 rounded-lg px-2 py-1 text-sm font-medium text-muted active:bg-gray-100"
            aria-label="Back"
          >
            ✕
          </button>
        </div>
        <CaptureButtons onFile={onFile} labels={{ camera: "Scan board", upload: "Upload board" }} />
      </Card>
    );
  }

  if (mode === "reading") {
    return (
      <Card>
        <div className="flex items-center gap-3">
          <Spinner small />
          <span className="text-sm text-muted">Reading the board…</span>
        </div>
      </Card>
    );
  }

  const selectedCount = rows.filter((r) => r.selected).length;

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-base font-bold">Review courts</h2>
        <button
          type="button"
          onClick={onCancel}
          className="-mr-1 rounded-lg px-2 py-1 text-sm font-medium text-muted active:bg-gray-100"
          aria-label="Back"
        >
          ✕ Back
        </button>
      </div>
      <p className="mb-3 text-xs text-muted">{message}</p>

      {rows.length === 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">No posted logins matched the board. Post your court logins first, then rescan.</p>
          <Button variant="secondary" onClick={() => setMode("choose")}>
            Rescan
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((r, i) => (
            <div
              key={`${r.credential_id}-${r.court_number}`}
              className={`rounded-xl border-2 p-3 ${r.selected ? "border-brand bg-brand-light" : "border-gray-200"}`}
            >
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={r.selected} onChange={(e) => update(i, { selected: e.target.checked })} />
                <span className="font-bold">Court {r.court_number}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium">
                  {r.location === "current" ? "Playing now" : `Queue #${r.queue_position ?? "?"}`}
                </span>
                <span className="ml-auto truncate text-xs text-muted">{r.bintang_name}</span>
              </label>

              {r.already_in_use && (
                <p className="mt-1 text-xs text-amber-600">Login already on Court {r.in_use_court} — will log without it.</p>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <label className="flex items-center gap-1">
                  <span className="text-xs text-muted">{r.start_type === "now" ? "Ends in" : "Plays for"}</span>
                  <input
                    type="number"
                    min={1}
                    max={45}
                    value={r.duration_minutes}
                    onChange={(e) => update(i, { duration_minutes: Math.min(45, Math.max(1, Number(e.target.value) || 1)) })}
                    className="w-14 rounded border border-gray-300 px-2 py-1 text-center"
                  />
                  <span className="text-xs">min</span>
                </label>

                {r.start_type === "at_time" && (
                  <label className="flex items-center gap-1">
                    <span className="text-xs text-muted">Starts in</span>
                    <input
                      type="number"
                      min={2}
                      max={170}
                      value={r.start_in_minutes}
                      onChange={(e) => update(i, { start_in_minutes: Math.min(170, Math.max(2, Number(e.target.value) || 2)) })}
                      className="w-14 rounded border border-gray-300 px-2 py-1 text-center"
                    />
                    <span className="text-xs">min</span>
                  </label>
                )}

                <label className="flex items-center gap-1">
                  <span className="text-xs text-muted">Type</span>
                  <select
                    value={r.court_type}
                    onChange={(e) => update(i, { court_type: e.target.value as "full" | "half" })}
                    className="rounded border border-gray-300 px-2 py-1"
                  >
                    <option value="full">Full</option>
                    <option value="half">Half</option>
                  </select>
                </label>
              </div>
            </div>
          ))}

          <div className="mt-1 flex gap-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => setMode("choose")}>
              Rescan
            </Button>
            <Button className="flex-1" loading={busy} onClick={createSelected}>
              Log {selectedCount} court{selectedCount === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
