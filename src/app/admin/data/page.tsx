"use client";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { AutoPollConfig, SystemHealth } from "@/lib/types";
import { Badge, Button, Card, Field, Spinner, TextInput, useToast } from "@/components/ui";

export default function AdminDataPage() {
  const { show } = useToast();
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [cfg, setCfg] = useState<AutoPollConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [h, c] = await Promise.all([
      api.get<SystemHealth>("/api/admin/health"),
      api.get<AutoPollConfig>("/api/config/auto-poll"),
    ]);
    setHealth(h);
    setCfg(c);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function saveCfg() {
    if (!cfg) return;
    setBusy(true);
    try {
      const updated = await api.put<AutoPollConfig>("/api/config/auto-poll", cfg);
      setCfg(updated);
      show("Saved", "ok");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Could not save", "err");
    } finally {
      setBusy(false);
    }
  }

  async function clearCreds() {
    if (!confirm("Clear ALL of today's court logins now?")) return;
    try {
      const res = await api.post<{ removed: number }>("/api/credentials/clear-today");
      show(`Cleared ${res.removed} login(s)`, "ok");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Could not clear", "err");
    }
  }

  if (loading || !health || !cfg) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <Card>
        <h2 className="mb-2 font-semibold">System health</h2>
        <div className="flex gap-2">
          <Badge color={health.db ? "green" : "red"}>DB {health.db ? "ok" : "down"}</Badge>
          <Badge color={health.redis ? "green" : "red"}>Redis {health.redis ? "ok" : "down"}</Badge>
        </div>
        {Object.keys(health.last_jobs).length > 0 && (
          <div className="mt-3 text-xs text-muted">
            <p className="mb-1 font-medium text-ink">Last job runs</p>
            {Object.entries(health.last_jobs).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span>{k}</span>
                <span>{new Date(v).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">Auto-poll</h2>
        <label className="mb-3 flex items-center justify-between">
          <span className="text-sm">Create a poll automatically each day</span>
          <input
            type="checkbox"
            className="h-6 w-6"
            checked={cfg.enabled}
            onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Trigger time">
            <TextInput type="time" value={cfg.time} onChange={(e) => setCfg({ ...cfg, time: e.target.value })} />
          </Field>
          <Field label="Final reminder">
            <TextInput
              type="time"
              value={cfg.final_reminder_time}
              onChange={(e) => setCfg({ ...cfg, final_reminder_time: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Default note">
          <TextInput value={cfg.note} onChange={(e) => setCfg({ ...cfg, note: e.target.value })} maxLength={120} />
        </Field>
        <Button className="mt-3 w-full" loading={busy} onClick={saveCfg}>
          Save auto-poll settings
        </Button>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">Data management</h2>
        <Button variant="danger" className="w-full" onClick={clearCreds}>
          Clear today&apos;s court logins now
        </Button>
        <p className="mt-2 text-xs text-muted">
          Runs the midnight cleanup immediately (deletes today&apos;s credentials + screenshots).
        </p>
      </Card>
    </div>
  );
}
