"use client";

// CLUB ADMIN console — faithful port of the approved admin.html mock (v2).
// Flow: email+password sign-in (JWT in localStorage `rallyup_club_admin`) →
// forced password change while must_change → console: stats row, configuration
// form (incl. club timezone), courts & timed closures, "Today's logins"
// (visible day-pass passwords), Members panel. Any 401 from the API drops the
// stored token and returns to the login screen.

import {
  CSSProperties,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AdminOverview,
  AuthToken,
  BoardResponse,
  ClubConfig,
  ClubMember,
  CourtsApiError,
  CredentialKind,
  CredentialRow,
  KioskTheme,
  TOKEN_KEYS,
  courtsApi,
  loadToken,
  saveToken,
} from "../../lib";
import { Chip, Modal, StatPanel, Topbar } from "../../components";

/* ------------------------------------------------------------- helpers */

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** Curated IANA zones for the config select (the mock's 8 plus neighbors). */
const CURATED_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
] as const;

const OTHER_TZ = "other";

function Clock() {
  const [now, setNow] = useState("");
  useEffect(() => {
    const tick = () =>
      setNow(
        new Date().toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);
  return <span className="clock">{now}</span>;
}

/** Status chip per contract: revoked > on court > queued (with position) > free. */
function whereChip(row: CredentialRow) {
  if (row.status === "revoked") return <Chip tone="dim">Revoked</Chip>;
  if (row.where?.kind === "court")
    return <Chip tone="cork">On Court {row.where.court_number}</Chip>;
  if (row.where?.kind === "queue")
    return (
      <Chip tone="dim">
        Queued · Court {row.where.court_number} #{row.where.position}
      </Chip>
    );
  return <Chip tone="ok">Free</Chip>;
}

function kindChip(kind: CredentialKind) {
  return kind === "member" ? (
    <Chip tone="cork">member</Chip>
  ) : (
    <Chip tone="dim">walk-in</Chip>
  );
}

/**
 * "14:05" — the current wall-clock time in the CLUB's timezone (close-modal
 * From default). Closure windows are club-local, so an admin in another
 * timezone must see the club's clock, not their own.
 */
function nowHHMM(tz?: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  };
  const d = new Date();
  try {
    return d.toLocaleTimeString("en-GB", tz ? { ...opts, timeZone: tz } : opts);
  } catch {
    return d.toLocaleTimeString("en-GB", opts); // invalid tz string — local fallback
  }
}

/** <input type="time"> value shape ("HH:MM", zero-padded). */
const HHMM_RE = /^\d{2}:\d{2}$/;

/** Short time ("4:00 pm"-style) in the club's timezone; falls back to local. */
function fmtTimeInZone(iso: string | null | undefined, tz?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  try {
    return d.toLocaleTimeString([], tz ? { ...opts, timeZone: tz } : opts);
  } catch {
    return d.toLocaleTimeString([], opts); // invalid tz string — local fallback
  }
}

/** "Jun 12" for the members table's Since column. */
function fmtSince(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

/** Config form keeps numbers as strings so partial typing never NaN-crashes. */
interface ConfigForm {
  court_count: string;
  session_minutes: string;
  queue_depth: string;
  auto_extend: boolean;
  opens_at: string;
  closes_at: string;
  kiosk_theme: KioskTheme;
  brand_color: string;
  /** One of CURATED_TIMEZONES or OTHER_TZ. */
  timezone_select: string;
  /** Free-text IANA zone used when timezone_select === OTHER_TZ. */
  timezone_custom: string;
}

function formFromConfig(c: ClubConfig): ConfigForm {
  const curated = (CURATED_TIMEZONES as readonly string[]).includes(c.timezone);
  return {
    court_count: String(c.court_count),
    session_minutes: String(c.session_minutes),
    queue_depth: String(c.queue_depth),
    auto_extend: c.auto_extend,
    opens_at: c.opens_at.slice(0, 5),
    closes_at: c.closes_at.slice(0, 5),
    kiosk_theme: c.kiosk_theme,
    brand_color: c.brand_color,
    timezone_select: curated ? c.timezone : OTHER_TZ,
    timezone_custom: curated ? "" : c.timezone,
  };
}

/* ---------------------------------------------------------------- page */

export default function ClubAdminPage({ params }: { params: { slug: string } }) {
  const slug = params.slug;

  // undefined = still reading localStorage (avoids a hydration mismatch).
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [mustChange, setMustChange] = useState(false);

  const [club, setClub] = useState<BoardResponse["club"] | null>(null);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [creds, setCreds] = useState<CredentialRow[]>([]);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // Login / password-change screens.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginErr, setLoginErr] = useState<string | null>(null);
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [changeErr, setChangeErr] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  // Config form.
  const [form, setForm] = useState<ConfigForm | null>(null);
  const dirtyRef = useRef(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configMsg, setConfigMsg] = useState<{ ok?: string; err?: string } | null>(null);

  // Courts & closures.
  const [closeTarget, setCloseTarget] = useState<number | null>(null);
  const [closeReason, setCloseReason] = useState("");
  const [closeFrom, setCloseFrom] = useState("");
  const [closeUntil, setCloseUntil] = useState("");
  const [closeErr, setCloseErr] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState<number | null>(null);
  const [courtsErr, setCourtsErr] = useState<string | null>(null);

  // Today's logins.
  const [revokeTarget, setRevokeTarget] = useState<CredentialRow | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [revokeErr, setRevokeErr] = useState<string | null>(null);
  const [credsErr, setCredsErr] = useState<string | null>(null);

  // Members.
  const [addOpen, setAddOpen] = useState(false);
  const [addRef, setAddRef] = useState("");
  const [addUsername, setAddUsername] = useState("");
  const [addName, setAddName] = useState("");
  const [addErr, setAddErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ClubMember | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeErr, setRemoveErr] = useState<string | null>(null);
  const [membersErr, setMembersErr] = useState<string | null>(null);

  useEffect(() => {
    setToken(loadToken(TOKEN_KEYS.clubAdmin));
  }, []);

  // Club name / brand color for the topbar come from the public board endpoint
  // (the admin overview doesn't carry the club name).
  useEffect(() => {
    let cancelled = false;
    courtsApi
      .get<BoardResponse>(`/api/clubs/${slug}/board`)
      .then((b) => {
        if (!cancelled) setClub(b.club);
      })
      .catch(() => {
        /* suspended/unknown club — topbar falls back to the slug */
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const dropAuth = useCallback(() => {
    saveToken(TOKEN_KEYS.clubAdmin, null);
    setToken(null);
    setMustChange(false);
    setOverview(null);
    setCreds([]);
    setMembers([]);
    setForm(null);
    dirtyRef.current = false;
    setCloseTarget(null);
    setRevokeTarget(null);
    setAddOpen(false);
    setRemoveTarget(null);
    setLoginErr("Session expired — sign in again.");
  }, []);

  /** 401 → back to login (returns ""); anything else → message to display. */
  const guard = useCallback(
    (e: unknown): string => {
      if (e instanceof CourtsApiError && e.status === 401) {
        dropAuth();
        return "";
      }
      return e instanceof Error ? e.message : "Something went wrong — try again.";
    },
    [dropAuth],
  );

  const refresh = useCallback(
    async (tok: string) => {
      const [ov, rows, mems] = await Promise.all([
        courtsApi.get<AdminOverview>(`/api/clubs/${slug}/admin/overview`, tok),
        courtsApi.get<CredentialRow[]>(`/api/clubs/${slug}/admin/credentials`, tok),
        courtsApi.get<ClubMember[]>(`/api/clubs/${slug}/admin/members`, tok),
      ]);
      setOverview(ov);
      setCreds(rows);
      setMembers(mems);
      setLoadErr(null);
      // Don't clobber in-progress edits with the server copy.
      setForm((prev) => (dirtyRef.current && prev ? prev : formFromConfig(ov.config)));
    },
    [slug],
  );

  const refreshSafe = useCallback(
    async (tok: string) => {
      try {
        await refresh(tok);
      } catch (e) {
        const msg = guard(e);
        if (msg) setLoadErr(msg);
      }
    },
    [refresh, guard],
  );

  useEffect(() => {
    if (!token || mustChange) return;
    refreshSafe(token);
    const timer = setInterval(() => refreshSafe(token), 30000);
    return () => clearInterval(timer);
  }, [token, mustChange, refreshSafe]);

  /* ------------------------------------------------------------- auth */

  const onLogin = async (e: FormEvent) => {
    e.preventDefault();
    setAuthBusy(true);
    setLoginErr(null);
    try {
      const res = await courtsApi.post<AuthToken>(`/api/clubs/${slug}/admin/login`, {
        email: email.trim(),
        password,
      });
      saveToken(TOKEN_KEYS.clubAdmin, res.token);
      setPassword("");
      setMustChange(!!res.must_change);
      setToken(res.token);
    } catch (err) {
      setLoginErr(err instanceof Error ? err.message : "Sign-in failed — try again.");
    } finally {
      setAuthBusy(false);
    }
  };

  const onChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPw !== newPw2) {
      setChangeErr("New passwords don't match.");
      return;
    }
    setAuthBusy(true);
    setChangeErr(null);
    try {
      await courtsApi.post(
        `/api/clubs/${slug}/admin/password`,
        { current: curPw, new: newPw },
        token,
      );
      setCurPw("");
      setNewPw("");
      setNewPw2("");
      setMustChange(false);
    } catch (err) {
      const msg = guard(err);
      if (msg) setChangeErr(msg);
    } finally {
      setAuthBusy(false);
    }
  };

  /* ----------------------------------------------------------- config */

  const setField = <K extends keyof ConfigForm>(key: K, value: ConfigForm[K]) => {
    dirtyRef.current = true;
    setConfigMsg(null);
    setForm((f) => (f ? { ...f, [key]: value } : f));
  };

  const onSaveConfig = async (e: FormEvent) => {
    e.preventDefault();
    if (!form || !token) return;
    const court_count = parseInt(form.court_count, 10);
    const session_minutes = parseInt(form.session_minutes, 10);
    const queue_depth = parseInt(form.queue_depth, 10);
    const brand_color = form.brand_color.trim();
    const timezone =
      form.timezone_select === OTHER_TZ
        ? form.timezone_custom.trim()
        : form.timezone_select;
    if (!Number.isFinite(court_count) || court_count < 1 || court_count > 100) {
      setConfigMsg({ err: "Number of courts must be between 1 and 100." });
      return;
    }
    if (!Number.isFinite(session_minutes) || session_minutes < 15) {
      setConfigMsg({ err: "Session length must be at least 15 minutes." });
      return;
    }
    if (!Number.isFinite(queue_depth) || queue_depth < 1) {
      setConfigMsg({ err: "Queue depth must be at least 1." });
      return;
    }
    if (!HEX_RE.test(brand_color)) {
      setConfigMsg({ err: "Brand color must be a hex value like #b06f3c." });
      return;
    }
    if (!timezone) {
      setConfigMsg({ err: "Enter an IANA timezone like Europe/Amsterdam." });
      return;
    }
    setSavingConfig(true);
    setConfigMsg(null);
    try {
      // Timezone strings are validated server-side (chrono-tz); a bad zone
      // comes back as a message we surface inline right here.
      await courtsApi.patch(
        `/api/clubs/${slug}/admin/config`,
        {
          court_count,
          session_minutes,
          queue_depth,
          auto_extend: form.auto_extend,
          opens_at: form.opens_at,
          closes_at: form.closes_at,
          kiosk_theme: form.kiosk_theme,
          brand_color,
          timezone,
        },
        token,
      );
      dirtyRef.current = false;
      setConfigMsg({ ok: "Configuration saved." });
      await refreshSafe(token);
    } catch (err) {
      const msg = guard(err);
      if (msg) setConfigMsg({ err: msg });
    } finally {
      setSavingConfig(false);
    }
  };

  /* ----------------------------------------------------------- courts */

  const openCloseModal = (courtNumber: number) => {
    setCloseReason("");
    setCloseFrom(nowHHMM(overview?.config.timezone));
    setCloseUntil("");
    setCloseErr(null);
    setCloseTarget(courtNumber);
  };

  const onCloseCourt = async () => {
    if (!token || closeTarget == null) return;
    // Send the raw "HH:MM" wall-clock strings — the server interprets them in
    // the CLUB's timezone (today). Converting to an ISO instant here would
    // silently apply the admin BROWSER's timezone instead.
    const from = closeFrom.trim();
    const until = closeUntil.trim();
    if (!HHMM_RE.test(from) || !HHMM_RE.test(until)) {
      setCloseErr("Pick both From and Until times.");
      return;
    }
    if (until <= from) {
      setCloseErr("Until must be after From.");
      return;
    }
    setClosing(true);
    setCloseErr(null);
    try {
      await courtsApi.post(
        `/api/clubs/${slug}/admin/courts/${closeTarget}/close`,
        {
          reason: closeReason.trim(),
          from,
          until,
        },
        token,
      );
      setCloseTarget(null);
      await refreshSafe(token);
    } catch (err) {
      const msg = guard(err);
      if (msg) setCloseErr(msg);
    } finally {
      setClosing(false);
    }
  };

  const onReopen = async (courtNumber: number) => {
    if (!token) return;
    setReopening(courtNumber);
    setCourtsErr(null);
    try {
      await courtsApi.post(`/api/clubs/${slug}/admin/courts/${courtNumber}/reopen`, undefined, token);
      await refreshSafe(token);
    } catch (err) {
      const msg = guard(err);
      if (msg) setCourtsErr(msg);
    } finally {
      setReopening(null);
    }
  };

  /* -------------------------------------------------- today's logins */

  const onRevoke = async () => {
    if (!token || !revokeTarget) return;
    setRevoking(true);
    setRevokeErr(null);
    try {
      await courtsApi.post(
        `/api/clubs/${slug}/admin/credentials/${revokeTarget.id}/revoke`,
        undefined,
        token,
      );
      setRevokeTarget(null);
      await refreshSafe(token);
    } catch (err) {
      const msg = guard(err);
      if (msg) setRevokeErr(msg);
    } finally {
      setRevoking(false);
    }
  };

  /* ---------------------------------------------------------- members */

  const openAddMember = () => {
    setAddRef("");
    setAddUsername("");
    setAddName("");
    setAddErr(null);
    setAddOpen(true);
  };

  const onAddMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setAdding(true);
    setAddErr(null);
    try {
      // Server owns validation (charset, username taken, duplicate member ID)
      // — its message lands inline under the fields.
      await courtsApi.post(
        `/api/clubs/${slug}/admin/members`,
        {
          member_ref: addRef.trim(),
          username: addUsername.trim(),
          display_name: addName.trim() || null,
        },
        token,
      );
      setAddOpen(false);
      await refreshSafe(token);
    } catch (err) {
      const msg = guard(err);
      if (msg) setAddErr(msg);
    } finally {
      setAdding(false);
    }
  };

  const onRemoveMember = async () => {
    if (!token || !removeTarget) return;
    setRemoving(true);
    setRemoveErr(null);
    try {
      await courtsApi.post(
        `/api/clubs/${slug}/admin/members/${removeTarget.id}/remove`,
        undefined,
        token,
      );
      setRemoveTarget(null);
      await refreshSafe(token);
    } catch (err) {
      const msg = guard(err);
      if (msg) setRemoveErr(msg);
    } finally {
      setRemoving(false);
    }
  };

  /* ---------------------------------------------------------- screens */

  const clubName = club?.name ?? slug;
  const brandColor = overview?.config.brand_color ?? club?.brand_color;
  const stats = overview?.stats;
  const clubTz = overview?.config.timezone;
  const signedIn = !!token && !mustChange;

  const authCard: CSSProperties = { maxWidth: 460, margin: "64px auto 0", padding: "26px 28px" };
  const authStack: CSSProperties = { display: "flex", flexDirection: "column", gap: 14 };

  const loginScreen = (
    <main className="main">
      <form className="panel" style={authCard} onSubmit={onLogin}>
        <h3>Sign in</h3>
        <p style={{ color: "var(--text-dim)", fontSize: "13.5px", marginBottom: 18 }}>
          Club admin access for <b style={{ color: "var(--text)" }}>{clubName}</b>.
        </p>
        <div style={authStack}>
          <label className="field">
            <b>Email</b>
            <input
              type="email"
              autoComplete="email"
              required
              disabled={authBusy}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field">
            <b>Password</b>
            <input
              type="password"
              autoComplete="current-password"
              required
              disabled={authBusy}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {loginErr && <span className="field-err">{loginErr}</span>}
          <button className="btn primary block" type="submit" disabled={authBusy}>
            {authBusy ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </form>
    </main>
  );

  const changeScreen = (
    <main className="main">
      <form className="panel" style={authCard} onSubmit={onChangePassword}>
        <h3>Choose a new password</h3>
        <p style={{ color: "var(--text-dim)", fontSize: "13.5px", marginBottom: 18 }}>
          Your temporary password has to be replaced before you can use the console.
        </p>
        <div style={authStack}>
          <label className="field">
            <b>Current (temporary) password</b>
            <input
              type="password"
              autoComplete="current-password"
              required
              disabled={authBusy}
              value={curPw}
              onChange={(e) => setCurPw(e.target.value)}
            />
          </label>
          <label className="field">
            <b>New password</b>
            <input
              type="password"
              autoComplete="new-password"
              required
              disabled={authBusy}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
            />
          </label>
          <label className="field">
            <b>Repeat new password</b>
            <input
              type="password"
              autoComplete="new-password"
              required
              disabled={authBusy}
              value={newPw2}
              onChange={(e) => setNewPw2(e.target.value)}
            />
          </label>
          {changeErr && <span className="field-err">{changeErr}</span>}
          <button className="btn primary block" type="submit" disabled={authBusy}>
            {authBusy ? "Saving…" : "Set password"}
          </button>
        </div>
      </form>
    </main>
  );

  const consoleScreen = (
    <main className="main">
      <div className="strip">
        <h1>Club admin</h1>
        <nav className="legend" aria-label="Sections">
          <a className="legend-row" href="#a-overview" style={{ textDecoration: "none", color: "inherit" }}>
            <span className="dot" style={{ background: "var(--cork)" }} /> Overview
          </a>
          <a className="legend-row" href="#a-config" style={{ textDecoration: "none", color: "inherit" }}>
            <span className="dot" style={{ background: "var(--queue)" }} /> Configuration
          </a>
          <a className="legend-row" href="#a-logins" style={{ textDecoration: "none", color: "inherit" }}>
            <span className="dot" style={{ background: "var(--ok)" }} /> Today&apos;s logins
          </a>
          <a className="legend-row" href="#a-members" style={{ textDecoration: "none", color: "inherit" }}>
            <span className="dot" style={{ background: "var(--full)" }} /> Members
          </a>
        </nav>
        <div className="spacer" />
        <span className="live">Live</span>
        <Clock />
      </div>

      {loadErr && <div className="note">{loadErr}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* 1) Stats */}
        <div className="panel-grid" id="a-overview" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
          <StatPanel value={stats ? stats.courts : "—"} label="Courts" />
          <StatPanel value={stats ? stats.players_on_court : "—"} label="Players on court" />
          <StatPanel value={stats ? stats.groups_queued : "—"} label="Groups in queues" />
          <StatPanel value={stats ? stats.credentials_today : "—"} label="Logins issued today" />
        </div>

        {/* 2) Configuration */}
        <form className="panel" id="a-config" onSubmit={onSaveConfig}>
          <h3>Configuration</h3>
          {form ? (
            <>
              <div className="cred-grid">
                <label className="field">
                  <b>Number of courts</b>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={form.court_count}
                    onChange={(e) => setField("court_count", e.target.value)}
                  />
                </label>
                <label className="field">
                  <b>Session length (minutes)</b>
                  <input
                    type="number"
                    min={15}
                    step={5}
                    value={form.session_minutes}
                    onChange={(e) => setField("session_minutes", e.target.value)}
                  />
                </label>
                <label className="field">
                  <b>Queue depth per court</b>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={form.queue_depth}
                    onChange={(e) => setField("queue_depth", e.target.value)}
                  />
                </label>
                <div />
                <div
                  style={{
                    gridColumn: "1/-1",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    marginTop: 2,
                  }}
                >
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={form.auto_extend}
                      onChange={(e) => setField("auto_extend", e.target.checked)}
                    />
                    <span className="track" />
                    Auto-extend when queue is empty
                  </label>
                  <div style={{ color: "var(--text-dim)", fontSize: "12.5px" }}>
                    When the timer ends and nobody is waiting, the playing group automatically
                    keeps the court for another session.
                  </div>
                </div>
                <label className="field">
                  <b>Opens at</b>
                  <input
                    type="time"
                    value={form.opens_at}
                    onChange={(e) => setField("opens_at", e.target.value)}
                  />
                </label>
                <label className="field">
                  <b>Closes at</b>
                  <input
                    type="time"
                    value={form.closes_at}
                    onChange={(e) => setField("closes_at", e.target.value)}
                  />
                </label>
                <label className="field">
                  <b>Club timezone</b>
                  <select
                    value={form.timezone_select}
                    onChange={(e) => setField("timezone_select", e.target.value)}
                  >
                    {CURATED_TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                    <option value={OTHER_TZ}>Other…</option>
                  </select>
                  {form.timezone_select === OTHER_TZ && (
                    <input
                      type="text"
                      className="mono"
                      placeholder="IANA zone, e.g. Europe/Amsterdam"
                      style={{ marginTop: 8 }}
                      value={form.timezone_custom}
                      onChange={(e) => setField("timezone_custom", e.target.value)}
                    />
                  )}
                  <span style={{ color: "var(--text-dim)", fontSize: 12 }}>
                    Day passes expire at midnight in this timezone.
                  </span>
                </label>
                <label className="field">
                  <b>Kiosk theme</b>
                  <select
                    value={form.kiosk_theme}
                    onChange={(e) => setField("kiosk_theme", e.target.value as KioskTheme)}
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </label>
                <label className="field">
                  <b>Brand color</b>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      className="color-chip"
                      style={{
                        background: HEX_RE.test(form.brand_color.trim())
                          ? form.brand_color.trim()
                          : "transparent",
                      }}
                    />
                    <input
                      type="text"
                      className="mono"
                      placeholder="#b06f3c"
                      value={form.brand_color}
                      onChange={(e) => setField("brand_color", e.target.value)}
                    />
                  </div>
                </label>
              </div>
              <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 12 }}>
                <button className="btn primary" type="submit" disabled={savingConfig}>
                  {savingConfig ? "Saving…" : "Save configuration"}
                </button>
                {configMsg?.ok && (
                  <span style={{ color: "var(--ok-text)", fontSize: 13 }}>{configMsg.ok}</span>
                )}
                {configMsg?.err && <span className="field-err">{configMsg.err}</span>}
              </div>
            </>
          ) : (
            <div className="qrow empty">Loading configuration…</div>
          )}
        </form>

        {/* 3) Courts & closures */}
        <div className="panel" id="a-courts">
          <h3>Courts &amp; closures</h3>
          {courtsErr && (
            <div className="field-err" style={{ marginBottom: 10 }}>
              {courtsErr}
            </div>
          )}
          <table className="list">
            <thead>
              <tr>
                <th>Court</th>
                <th>Status</th>
                <th>Reason</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {overview ? (
                overview.courts.map((c) => (
                  <tr key={c.number}>
                    <td>Court {c.number}</td>
                    <td>{c.closed ? <Chip tone="dim">Closed</Chip> : <Chip tone="ok">Open</Chip>}</td>
                    <td className="mono" style={c.closed ? undefined : { color: "var(--text-dim)" }}>
                      {c.closed
                        ? `${c.closed_reason || "—"}${
                            c.closed_until
                              ? ` · until ${fmtTimeInZone(c.closed_until, clubTz)}`
                              : ""
                          }`
                        : "—"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {c.closed ? (
                        <button
                          className="btn sm"
                          disabled={reopening === c.number}
                          onClick={() => onReopen(c.number)}
                        >
                          {reopening === c.number ? "Reopening…" : "Reopen"}
                        </button>
                      ) : (
                        <button className="btn sm ghost" onClick={() => openCloseModal(c.number)}>
                          Close…
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} style={{ color: "var(--text-dim)" }}>
                    Loading courts…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 4) Today's logins */}
        <div className="panel" id="a-logins">
          <h3 style={{ marginBottom: 4 }}>Today&apos;s logins</h3>
          <div style={{ color: "var(--text-dim)", fontSize: "12.5px", marginBottom: 14 }}>
            Every password expires at midnight{clubTz ? ` (${clubTz})` : ""}. Any staff member
            can read a forgotten password back to a player.
          </div>
          {credsErr && (
            <div className="field-err" style={{ marginBottom: 10 }}>
              {credsErr}
            </div>
          )}
          <table className="list">
            <thead>
              <tr>
                <th>Username</th>
                <th>Password</th>
                <th>Type</th>
                <th>Where</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {creds.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ color: "var(--text-dim)" }}>
                    No logins yet today — walk-ins sign up and members check in at their
                    stations.
                  </td>
                </tr>
              ) : (
                creds.map((row) => {
                  const dimmed =
                    row.status === "revoked" ? { color: "var(--text-dim)" } : undefined;
                  return (
                    <tr key={row.id}>
                      <td
                        className="mono"
                        style={
                          row.status === "revoked"
                            ? { textDecoration: "line-through", color: "var(--text-dim)" }
                            : undefined
                        }
                      >
                        {row.username}
                      </td>
                      <td className="mono" style={dimmed}>
                        {row.password}
                      </td>
                      <td>
                        {kindChip(row.kind)}
                        {row.member_name && (
                          <span
                            style={{
                              marginLeft: 8,
                              color: "var(--text-dim)",
                              fontSize: "12.5px",
                            }}
                          >
                            {row.member_name}
                          </span>
                        )}
                      </td>
                      <td>{whereChip(row)}</td>
                      <td style={{ textAlign: "right" }}>
                        {row.status === "active" && (
                          <button
                            className="btn sm ghost"
                            onClick={() => {
                              setRevokeErr(null);
                              setRevokeTarget(row);
                            }}
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 5) Members */}
        <div className="panel" id="a-members">
          <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ marginBottom: 0 }}>Members</h3>
            <div className="spacer" style={{ flex: 1 }} />
            <button className="btn primary" onClick={openAddMember}>
              Add member
            </button>
          </div>
          {membersErr && (
            <div className="field-err" style={{ marginBottom: 10 }}>
              {membersErr}
            </div>
          )}
          <table className="list">
            <thead>
              <tr>
                <th>Member ID</th>
                <th>Username</th>
                <th>Name</th>
                <th>Since</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ color: "var(--text-dim)" }}>
                    No members yet — link a member card with &ldquo;Add member&rdquo;.
                  </td>
                </tr>
              ) : (
                members.map((m) => (
                  <tr key={m.id}>
                    <td className="mono">{m.member_ref}</td>
                    <td className="mono">{m.username}</td>
                    <td>{m.display_name || "—"}</td>
                    <td>{fmtSince(m.created_at)}</td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="btn sm ghost"
                        onClick={() => {
                          setRemoveErr(null);
                          setMembersErr(null);
                          setRemoveTarget(m);
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );

  return (
    <>
      <Topbar
        partnerLabel="Club"
        partnerName={clubName}
        partnerMeta="Admin console"
        brandColor={brandColor}
        right={
          signedIn ? (
            <div className="top-user">
              Signed in as club admin ·{" "}
              <span style={{ fontFamily: "var(--font-mono)" }}>{slug}</span>
            </div>
          ) : undefined
        }
      />

      {token === undefined ? null : !token ? loginScreen : mustChange ? changeScreen : consoleScreen}

      {/* Close court modal — timed closure window */}
      <Modal
        open={closeTarget !== null}
        title={`Close Court ${closeTarget ?? ""}`}
        sub="The court will show as closed on the kiosk for the window below."
        onClose={closing ? undefined : () => setCloseTarget(null)}
        footer={
          <>
            <button className="btn ghost" disabled={closing} onClick={() => setCloseTarget(null)}>
              Cancel
            </button>
            <button
              className="btn danger"
              disabled={closing || !closeReason.trim() || !closeUntil}
              onClick={onCloseCourt}
            >
              {closing ? "Closing…" : "Close court"}
            </button>
          </>
        }
      >
        <label className="field">
          <b>Reason shown to players</b>
          <input
            type="text"
            placeholder="e.g. mat repair, private lesson"
            autoFocus
            disabled={closing}
            value={closeReason}
            onChange={(e) => setCloseReason(e.target.value)}
          />
        </label>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginTop: 12,
          }}
        >
          <label className="field">
            <b>From</b>
            <input
              type="time"
              disabled={closing}
              value={closeFrom}
              onChange={(e) => setCloseFrom(e.target.value)}
            />
          </label>
          <label className="field">
            <b>Until</b>
            <input
              type="time"
              disabled={closing}
              value={closeUntil}
              onChange={(e) => setCloseUntil(e.target.value)}
            />
          </label>
        </div>
        <div style={{ color: "var(--text-dim)", fontSize: "12.5px", marginTop: 10 }}>
          The court reopens automatically when the window ends.
        </div>
        <div style={{ color: "var(--full-text)", fontSize: 13, marginTop: 12 }}>
          The playing group can finish its session, but the court&apos;s queued groups are
          released — redirect them at the front desk.
        </div>
        {closeErr && (
          <div className="field-err" style={{ marginTop: 10 }}>
            {closeErr}
          </div>
        )}
      </Modal>

      {/* Revoke credential confirm */}
      <Modal
        open={revokeTarget !== null}
        title={`Revoke ${revokeTarget?.username ?? ""}?`}
        sub="Today's password stops working at the stations and kiosk right away. This can't be undone."
        onClose={revoking ? undefined : () => setRevokeTarget(null)}
        footer={
          <>
            <button className="btn ghost" disabled={revoking} onClick={() => setRevokeTarget(null)}>
              Cancel
            </button>
            <button className="btn danger" disabled={revoking} onClick={onRevoke}>
              {revoking ? "Revoking…" : "Revoke"}
            </button>
          </>
        }
      >
        {revokeErr && <div className="field-err">{revokeErr}</div>}
      </Modal>

      {/* Add member modal */}
      <Modal
        open={addOpen}
        title="Add member"
        sub="Link a club member card to a permanent username."
        onClose={adding ? undefined : () => setAddOpen(false)}
      >
        <form onSubmit={onAddMember}>
          <label className="field">
            <b>Member ID</b>
            <input
              type="text"
              className="mono"
              placeholder="As printed on their card, e.g. NL-1203"
              autoFocus
              required
              disabled={adding}
              value={addRef}
              onChange={(e) => setAddRef(e.target.value)}
            />
          </label>
          <label className="field" style={{ marginTop: 12 }}>
            <b>Username (permanent)</b>
            <input
              type="text"
              className="mono"
              placeholder="e.g. netrusher"
              required
              disabled={adding}
              value={addUsername}
              onChange={(e) => setAddUsername(e.target.value)}
            />
          </label>
          <label className="field" style={{ marginTop: 12 }}>
            <b>Name (optional)</b>
            <input
              type="text"
              placeholder="e.g. Sam P."
              disabled={adding}
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
            />
          </label>
          <div style={{ color: "var(--text-dim)", fontSize: "12.5px", marginTop: 10 }}>
            The member gets a fresh password each day at the kiosk with just their member ID.
          </div>
          {addErr && (
            <div className="field-err" style={{ marginTop: 10 }}>
              {addErr}
            </div>
          )}
          <div className="modal-foot">
            <button
              className="btn ghost"
              type="button"
              disabled={adding}
              onClick={() => setAddOpen(false)}
            >
              Cancel
            </button>
            <button
              className="btn primary"
              type="submit"
              disabled={adding || !addRef.trim() || !addUsername.trim()}
            >
              {adding ? "Adding…" : "Add member"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Remove member confirm */}
      <Modal
        open={removeTarget !== null}
        title={`Remove ${removeTarget?.username ?? ""}?`}
        sub="If they checked in today, that login is revoked right away. Their username frees up for anyone from tomorrow."
        onClose={removing ? undefined : () => setRemoveTarget(null)}
        footer={
          <>
            <button className="btn ghost" disabled={removing} onClick={() => setRemoveTarget(null)}>
              Cancel
            </button>
            <button className="btn danger" disabled={removing} onClick={onRemoveMember}>
              {removing ? "Removing…" : "Remove member"}
            </button>
          </>
        }
      >
        {removeErr && <div className="field-err">{removeErr}</div>}
      </Modal>
    </>
  );
}
