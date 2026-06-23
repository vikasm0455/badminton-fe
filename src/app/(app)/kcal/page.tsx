"use client";
import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, ApiError } from "@/lib/api";
import { useLiveEvents } from "@/lib/live";
import type { KcalHistory, KcalToday } from "@/lib/types";
import { fmtDate } from "@/lib/time";
import { Button, Card, EmptyState, Field, PageHeader, Spinner, TextInput, useToast } from "@/components/ui";

export default function KcalPage() {
  const { show } = useToast();
  const [today, setToday] = useState<KcalToday | null>(null);
  const [history, setHistory] = useState<KcalHistory | null>(null);
  const [kcal, setKcal] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadToday = useCallback(() => api.get<KcalToday>("/api/kcal/today").then(setToday), []);
  const loadHistory = useCallback(() => api.get<KcalHistory>("/api/kcal/history").then(setHistory), []);

  useEffect(() => {
    Promise.all([loadToday(), loadHistory()]).finally(() => setLoading(false));
  }, [loadToday, loadHistory]);

  useEffect(() => {
    if (today?.my_log) {
      setKcal(String(today.my_log.kcal));
      setNote(today.my_log.note ?? "");
    }
  }, [today?.my_log]);

  useLiveEvents((ev) => {
    if (ev.type === "kcal_changed") loadToday();
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(kcal);
    if (Number.isNaN(value) || value < 0 || value > 2000) {
      show("Enter a value between 0 and 2000.", "err");
      return;
    }
    if (value > 1500 && !confirm("That seems high — are you sure?")) return;
    setBusy(true);
    try {
      const res = await api.post<KcalToday>("/api/kcal", { kcal: value, note: note.trim() || null });
      setToday(res);
      loadHistory();
      show("Logged!", "ok");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Could not log", "err");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const chartData = (history?.points ?? []).map((p) => ({ date: fmtDate(p.game_date).slice(5), kcal: p.kcal }));

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <PageHeader title="Calories" />

      <Card>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <p className="font-semibold">{today?.my_log ? "Edit today's burn" : "Log today's burn"}</p>
          <Field label="Calories (kcal)">
            <TextInput type="number" inputMode="numeric" min={0} max={2000} value={kcal} onChange={(e) => setKcal(e.target.value)} placeholder="450" required />
          </Field>
          <Field label="Note (optional)">
            <TextInput maxLength={100} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Tough doubles session" />
          </Field>
          <Button type="submit" loading={busy}>
            {today?.my_log ? "Update" : "Log"}
          </Button>
        </form>
      </Card>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Today&apos;s burn 🔥</h2>
        <Card>
          {today && today.entries.length > 0 ? (
            <>
              <p className="mb-2 text-lg font-bold">Team burned {today.total.toLocaleString()} kcal</p>
              {today.entries.map((e) => (
                <div key={e.user_id} className="flex justify-between border-b border-gray-100 py-1.5 text-sm last:border-0">
                  <span>{e.display_name}</span>
                  <span className="font-semibold tabular-nums">{e.kcal} kcal</span>
                </div>
              ))}
            </>
          ) : (
            <EmptyState text="No kcal logged yet today." />
          )}
        </Card>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Your last sessions</h2>
        <Card>
          {chartData.length > 0 ? (
            <>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="kcal" fill="#2e7d32" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
                <Stat label="Sessions" value={history!.total_sessions} />
                <Stat label="Avg" value={history!.avg_kcal} />
                <Stat label="Best" value={history!.max_kcal} />
              </div>
            </>
          ) : (
            <EmptyState icon="📊" text="Log a few sessions to see your trend." />
          )}
        </Card>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-brand-light py-2">
      <div className="text-lg font-bold text-brand-dark tabular-nums">{value.toLocaleString()}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
