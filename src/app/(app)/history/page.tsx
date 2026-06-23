"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { PollSummary } from "@/lib/types";
import { fmtDate } from "@/lib/time";
import { Badge, Card, EmptyState, PageHeader, Spinner } from "@/components/ui";

export default function HistoryPage() {
  const [polls, setPolls] = useState<PollSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<PollSummary[]>("/api/polls/history")
      .then(setPolls)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <PageHeader title="History" />
      {polls.length === 0 ? (
        <Card>
          <EmptyState icon="📅" text="No past sessions yet." />
        </Card>
      ) : (
        polls.map((p) => (
          <Link key={p.id} href={`/poll/${p.id}`}>
            <Card className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{fmtDate(p.game_date)}</p>
                {p.note && <p className="text-sm text-muted">{p.note}</p>}
              </div>
              <div className="flex gap-2">
                <Badge color="green">{p.yes_count} Yes</Badge>
                <Badge color="blue">{p.attendee_count} played</Badge>
              </div>
            </Card>
          </Link>
        ))
      )}
    </div>
  );
}
