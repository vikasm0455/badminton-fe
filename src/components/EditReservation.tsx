"use client";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { ReservationView } from "@/lib/types";
import { Button, Field, TextInput, useToast } from "./ui";

const clampNum = (s: string, lo: number, hi: number, dflt: number) => {
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? dflt : Math.min(hi, Math.max(lo, n));
};

/** Inline editor for a logged court. Pre-filled with the reservation's current
 *  values; PUTs only the court details (logins aren't changed here). */
export default function EditReservation({
  r,
  onSaved,
  onCancel,
}: {
  r: ReservationView;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { show } = useToast();
  const [court, setCourt] = useState(String(r.court_number));
  const [courtType, setCourtType] = useState<"full" | "half">(r.court_type);
  const [players, setPlayers] = useState(String(r.player_count ?? 4));
  const [duration, setDuration] = useState(String(r.duration_minutes));
  const [queue, setQueue] = useState(r.queue_number ?? 0);
  const [notes, setNotes] = useState(r.notes ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await api.put(`/api/reservations/${r.id}`, {
        court_number: clampNum(court, 1, 53, r.court_number),
        court_type: courtType,
        player_count: clampNum(players, 1, 8, 4),
        duration_minutes: clampNum(duration, 1, 180, r.duration_minutes),
        queue_number: queue || null,
        notes: notes.trim() || null,
      });
      show("Court updated", "ok");
      onSaved();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Could not update", "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-xl border border-gray-200 p-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Court (1–53)">
          <TextInput
            type="number"
            inputMode="numeric"
            min={1}
            max={53}
            value={court}
            onChange={(e) => setCourt(e.target.value)}
            onBlur={() => setCourt((c) => String(clampNum(c, 1, 53, r.court_number)))}
          />
        </Field>
        <Field label="Players">
          <TextInput
            type="number"
            inputMode="numeric"
            min={1}
            max={8}
            value={players}
            onChange={(e) => setPlayers(e.target.value)}
            onBlur={() => setPlayers((p) => String(clampNum(p, 1, 8, 4)))}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Minutes (≤180)">
          <TextInput
            type="number"
            inputMode="numeric"
            min={1}
            max={180}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            onBlur={() => setDuration((d) => String(clampNum(d, 1, 180, r.duration_minutes)))}
          />
        </Field>
        <Field label="Queue slot">
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
      </div>

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

      <Field label="Notes (optional)">
        <TextInput maxLength={100} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Near the back wall" />
      </Field>

      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="flex-1" loading={busy} onClick={save}>
          Save changes
        </Button>
      </div>
    </div>
  );
}
