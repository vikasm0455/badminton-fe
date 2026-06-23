"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useLiveEvents } from "@/lib/live";
import type { CredentialView, KcalToday, PollView, ReservationView } from "@/lib/types";
import { Button, Card, EmptyState, PageHeader, Spinner } from "@/components/ui";
import PollVote from "@/components/PollVote";
import CredentialCard from "@/components/CredentialCard";
import ReservationCard from "@/components/ReservationCard";

export default function HomePage() {
  const { user } = useAuth();
  const [poll, setPoll] = useState<PollView | null>(null);
  const [creds, setCreds] = useState<CredentialView[]>([]);
  const [reservations, setReservations] = useState<ReservationView[]>([]);
  const [kcal, setKcal] = useState<KcalToday | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPoll = useCallback(() => api.get<PollView | null>("/api/polls/today").then(setPoll), []);
  const loadCreds = useCallback(
    () => api.get<CredentialView[]>("/api/credentials/today").then(setCreds),
    []
  );
  const loadRes = useCallback(
    () => api.get<ReservationView[]>("/api/reservations/today").then(setReservations),
    []
  );
  const loadKcal = useCallback(() => api.get<KcalToday>("/api/kcal/today").then(setKcal), []);

  useEffect(() => {
    Promise.all([loadPoll(), loadCreds(), loadRes(), loadKcal()]).finally(() => setLoading(false));
  }, [loadPoll, loadCreds, loadRes, loadKcal]);

  useLiveEvents((ev) => {
    if (ev.type === "poll_changed") loadPoll();
    else if (ev.type === "credentials_changed") loadCreds();
    else if (ev.type === "reservations_changed") loadRes();
    else if (ev.type === "kcal_changed") loadKcal();
  });

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const activeRes = reservations.filter((r) => r.status === "active");
  const needTwoCourts = poll && poll.yes_count >= 6;

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <PageHeader title={`Hi, ${user?.display_name?.split(" ")[0] ?? "there"} 👋`} />

      {/* Poll */}
      <Card>
        {poll ? (
          <PollVote poll={poll} onChange={setPoll} compact />
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">No poll yet today</p>
              <p className="text-sm text-muted">Start one to see who&apos;s in.</p>
            </div>
            <Link href="/poll/new">
              <Button className="px-3 py-2 text-sm">+ Create</Button>
            </Link>
          </div>
        )}
        {poll && (
          <Link href={`/poll/${poll.id}`} className="mt-3 block text-sm font-medium text-brand-dark">
            View full poll →
          </Link>
        )}
      </Card>

      {needTwoCourts && (
        <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          🏸 6+ players today — you may need 2 courts! Make sure you have 2 logins ready.
        </div>
      )}

      {/* Active courts */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Live courts</h2>
          <Link href="/courts" className="text-sm font-medium text-brand-dark">
            Manage →
          </Link>
        </div>
        {activeRes.length === 0 ? (
          <Card>
            <EmptyState icon="🏸" text="No active courts. Log a reservation from the Courts tab." />
          </Card>
        ) : (
          activeRes.map((r) => (
            <ReservationCard key={r.id} r={r} isAdmin={user?.is_admin} onChange={loadRes} />
          ))
        )}
      </section>

      {/* Credentials */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Court logins</h2>
          <Link href="/creds" className="text-sm font-medium text-brand-dark">
            Post →
          </Link>
        </div>
        {creds.length === 0 ? (
          <Card>
            <EmptyState icon="🔑" text="No logins posted yet today." />
          </Card>
        ) : (
          creds.slice(0, 2).map((c) => <CredentialCard key={c.id} cred={c} />)
        )}
      </section>

      {/* Today's burn */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Today&apos;s burn 🔥</h2>
          <Link href="/kcal" className="text-sm font-medium text-brand-dark">
            Log →
          </Link>
        </div>
        <Card>
          {kcal && kcal.entries.length > 0 ? (
            <>
              <p className="mb-2 text-lg font-bold">Team burned {kcal.total.toLocaleString()} kcal</p>
              <div className="flex flex-wrap gap-1.5">
                {kcal.entries.map((e) => (
                  <span key={e.user_id} className="rounded-full bg-brand-light px-2 py-0.5 text-xs text-brand-dark">
                    {e.display_name} {e.kcal}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <EmptyState text="No kcal logged yet today." />
          )}
        </Card>
      </section>
    </div>
  );
}
