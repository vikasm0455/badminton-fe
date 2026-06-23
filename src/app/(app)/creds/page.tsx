"use client";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useLiveEvents } from "@/lib/live";
import type { CredentialView } from "@/lib/types";
import { Card, EmptyState, PageHeader, Spinner, useToast } from "@/components/ui";
import CredentialCard from "@/components/CredentialCard";
import PostCredential from "@/components/PostCredential";

export default function CredsPage() {
  const { user } = useAuth();
  const { show } = useToast();
  const [creds, setCreds] = useState<CredentialView[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    () => api.get<CredentialView[]>("/api/credentials/today").then(setCreds),
    []
  );

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  useLiveEvents((ev) => {
    if (ev.type === "credentials_changed" || ev.type === "reservations_changed") load();
  });

  async function del(id: string) {
    if (!confirm("Delete this login?")) return;
    try {
      await api.del(`/api/credentials/${id}`);
      load();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Could not delete", "err");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <PageHeader title="Court logins" />
      <PostCredential onPosted={load} />

      {creds.length === 0 ? (
        <Card>
          <EmptyState icon="🔑" text="No logins posted yet today. Post one from the kiosk screenshot." />
        </Card>
      ) : (
        creds.map((c) => (
          <CredentialCard key={c.id} cred={c} isAdmin={user?.is_admin} onDelete={del} />
        ))
      )}
    </div>
  );
}
