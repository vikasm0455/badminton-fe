import { serverNow } from "./api";

/** Milliseconds until an ISO instant, server-clock corrected. */
export function untilMs(iso: string): number {
  return Date.parse(iso) - serverNow();
}

/** "MM:SS" countdown (clamped at 0). */
export function fmtMMSS(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/** "3h 42m" / "42m" style for the credential midnight countdown. */
export function fmtCoarse(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** "Expired 3 min ago" style. */
export function fmtAgo(ms: number): string {
  const mins = Math.floor(Math.abs(ms) / 60000);
  if (mins < 1) return "just now";
  return `${mins} min ago`;
}

export function fmtClock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** "Mon, Jun 22" from an ISO date or datetime. */
export function fmtDate(iso: string): string {
  const d = iso.length <= 10 ? new Date(iso + "T00:00:00") : new Date(iso);
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

/** Convert "HH:MM" (24h) to a friendly "6:00 PM". */
export function fmtHHMM(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return hhmm;
  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
