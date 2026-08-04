"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useLiveEvents } from "@/lib/live";
import type { PollView, PublicUser } from "@/lib/types";
import { fmtDate } from "@/lib/time";
import { Button, Card, PageHeader, Spinner, useToast } from "@/components/ui";
import PollVote from "@/components/PollVote";

export default function PollDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { show } = useToast();

  const [poll, setPoll] = useState<PollView | null>(null);
  const [members, setMembers] = useState<PublicUser[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    const p = await api.get<PollView>(`/api/polls/${id}`);
    setPoll(p);
    return p;
  }, [id]);

  useEffect(() => {
    Promise.all([load(), api.get<PublicUser[]>("/api/members").then(setMembers)])
      .then(([p]) => {
        const pre = new Set<string>(p.attendees.map((a) => a.id));
        if (pre.size === 0) p.votes.filter((v) => v.vote === "yes").forEach((v) => pre.add(v.user_id));
        setChecked(pre);
      })
      .catch(() => show("Poll not found", "err"))
      .finally(() => setLoading(false));
  }, [load, show]);

  useLiveEvents((ev) => {
    if (ev.type === "poll_changed" && ev.poll_id === id) load();
  });

  function toggle(uid: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  async function confirmAttendance(lock: boolean) {
    setBusy(true);
    try {
      const updated = await api.post<PollView>(`/api/polls/${id}/attendance`, {
        user_ids: Array.from(checked),
        lock,
      });
      setPoll(updated);
      setConfirming(false);
      show(lock ? "Attendance confirmed" : "Attendance unlocked", "ok");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Could not save", "err");
    } finally {
      setBusy(false);
    }
  }

  async function deletePoll() {
    if (!confirm("Delete this poll?")) return;
    try {
      await api.del(`/api/polls/${id}`);
      router.replace("/history");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Could not delete", "err");
    }
  }

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [members]
  );

  if (loading || !poll) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <PageHeader title={fmtDate(poll.game_date)} />
      <div className="-mt-2 flex items-center justify-between">
        <p className="text-sm text-muted">Created by {poll.created_by_name}</p>
        <button
          type="button"
          className="text-sm font-medium text-brand-dark"
          onClick={async () => {
            try {
              const r = await api.post<{ url: string }>(`/api/polls/${id}/share-link`, undefined);
              if (navigator.share) {
                await navigator.share({ url: r.url }).catch(() => undefined);
              } else {
                await navigator.clipboard.writeText(r.url);
                show("Poll link copied — paste it in the group chat", "ok");
              }
            } catch (e) {
              show(e instanceof ApiError ? e.message : "Could not create the link", "err");
            }
          }}
        >
          ⇪ Share poll
        </button>
      </div>

      <Card>
        <PollVote poll={poll} onChange={setPoll} />
      </Card>

      {/* Attendance */}
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Attendance</h2>
          {poll.attendance_locked ? (
            <span className="text-xs text-muted">Confirmed</span>
          ) : (
            <Button className="px-3 py-1.5 text-sm" onClick={() => setConfirming((c) => !c)}>
              {confirming ? "Close" : "Confirm"}
            </Button>
          )}
        </div>

        {!confirming && poll.attendees.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {poll.attendees.map((a) => (
              <span key={a.id} className="rounded-full bg-brand-light px-2 py-0.5 text-xs text-brand-dark">
                ✓ {a.display_name}
              </span>
            ))}
          </div>
        )}
        {!confirming && poll.attendees.length === 0 && (
          <p className="text-sm text-muted">No attendance recorded yet.</p>
        )}

        {confirming && (
          <>
            <p className="mb-2 text-xs text-muted">Check everyone who actually played.</p>
            <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
              {sortedMembers.map((m) => (
                <label key={m.id} className="flex items-center gap-3 rounded-lg px-2 py-2 active:bg-gray-50">
                  <input type="checkbox" className="h-5 w-5" checked={checked.has(m.id)} onChange={() => toggle(m.id)} />
                  <span className="text-sm">{m.display_name}</span>
                </label>
              ))}
            </div>
            <Button className="mt-3 w-full" loading={busy} onClick={() => confirmAttendance(true)}>
              Lock in {checked.size} attendee{checked.size === 1 ? "" : "s"}
            </Button>
          </>
        )}

        {poll.attendance_locked && user?.active_group_role === "admin" && (
          <Button variant="ghost" className="mt-2 w-full text-sm" onClick={() => confirmAttendance(false)} loading={busy}>
            Unlock attendance (admin)
          </Button>
        )}
      </Card>

      {user?.active_group_role === "admin" && (
        <Button variant="ghost" className="text-pass" onClick={deletePoll}>
          Delete poll
        </Button>
      )}
    </div>
  );
}
