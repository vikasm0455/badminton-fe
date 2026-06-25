"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useLiveEvents } from "@/lib/live";
import type { CredentialView, ReservationView } from "@/lib/types";
import { Button, Card, EmptyState, PageHeader, Spinner } from "@/components/ui";
import ReservationCard from "@/components/ReservationCard";
import ReservationForm from "@/components/ReservationForm";
import BoardScan from "@/components/BoardScan";

export default function CourtsPage() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<ReservationView[]>([]);
  const [creds, setCreds] = useState<CredentialView[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const loadRes = useCallback(
    () => api.get<ReservationView[]>("/api/reservations/today").then(setReservations),
    []
  );
  const loadCreds = useCallback(
    () => api.get<CredentialView[]>("/api/credentials/today").then(setCreds),
    []
  );

  useEffect(() => {
    Promise.all([loadRes(), loadCreds()]).finally(() => setLoading(false));
  }, [loadRes, loadCreds]);

  useLiveEvents((ev) => {
    if (ev.type === "reservations_changed") loadRes();
    if (ev.type === "credentials_changed") loadCreds();
  });

  const active = reservations.filter((r) => r.status === "active");
  const doneToday = reservations.filter((r) => r.status !== "active");

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <PageHeader
        title="Courts"
        action={
          !showForm &&
          !showScan && (
            <div className="flex gap-2">
              <Button variant="secondary" className="px-3 py-2 text-sm" onClick={() => setShowScan(true)}>
                📷 Scan board
              </Button>
              <Button className="px-3 py-2 text-sm" onClick={() => setShowForm(true)}>
                + Log court
              </Button>
            </div>
          )
        }
      />

      <button className="text-left text-sm font-medium text-brand-dark" onClick={() => setShowMap((s) => !s)}>
        {showMap ? "Hide court map" : "🗺 View court map"}
      </button>
      {showMap && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/court-map.svg" alt="Bintang court map" className="w-full rounded-xl border border-gray-200" />
      )}

      {showScan && (
        <BoardScan
          onDone={() => {
            setShowScan(false);
            loadRes();
            loadCreds();
          }}
          onCancel={() => setShowScan(false)}
        />
      )}

      {showForm && (
        <ReservationForm
          creds={creds}
          onCreated={() => {
            setShowForm(false);
            loadRes();
            loadCreds();
          }}
          onCancel={() => setShowForm(false)}
          onCredsChanged={loadCreds}
        />
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Active ({active.length})</h2>
        {active.length === 0 ? (
          <Card>
            <EmptyState icon="🏸" text="No active courts. Tap “Log court” after you reserve at the kiosk." />
          </Card>
        ) : (
          active.map((r) => <ReservationCard key={r.id} r={r} isAdmin={user?.is_admin} onChange={loadRes} />)
        )}
      </section>

      {doneToday.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Completed today</h2>
          {doneToday.map((r) => (
            <ReservationCard key={r.id} r={r} isAdmin={user?.is_admin} onChange={loadRes} />
          ))}
        </section>
      )}
    </div>
  );
}
