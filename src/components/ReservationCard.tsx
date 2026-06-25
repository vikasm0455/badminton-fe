"use client";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { ReservationView } from "@/lib/types";
import { Badge, Button, Card, useToast } from "./ui";
import Timer from "./Timer";

export default function ReservationCard({
  r,
  isAdmin,
  onChange,
}: {
  r: ReservationView;
  isAdmin?: boolean;
  onChange: () => void;
}) {
  const { show } = useToast();
  const [busy, setBusy] = useState(false);

  async function complete() {
    if (busy) return;
    setBusy(true);
    try {
      await api.put(`/api/reservations/${r.id}/complete`);
      show(`Court ${r.court_number} marked complete`, "ok");
      onChange();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Could not update", "err");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (busy) return;
    setBusy(true);
    try {
      await api.put(`/api/reservations/${r.id}/cancel`);
      onChange();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Could not cancel", "err");
    } finally {
      setBusy(false);
    }
  }

  const done = r.status !== "active";

  return (
    <Card className={done ? "opacity-70" : ""}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-extrabold">Court {r.court_number}</span>
            <Badge color={r.court_type === "full" ? "green" : "blue"}>
              {r.court_type === "full" ? "Full" : "Half"}
            </Badge>
            {r.queue_number && <Badge color="amber">Queue {r.queue_number}</Badge>}
          </div>
          <div className="mt-1 text-xs text-muted">
            {r.reserved_by_name}
            {r.attached_logins || r.credential_name ? ` · ${r.attached_logins ?? r.credential_name}` : ""}
            {r.player_count ? ` · ${r.player_count} players` : ""}
          </div>
        </div>
      </div>

      <div className="mt-3">
        <Timer startAt={r.start_at} expiryAt={r.expiry_at} status={r.status} />
      </div>

      {r.notes && <p className="mt-2 text-sm text-muted">📝 {r.notes}</p>}

      {r.duplicate_warning && (
        <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800">
          ⚠ Court {r.court_number} has a duplicate active reservation — verify with the group.
        </p>
      )}

      {r.status === "completed" && r.completed_by_name && (
        <p className="mt-2 text-xs text-muted">Completed by {r.completed_by_name}</p>
      )}

      {!done && (
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" className="flex-1 py-2 text-sm" loading={busy} onClick={complete}>
            Mark complete
          </Button>
          {isAdmin && (
            <Button variant="ghost" className="py-2 text-sm text-pass" onClick={cancel}>
              Cancel
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
