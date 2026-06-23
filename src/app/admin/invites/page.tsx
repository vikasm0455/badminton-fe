"use client";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { InviteRow } from "@/lib/types";
import { fmtDate } from "@/lib/time";
import { Badge, Button, Card, Field, Spinner, TextInput, useToast } from "@/components/ui";

const STATUS_COLOR: Record<string, string> = {
  active: "green",
  used: "blue",
  expired: "gray",
  revoked: "red",
};

export default function AdminInvitesPage() {
  const { show } = useToast();
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [count, setCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.get<InviteRow[]>("/api/admin/invites").then(setInvites), []);
  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  function linkFor(code: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/join?code=${code}`;
  }

  async function generate() {
    setBusy(true);
    try {
      await api.post<InviteRow[]>("/api/admin/invites", { count });
      show(`Generated ${count} invite${count > 1 ? "s" : ""}`, "ok");
      await load();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Could not generate", "err");
    } finally {
      setBusy(false);
    }
  }

  async function share(code: string) {
    const url = linkFor(code);
    try {
      if (navigator.share) await navigator.share({ title: "Join RallyUp", url });
      else {
        await navigator.clipboard.writeText(url);
        show("Link copied", "ok");
      }
    } catch {
      /* user cancelled share */
    }
  }

  async function revoke(id: string) {
    try {
      await api.post(`/api/admin/invites/${id}/revoke`);
      await load();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Could not revoke", "err");
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
      <Card>
        <div className="flex items-end gap-2">
          <Field label="How many?">
            <TextInput
              type="number"
              min={1}
              max={10}
              value={count}
              onChange={(e) => setCount(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
            />
          </Field>
          <Button className="mb-0.5" loading={busy} onClick={generate}>
            Generate
          </Button>
        </div>
      </Card>

      {invites.map((i) => (
        <Card key={i.id}>
          <div className="flex items-center justify-between">
            <code className="text-sm font-bold">{i.code}</code>
            <Badge color={STATUS_COLOR[i.computed_status]}>{i.computed_status}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted">
            Created {fmtDate(i.created_at)} · Expires {fmtDate(i.expires_at)}
            {i.used_by_name && ` · Used by ${i.used_by_name}`}
          </p>
          {i.computed_status === "active" && (
            <div className="mt-2 flex gap-2">
              <Button variant="secondary" className="px-3 py-1.5 text-sm" onClick={() => share(i.code)}>
                Share link
              </Button>
              <Button variant="ghost" className="px-3 py-1.5 text-sm text-pass" onClick={() => revoke(i.id)}>
                Revoke
              </Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
