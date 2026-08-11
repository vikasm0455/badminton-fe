// Courts API client: contract types, envelope-unwrapping fetch helpers with
// optional bearer auth, timer helpers, and the live-board hooks. Hooks are
// only ever called from client components ("use client" pages/components).

import { useEffect, useRef, useState } from "react";

/* ---------------------------------------------------------------- types */

export type CourtStatus = "available" | "half" | "full" | "closed";
export type ClubStatus = "onboarding" | "live" | "suspended";
export type KioskTheme = "light" | "dark";
export type CredentialStatus = "active" | "revoked";
export type CredErrorCode =
  | "not_found"
  | "revoked"
  | "bad_password"
  | "on_court"
  | "in_queue"
  | "duplicate";

/** The API's standard response envelope. */
export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  message: string | null;
}

/** One username+password pair a kiosk action submits. */
export interface PlayerCred {
  username: string;
  password: string;
}

/** Per-credential validation failure inside a failed take/join/queue. */
export interface CredentialError {
  username: string;
  code: CredErrorCode;
  court_number?: number | null;
}

export interface QueueEntry {
  position: number;
  size: number;
  label: string;
  eta_minutes: number;
}

export interface CourtView {
  number: number;
  status: CourtStatus;
  closed_reason?: string | null;
  players: string[];
  seconds_left?: number | null;
  queue: QueueEntry[];
  queue_len: number;
  queue_depth: number;
}

export interface BoardClub {
  name: string;
  slug: string;
  brand_color: string;
  kiosk_theme: KioskTheme;
  court_count: number;
  session_minutes: number;
  queue_depth: number;
  opens_at: string;
  closes_at: string;
  open_now: boolean;
}

export interface BoardResponse {
  club: BoardClub;
  courts: CourtView[];
  now: string;
}

export interface ClubConfig {
  court_count: number;
  session_minutes: number;
  queue_depth: number;
  auto_extend: boolean;
  opens_at: string;
  closes_at: string;
  kiosk_theme: KioskTheme;
  brand_color: string;
}

export interface AdminCourtRow {
  number: number;
  closed: boolean;
  closed_reason: string | null;
}

export interface AdminStats {
  courts: number;
  players_on_court: number;
  groups_queued: number;
  credentials_today: number;
}

export interface AdminOverview {
  config: ClubConfig;
  stats: AdminStats;
  courts: AdminCourtRow[];
}

export interface CredentialWhere {
  kind: "court" | "queue" | null;
  court_number?: number | null;
  position?: number | null;
}

export interface CredentialRow {
  id: string;
  username: string;
  password: string;
  status: CredentialStatus;
  issued_at: string;
  where: CredentialWhere;
}

/** The freshly generated pair returned by POST admin/credentials. */
export interface CredentialPair {
  username: string;
  password: string;
}

export interface PlatformClub {
  id: string;
  slug: string;
  name: string;
  court_count: number;
  /** Subselect on the BE — null if the club somehow has no admin row. */
  admin_email: string | null;
  status: ClubStatus;
  created_at: string;
  courts_active_today: number;
}

/**
 * POST /api/platform/clubs returns the bare club_json, which does NOT carry
 * the list-only fields admin_email / courts_active_today — callers must fill
 * them in before mixing the club into the GET list.
 */
export interface OnboardClubResult {
  club: Omit<PlatformClub, "admin_email" | "courts_active_today"> &
    Partial<Pick<PlatformClub, "admin_email" | "courts_active_today">>;
  invite_emailed: boolean;
}

/** Token response from club-admin login / platform OTP verify. */
export interface AuthToken {
  token: string;
  must_change?: boolean;
}

/* ------------------------------------------------------------ fetching */

/** localStorage keys for the two console JWTs. */
export const TOKEN_KEYS = {
  clubAdmin: "rallyup_club_admin",
  platform: "rallyup_platform",
} as const;

export function loadToken(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function saveToken(key: string, token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, token);
  } catch {
    /* storage unavailable (private mode) — session-only auth */
  }
}

/** Typed API failure; `errors` carries per-credential validation details. */
export class CourtsApiError extends Error {
  status: number;
  errors: CredentialError[];
  constructor(message: string, status: number, errors: CredentialError[] = []) {
    super(message);
    this.name = "CourtsApiError";
    this.status = status;
    this.errors = errors;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new CourtsApiError("Network error — check the connection and try again.", 0);
  }

  let json: ApiEnvelope<T> | null = null;
  try {
    json = (await res.json()) as ApiEnvelope<T>;
  } catch {
    /* non-JSON response (bare proxy error page) */
  }

  if (!res.ok || !json || json.success === false) {
    const msg = json?.message || `Request failed (${res.status})`;
    const errors =
      (json?.data as { errors?: CredentialError[] } | null)?.errors ?? [];
    throw new CourtsApiError(msg, res.status, errors);
  }
  return json.data as T;
}

export const courtsApi = {
  get: <T>(path: string, token?: string | null) => request<T>("GET", path, undefined, token),
  post: <T>(path: string, body?: unknown, token?: string | null) =>
    request<T>("POST", path, body, token),
  patch: <T>(path: string, body?: unknown, token?: string | null) =>
    request<T>("PATCH", path, body, token),
};

/* ------------------------------------------------------------- helpers */

/** 763 → "12:43". Clamps at 0. */
export function fmtMMSS(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Queue ETA: current session's remainder plus a full session per group ahead. */
export function etaMinutes(secondsLeft: number, position: number, sessionMinutes: number): number {
  return Math.round(secondsLeft / 60 + (position - 1) * sessionMinutes);
}

/** Human message for a per-credential validation error (shown under the field). */
export function credErrorMessage(err: CredentialError): string {
  switch (err.code) {
    case "not_found":
      return `${err.username || "This username"} isn't recognized — check the slip`;
    case "revoked":
      return `${err.username} has been revoked — ask the front desk`;
    case "bad_password":
      return `Wrong password for ${err.username}`;
    case "on_court":
      return err.court_number != null
        ? `${err.username} is already on Court ${err.court_number}`
        : `${err.username} is already on a court`;
    case "in_queue":
      return err.court_number != null
        ? `${err.username} is already queued for Court ${err.court_number}`
        : `${err.username} is already in a queue`;
    case "duplicate":
      return `${err.username} is entered twice in this group`;
  }
}

/* --------------------------------------------------------------- hooks */

/**
 * Local 1-second countdown from a server-supplied seconds_left. Re-syncs
 * whenever `seconds` or `resyncKey` changes (pass the board's `now` so every
 * SSE push snaps the timer back to server truth). Returns null when idle.
 */
export function useCountdown(
  seconds: number | null | undefined,
  resyncKey?: unknown,
): number | null {
  const [left, setLeft] = useState<number | null>(seconds ?? null);
  useEffect(() => {
    if (seconds == null) {
      setLeft(null);
      return;
    }
    setLeft(seconds);
    const started = Date.now();
    const timer = setInterval(() => {
      setLeft(Math.max(0, seconds - Math.round((Date.now() - started) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, resyncKey]);
  return left;
}

/**
 * Live board feed: initial GET, then SSE ("board" events) with a 5-second
 * polling fallback whenever the stream is down. The browser reconnects the
 * EventSource on its own; polling stops as soon as the stream recovers.
 */
export function useBoardStream(
  slug: string,
  onBoard: (board: BoardResponse) => void,
): void {
  const cb = useRef(onBoard);
  cb.current = onBoard;

  useEffect(() => {
    if (!slug) return;
    let closed = false;
    let es: EventSource | null = null;
    // Liveness is proven ONLY by a delivered "board" event — an OPEN
    // connection through a buffering proxy delivers nothing while looking
    // healthy, which would silently freeze the kiosk. So the safety poll
    // below always runs; it just yields whenever real events are flowing.
    let lastEventAt = 0;
    let streamDown = false;

    const fetchBoard = async () => {
      try {
        const board = await courtsApi.get<BoardResponse>(`/api/clubs/${slug}/board`);
        if (!closed) cb.current(board);
      } catch {
        /* transient — next tick or SSE push will catch up */
      }
    };

    // One interval, two speeds: 5s while the stream is known-down, 15s as a
    // permanent backstop when the stream is merely silent. Skipped only when
    // a real event arrived recently.
    let lastPollAt = 0;
    const tick = setInterval(() => {
      const now = Date.now();
      const fresh = now - lastEventAt < 20_000;
      const interval = streamDown ? 5_000 : 15_000;
      if (!fresh && now - lastPollAt >= interval) {
        lastPollAt = now;
        fetchBoard();
      }
    }, 2_500);

    fetchBoard();
    try {
      es = new EventSource(`/api/clubs/${slug}/board/stream`);
      es.addEventListener("board", (e) => {
        lastEventAt = Date.now();
        streamDown = false;
        try {
          cb.current(JSON.parse((e as MessageEvent).data) as BoardResponse);
        } catch {
          /* keep-alive / malformed line */
        }
      });
      es.onerror = () => {
        streamDown = true;
      };
    } catch {
      streamDown = true;
    }

    return () => {
      closed = true;
      es?.close();
      clearInterval(tick);
    };
  }, [slug]);
}
