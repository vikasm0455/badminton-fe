"use client";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { MemberRow } from "@/lib/types";
import { Badge, Button, Card, Spinner, useToast } from "@/components/ui";

const STATUS_COLOR: Record<string, string> = {
  pending: "amber",
  active: "green",
  deactivated: "gray",
  rejected: "red",
};

export default function AdminMembersPage() {
  const { show } = useToast();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => api.get<MemberRow[]>("/api/admin/members").then(setMembers), []);
  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function act(id: string, action: string, label: string) {
    setBusyId(id);
    try {
      await api.post(`/api/admin/members/${id}/${action}`);
      show(label, "ok");
      await load();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Action failed", "err");
    } finally {
      setBusyId(null);
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
    <div className="flex flex-col gap-3 px-4 py-4">
      {members.map((m) => (
        <Card key={m.id}>
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold">
                {m.display_name}
                {m.role === "admin" && <span className="ml-1 text-xs text-brand-dark">(admin)</span>}
              </p>
              <p className="text-xs text-muted">{m.email}</p>
            </div>
            <Badge color={STATUS_COLOR[m.status] || "gray"}>{m.status}</Badge>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {m.status === "pending" && (
              <>
                <Button className="px-3 py-1.5 text-sm" loading={busyId === m.id} onClick={() => act(m.id, "approve", "Approved")}>
                  Approve
                </Button>
                <Button variant="danger" className="px-3 py-1.5 text-sm" onClick={() => act(m.id, "reject", "Rejected")}>
                  Reject
                </Button>
              </>
            )}
            {m.status === "active" && m.role !== "admin" && (
              <Button variant="danger" className="px-3 py-1.5 text-sm" onClick={() => act(m.id, "deactivate", "Deactivated")}>
                Deactivate
              </Button>
            )}
            {m.status === "deactivated" && (
              <Button variant="secondary" className="px-3 py-1.5 text-sm" onClick={() => act(m.id, "reactivate", "Reactivated")}>
                Reactivate
              </Button>
            )}
            <Button variant="ghost" className="px-3 py-1.5 text-sm" onClick={() => act(m.id, "clear-lock", "Lockout cleared")}>
              Clear lockout
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
