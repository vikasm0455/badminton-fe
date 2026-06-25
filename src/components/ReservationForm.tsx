"use client";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { CredentialView } from "@/lib/types";
import { Button, Card, Field, TextInput, useToast } from "./ui";
import PostCredential from "./PostCredential";

export default function ReservationForm({
  creds,
  onCreated,
  onCancel,
  onCredsChanged,
}: {
  creds: CredentialView[];
  onCreated: () => void;
  onCancel: () => void;
  /** Refresh the credential list after a login is added inline. */
  onCredsChanged?: () => void;
}) {
  const { show } = useToast();
  const [court, setCourt] = useState(1);
  const [courtType, setCourtType] = useState<"full" | "half">("full");
  const [credId, setCredId] = useState<string>("");
  const [showAddLogin, setShowAddLogin] = useState(false);
  const [players, setPlayers] = useState(4);
  const [duration, setDuration] = useState(45);
  const [startType, setStartType] = useState<"now" | "at_time">("now");
  const [startTime, setStartTime] = useState("");
  const [queue, setQueue] = useState(0);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      let startAt: string | undefined;
      if (startType === "at_time") {
        if (!startTime) throw new ApiError("Pick a start time.", 400);
        const [h, m] = startTime.split(":").map(Number);
        const d = new Date();
        d.setHours(h, m, 0, 0);
        startAt = d.toISOString();
      }
      await api.post("/api/reservations", {
        court_number: court,
        court_type: courtType,
        credential_id: credId || null,
        player_count: players,
        duration_minutes: duration,
        start_type: startType,
        start_at: startAt,
        queue_number: queue || null,
        notes: notes.trim() || null,
      });
      show(`Court ${court} logged`, "ok");
      onCreated();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Could not log reservation", "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold">Log a court</h2>
        <button
          type="button"
          onClick={onCancel}
          className="-mr-1 rounded-lg px-2 py-1 text-sm font-medium text-muted active:bg-gray-100"
          aria-label="Back"
        >
          ✕ Back
        </button>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Court number (1–53)">
          <div className="flex items-center gap-3">
            <button type="button" className="rounded-xl bg-gray-100 px-4 text-2xl" onClick={() => setCourt((c) => Math.max(1, c - 1))}>
              −
            </button>
            <TextInput
              type="number"
              min={1}
              max={53}
              value={court}
              onChange={(e) => setCourt(Math.min(53, Math.max(1, Number(e.target.value) || 1)))}
              className="text-center text-xl font-bold"
            />
            <button type="button" className="rounded-xl bg-gray-100 px-4 text-2xl" onClick={() => setCourt((c) => Math.min(53, c + 1))}>
              +
            </button>
          </div>
        </Field>

        <Field label="Court type">
          <div className="grid grid-cols-2 gap-2">
            {(["full", "half"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setCourtType(t)}
                className={`rounded-xl border-2 py-2 font-medium ${
                  courtType === t ? "border-brand bg-brand-light text-brand-dark" : "border-gray-200"
                }`}
              >
                {t === "full" ? "Full (4)" : "Half (2)"}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Court login">
          <select
            value={credId}
            onChange={(e) => setCredId(e.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-base"
          >
            <option value="">Skip login</option>
            {creds.map((c) => (
              <option key={c.id} value={c.id} disabled={c.in_use}>
                {c.bintang_name}
                {c.in_use ? ` (in use — Court ${c.in_use_court})` : ""}
              </option>
            ))}
          </select>
          {!showAddLogin ? (
            <button
              type="button"
              onClick={() => setShowAddLogin(true)}
              className="mt-2 text-sm font-medium text-brand-dark"
            >
              📷 Scan / add a login
            </button>
          ) : (
            <div className="mt-2">
              <PostCredential
                onPosted={(c) => {
                  setCredId(c.id);
                  setShowAddLogin(false);
                  onCredsChanged?.();
                  show(`Login “${c.bintang_name}” added & selected`, "ok");
                }}
              />
              <button
                type="button"
                onClick={() => setShowAddLogin(false)}
                className="mt-1 text-xs font-medium text-muted"
              >
                Cancel adding login
              </button>
            </div>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Players">
            <TextInput type="number" min={1} max={8} value={players} onChange={(e) => setPlayers(Number(e.target.value) || 1)} />
          </Field>
          <Field label="Minutes (≤45)">
            <TextInput type="number" min={1} max={45} value={duration} onChange={(e) => setDuration(Math.min(45, Math.max(1, Number(e.target.value) || 1)))} />
          </Field>
        </div>

        <Field label="Start">
          <div className="grid grid-cols-2 gap-2">
            {(["now", "at_time"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStartType(s)}
                className={`rounded-xl border-2 py-2 font-medium ${
                  startType === s ? "border-brand bg-brand-light text-brand-dark" : "border-gray-200"
                }`}
              >
                {s === "now" ? "Starts now" : "Starts at…"}
              </button>
            ))}
          </div>
        </Field>

        {startType === "at_time" && (
          <Field label="Start time" hint="Must be within the next 3 hours.">
            <TextInput type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </Field>
        )}

        <Field label="Queue slot (optional)">
          <select
            value={queue}
            onChange={(e) => setQueue(Number(e.target.value))}
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-base"
          >
            <option value={0}>None</option>
            {[1, 2, 3, 4, 5].map((q) => (
              <option key={q} value={q}>
                Queue {q}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Notes (optional)">
          <TextInput maxLength={100} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Near the back wall" />
        </Field>

        <div className="flex gap-2">
          <Button type="button" variant="ghost" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" loading={busy}>
            Log court
          </Button>
        </div>
      </form>
    </Card>
  );
}
