"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, PageHeader, Spinner } from "@/components/ui";

type WeekBucket = { week_start: string; sessions: number };
type KcalPoint = { date: string; kcal: number };
type MyStats = {
  sessions_total: number;
  sessions_this_month: number;
  sessions_last_month: number;
  current_streak_weeks: number;
  best_streak_weeks: number;
  court_minutes_this_month: number;
  court_minutes_last_month: number;
  avg_kcal_per_session: number | null;
  yes_rate_percent: number | null;
  weekly_sessions: WeekBucket[];
  kcal_series: KcalPoint[];
};

const BRAND = "#2e7d32";

function delta(now: number, before: number): string {
  const d = now - before;
  if (d === 0) return "same as last month";
  return `${d > 0 ? "▲" : "▼"} ${Math.abs(d)} vs last month`;
}

/** Sub-hour totals show minutes so the tile never reads "0 h" with a trend. */
function minutesLabel(minutes: number): string {
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h`;
}

/** Delta from RAW minutes — rounding per platform must never disagree. */
function minutesDelta(now: number, before: number): string {
  const d = now - before;
  if (d === 0) return "same as last month";
  const arrow = d > 0 ? "▲" : "▼";
  const magnitude = Math.abs(d);
  return magnitude < 60
    ? `${arrow} ${magnitude} min vs last month`
    : `${arrow} ${Math.floor(magnitude / 60)}h vs last month`;
}

/** Personal analytics — private to the signed-in user. */
export default function StatsPage() {
  const [stats, setStats] = useState<MyStats | null>(null);
  const [failed, setFailed] = useState(false);
  // months: 1/3/6 presets; 0 = custom weeks.
  const [months, setMonths] = useState(1);
  const [weeks, setWeeks] = useState(8);

  // Restore the remembered range once, client-side.
  useEffect(() => {
    const savedM = Number(window.localStorage.getItem("statsMonths"));
    if (savedM === 0 || savedM === 3 || savedM === 6) setMonths(savedM);
    const savedW = Number(window.localStorage.getItem("statsWeeks"));
    if (savedW >= 1 && savedW <= 26) setWeeks(savedW);
  }, []);

  useEffect(() => {
    const query = months === 0 ? `weeks=${weeks}` : `months=${months}`;
    api
      .get<MyStats>(`/api/stats/me?${query}`)
      .then(setStats)
      .catch(() => setFailed(true));
  }, [months, weeks]);

  const pickRange = (m: number) => {
    setMonths(m);
    window.localStorage.setItem("statsMonths", String(m));
  };
  const pickWeeks = (w: number) => {
    setWeeks(w);
    window.localStorage.setItem("statsWeeks", String(w));
  };
  const rangeLabel =
    months === 0
      ? `last ${weeks} week${weeks === 1 ? "" : "s"}`
      : months === 1
        ? "last 5 weeks"
        : `last ${months} months`;

  if (failed) {
    return <p className="px-4 py-8 text-center text-sm text-muted">Couldn&apos;t load your stats — pull to refresh.</p>;
  }
  if (!stats) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const maxWeek = Math.max(1, ...stats.weekly_sessions.map((w) => w.sessions));
  const kcalMax = Math.max(1, ...stats.kcal_series.map((p) => p.kcal));

  const tiles: { value: string; label: string; sub?: string }[] = [
    {
      value: `${stats.sessions_this_month}`,
      label: "Sessions this month",
      sub: delta(stats.sessions_this_month, stats.sessions_last_month),
    },
    {
      value: `${stats.current_streak_weeks} wk${stats.current_streak_weeks === 1 ? "" : "s"}`,
      label: "Current streak",
      sub: `best: ${stats.best_streak_weeks} wks`,
    },
    {
      value: minutesLabel(stats.court_minutes_this_month),
      label: "Court time this month",
      sub: minutesDelta(stats.court_minutes_this_month, stats.court_minutes_last_month),
    },
    {
      value: stats.avg_kcal_per_session != null ? `${stats.avg_kcal_per_session}` : "—",
      label: "Avg kcal / session",
      sub: stats.yes_rate_percent != null ? `yes-rate ${stats.yes_rate_percent}%` : undefined,
    },
  ];

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <PageHeader title="My stats" />
      <p className="-mt-2 text-xs text-muted">
        {stats.sessions_total} sessions all-time · private to you
      </p>

      <div className="flex rounded-xl bg-gray-100 p-1 text-sm font-medium">
        {[1, 3, 6, 0].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => pickRange(m)}
            className={`flex-1 rounded-lg py-1.5 transition-colors ${
              months === m ? "bg-surface text-ink shadow-sm" : "text-muted"
            }`}
          >
            {m === 0 ? "Custom" : `${m}M`}
          </button>
        ))}
      </div>
      {months === 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-surface px-3 py-2">
          <input
            type="range"
            min={1}
            max={26}
            value={weeks}
            onChange={(e) => pickWeeks(Number(e.target.value))}
            className="flex-1 accent-brand"
          />
          <span className="w-20 text-right text-sm font-semibold tabular-nums">
            {weeks} week{weeks === 1 ? "" : "s"}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {tiles.map((t) => (
          <Card key={t.label}>
            <div className="text-2xl font-extrabold tabular-nums">{t.value}</div>
            <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              {t.label}
            </div>
            {t.sub && (
              <div
                className={`mt-1 text-[11px] ${t.sub.startsWith("▲") ? "text-brand-dark" : "text-muted"}`}
              >
                {t.sub}
              </div>
            )}
          </Card>
        ))}
      </div>

      <Card>
        <p className="mb-2 text-sm font-semibold">
          Sessions per week <span className="font-normal text-muted">· {rangeLabel}</span>
        </p>
        <div className="flex h-24 items-end gap-0.5">
          {stats.weekly_sessions.map((w, i) => (
            <div
              key={w.week_start}
              title={`Week of ${w.week_start}: ${w.sessions} session${w.sessions === 1 ? "" : "s"}`}
              className="flex-1 rounded-t"
              style={{
                height: `${Math.max(4, (w.sessions / maxWeek) * 100)}%`,
                background: BRAND,
                opacity: i === stats.weekly_sessions.length - 1 ? 1 : 0.45,
              }}
            />
          ))}
        </div>
        <div className="mt-1 flex gap-0.5">
          {stats.weekly_sessions.map((w, i) => {
            const every = Math.max(1, Math.round(stats.weekly_sessions.length / 6));
            const show = i % every === 0 || i === stats.weekly_sessions.length - 1;
            return (
              <span key={w.week_start} className="flex-1 text-center text-[9px] text-muted">
                {show ? w.week_start.slice(5).replace("-", "/") : ""}
              </span>
            );
          })}
        </div>
      </Card>

      <Card>
        <p className="mb-2 text-sm font-semibold">
          Calories per session <span className="font-normal text-muted">· {rangeLabel}</span>
        </p>
        {stats.kcal_series.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">
            No calorie logs yet — log one from the Home screen after a session.
          </p>
        ) : (
          <svg viewBox="0 0 320 80" className="h-20 w-full">
            {stats.kcal_series.length > 1 && (
              <polyline
                fill="none"
                stroke={BRAND}
                strokeWidth="2"
                strokeLinecap="round"
                points={stats.kcal_series
                  .map((p, i) => {
                    const x = 6 + (i / (stats.kcal_series.length - 1)) * 308;
                    const y = 74 - (p.kcal / kcalMax) * 64;
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                  })
                  .join(" ")}
              />
            )}
            {/* terminal dot — also what makes a single log visible at all */}
            <circle
              cx={stats.kcal_series.length === 1 ? 160 : 314}
              cy={74 - (stats.kcal_series[stats.kcal_series.length - 1].kcal / kcalMax) * 64}
              r="4"
              fill={BRAND}
            />
          </svg>
        )}
      </Card>

      <p className="text-[11px] leading-relaxed text-muted">
        Sessions count days you were in the confirmed attendance list (or voted yes when
        attendance wasn&apos;t confirmed). Court time counts courts you logged. All stats are
        private to you.
      </p>
    </div>
  );
}
