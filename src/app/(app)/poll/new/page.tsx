"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { PollView } from "@/lib/types";
import { Button, Card, Field, PageHeader, TextInput, useToast } from "@/components/ui";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function NewPollPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { show } = useToast();
  const [date, setDate] = useState(todayStr());
  const [time, setTime] = useState("18:00");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const poll = await api.post<PollView>("/api/polls", {
        game_date: date,
        proposed_time: time,
        note: note.trim() || null,
      });
      show("Poll created", "ok");
      router.replace(`/poll/${poll.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        show("A poll for today already exists.", "info");
        router.replace("/home");
      } else {
        show(e instanceof ApiError ? e.message : "Could not create poll", "err");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <PageHeader title="Create poll" />
      <Card>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Game date">
            <TextInput
              type="date"
              value={date}
              min={user?.is_admin ? undefined : todayStr()}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </Field>
          <Field label="Proposed start time">
            <TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
          </Field>
          <Field label="Note (optional)" hint="Max 120 characters.">
            <TextInput
              maxLength={120}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Meet at the front desk first"
            />
          </Field>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={busy}>
              Create
            </Button>
          </div>
        </form>
      </Card>

      {user?.is_admin && (
        <Link
          href="/admin/data"
          className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3 text-sm shadow-sm ring-1 ring-black/5"
        >
          <span>
            ⏰ <span className="font-medium">Auto-poll scheduler</span>
            <span className="block text-xs text-muted">Create today&apos;s poll automatically each morning</span>
          </span>
          <span className="text-muted">›</span>
        </Link>
      )}
    </div>
  );
}
