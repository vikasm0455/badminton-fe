"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { SecurityEventRow } from "@/lib/types";
import { Card, EmptyState, Field, Spinner, TextInput } from "@/components/ui";

const FLAGGED = new Set(["otp_failed", "login_failed", "account_locked", "invalid_invite_attempt"]);

const EVENT_TYPES = [
  "",
  "invite_created",
  "invite_used",
  "invite_revoked",
  "signup_attempted",
  "otp_issued",
  "otp_failed",
  "otp_success",
  "login_success",
  "login_failed",
  "account_locked",
  "member_approved",
  "member_rejected",
  "member_deactivated",
  "credential_posted",
  "credential_deleted",
  "invalid_invite_attempt",
  "admin_action",
];

export default function AdminSecurityPage() {
  const [events, setEvents] = useState<SecurityEventRow[]>([]);
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (type) qs.set("event_type", type);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const rows = await api.get<SecurityEventRow[]>(`/api/admin/security?${qs.toString()}`);
    setEvents(rows);
    setLoading(false);
  }, [type, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <Card>
        <div className="grid grid-cols-1 gap-2">
          <Field label="Event type">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t || "All events"}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="From">
              <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="To">
              <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : events.length === 0 ? (
        <Card>
          <EmptyState text="No events match." />
        </Card>
      ) : (
        events.map((e) => (
          <div
            key={e.id}
            className={`rounded-xl px-3 py-2 text-sm shadow-sm ring-1 ring-black/5 ${
              FLAGGED.has(e.event_type) ? "bg-red-50" : "bg-white"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`font-semibold ${FLAGGED.has(e.event_type) ? "text-pass" : ""}`}>
                {e.event_type}
              </span>
              <span className="text-xs text-muted">{new Date(e.created_at).toLocaleString()}</span>
            </div>
            <div className="text-xs text-muted">
              {e.user_name || "—"}
              {e.ip_address && ` · ${e.ip_address}`}
              {e.metadata && Object.keys(e.metadata).length > 0 && ` · ${JSON.stringify(e.metadata)}`}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
