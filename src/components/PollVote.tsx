"use client";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { PollView, VoteValue } from "@/lib/types";
import { fmtHHMM } from "@/lib/time";
import { Badge, useToast } from "./ui";

const OPTIONS: { value: VoteValue; label: string; emoji: string }[] = [
  { value: "yes", label: "Yes", emoji: "✅" },
  { value: "maybe", label: "Maybe", emoji: "🤔" },
  { value: "no", label: "No", emoji: "❌" },
];

export default function PollVote({
  poll,
  onChange,
  compact,
}: {
  poll: PollView;
  onChange: (p: PollView) => void;
  compact?: boolean;
}) {
  const { show } = useToast();
  const [busy, setBusy] = useState(false);

  async function cast(v: VoteValue) {
    if (busy || poll.attendance_locked) return;
    setBusy(true);
    try {
      const updated =
        poll.my_vote === v
          ? await api.del<PollView>(`/api/polls/${poll.id}/vote`)
          : await api.put<PollView>(`/api/polls/${poll.id}/vote`, { vote: v });
      onChange(updated);
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Could not vote", "err");
    } finally {
      setBusy(false);
    }
  }

  const counts: Record<VoteValue, number> = {
    yes: poll.yes_count,
    no: poll.no_count,
    maybe: poll.maybe_count,
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-semibold text-ink">Game @ {fmtHHMM(poll.proposed_time)}</span>
        <Badge color="green">{poll.yes_count} Yes</Badge>
      </div>
      {poll.note && <p className="mb-2 text-sm text-muted">{poll.note}</p>}

      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((o) => {
          const active = poll.my_vote === o.value;
          return (
            <button
              key={o.value}
              onClick={() => cast(o.value)}
              disabled={busy || poll.attendance_locked}
              className={`flex flex-col items-center gap-0.5 rounded-xl border-2 py-2 transition-colors disabled:opacity-60 ${
                active
                  ? o.value === "yes"
                    ? "border-brand bg-brand-light"
                    : "border-gray-400 bg-gray-100"
                  : "border-gray-200 bg-white"
              }`}
            >
              <span className="text-lg">{o.emoji}</span>
              <span className="text-xs font-medium">{o.label}</span>
              <span className="text-sm font-bold tabular-nums">{counts[o.value]}</span>
            </button>
          );
        })}
      </div>

      {poll.attendance_locked && (
        <p className="mt-2 text-xs text-muted">Voting closed — attendance confirmed.</p>
      )}

      {!compact && poll.votes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {poll.votes.map((v) => (
            <span
              key={v.user_id}
              className={`rounded-full px-2 py-0.5 text-xs ${
                v.vote === "yes"
                  ? "bg-green-100 text-green-800"
                  : v.vote === "maybe"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-gray-100 text-gray-600"
              }`}
            >
              {v.display_name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
