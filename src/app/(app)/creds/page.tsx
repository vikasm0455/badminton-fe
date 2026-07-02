"use client";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useLiveEvents } from "@/lib/live";
import type { CredentialView } from "@/lib/types";
import { Card, EmptyState, PageHeader, Spinner, useToast } from "@/components/ui";
import CredentialCard from "@/components/CredentialCard";
import PostCredential from "@/components/PostCredential";
import LoginStatusTable from "@/components/LoginStatusTable";

export default function CredsPage() {
  const { user } = useAuth();
  const { show } = useToast();
  const [creds, setCreds] = useState<CredentialView[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"manage" | "inuse">("manage");

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

  const tabBtn = (active: boolean) =>
    `flex-1 rounded-lg py-1.5 transition-colors ${active ? "bg-surface shadow-sm text-ink" : "text-muted"}`;

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <PageHeader title="Court logins" />

      <div className="flex rounded-xl bg-gray-100 p-1 text-sm font-medium">
        <button type="button" onClick={() => setTab("manage")} className={tabBtn(tab === "manage")}>
          Manage
        </button>
        <button type="button" onClick={() => setTab("inuse")} className={tabBtn(tab === "inuse")}>
          In use
        </button>
      </div>

      {tab === "inuse" ? (
        <LoginStatusTable creds={creds} />
      ) : (
        <>
          <PostCredential onPosted={load} />
          {creds.length === 0 ? (
            <Card>
              <EmptyState icon="🔑" text="No logins posted yet today. Post one from the kiosk screenshot." />
            </Card>
          ) : (
            creds.map((c) => (
              <CredentialCard key={c.id} cred={c} isAdmin={user?.active_group_role === "admin"} onDelete={del} />
            ))
          )}
        </>
      )}
    </div>
  );
}
