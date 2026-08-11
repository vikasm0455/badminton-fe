"use client";

// CLUB ADMIN console — faithful port of the approved admin.html mock.
// Flow: email+password sign-in (JWT in localStorage `rallyup_club_admin`) →
// forced password change while must_change → console: stats row, configuration
// form, courts & closures table, credentials panel. Any 401 from the API drops
// the stored token and returns to the login screen.

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
  CourtsApiError,
  CredentialPair,
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

/** Small uppercase label used inside the issue-credentials modal. */
const PAIR_LABEL: CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-dim)",
  marginBottom: 6,
};

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

function fmtIssued(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
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
}

function formFromConfig(c: ClubConfig): ConfigForm {
  return {
    court_count: String(c.court_count),
    session_minutes: String(c.session_minutes),
    queue_depth: String(c.queue_depth),
    auto_extend: c.auto_extend,
    opens_at: c.opens_at.slice(0, 5),
    closes_at: c.closes_at.slice(0, 5),
    kiosk_theme: c.kiosk_theme,
    brand_color: c.brand_color,
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
  const [closeErr, setCloseErr] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState<number | null>(null);
  const [courtsErr, setCourtsErr] = useState<string | null>(null);

  // Credentials.
  const [pair, setPair] = useState<CredentialPair | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<CredentialRow | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [revokeErr, setRevokeErr] = useState<string | null>(null);
  const [credsErr, setCredsErr] = useState<string | null>(null);

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
    setForm(null);
    dirtyRef.current = false;
    setPair(null);
    setCloseTarget(null);
    setRevokeTarget(null);
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
      const [ov, rows] = await Promise.all([
        courtsApi.get<AdminOverview>(`/api/clubs/${slug}/admin/overview`, tok),
        courtsApi.get<CredentialRow[]>(`/api/clubs/${slug}/admin/credentials?today=1`, tok),
      ]);
      setOverview(ov);
      setCreds(rows);
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
    if (!Number.isFinite(court_count) || court_count < 1) {
      setConfigMsg({ err: "Number of courts must be at least 1." });
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
    setSavingConfig(true);
    setConfigMsg(null);
    try {
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

  const onCloseCourt = async () => {
    if (!token || closeTarget == null) return;
    setClosing(true);
    setCloseErr(null);
    try {
      await courtsApi.post(
        `/api/clubs/${slug}/admin/courts/${closeTarget}/close`,
        { reason: closeReason.trim() },
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

  /* ------------------------------------------------------ credentials */

  const onIssue = async () => {
    if (!token) return;
    setIssuing(true);
    setCredsErr(null);
    try {
      const generated = await courtsApi.post<CredentialPair>(
        `/api/clubs/${slug}/admin/credentials`,
        undefined,
        token,
      );
      setCopied(false);
      setPair(generated);
      refreshSafe(token);
    } catch (err) {
      const msg = guard(err);
      if (msg) setCredsErr(msg);
    } finally {
      setIssuing(false);
    }
  };

  const copyPair = async () => {
    if (!pair) return;
    try {
      await navigator.clipboard.writeText(`${pair.username} / ${pair.password}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — the pair is on screen to copy by hand */
    }
  };

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

  /* ---------------------------------------------------------- screens */

  const clubName = club?.name ?? slug;
  const brandColor = overview?.config.brand_color ?? club?.brand_color;
  const stats = overview?.stats;
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
          <a className="legend-row" href="#a-creds" style={{ textDecoration: "none", color: "inherit" }}>
            <span className="dot" style={{ background: "var(--ok)" }} /> Credentials
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
          <StatPanel value={stats ? stats.credentials_today : "—"} label="Credentials issued today" />
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
                    max={50}
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
                      {c.closed ? c.closed_reason || "—" : "—"}
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
                        <button
                          className="btn sm ghost"
                          onClick={() => {
                            setCloseReason("");
                            setCloseErr(null);
                            setCloseTarget(c.number);
                          }}
                        >
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

        {/* 4) Credentials */}
        <div className="panel" id="a-creds">
          <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ marginBottom: 0 }}>Credentials</h3>
            <div className="spacer" style={{ flex: 1 }} />
            <button className="btn primary" disabled={issuing} onClick={onIssue}>
              {issuing ? "Issuing…" : "Issue credentials"}
            </button>
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
                <th>Issued</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {creds.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ color: "var(--text-dim)" }}>
                    No credentials issued today.
                  </td>
                </tr>
              ) : (
                creds.map((row) => (
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
                    <td style={row.status === "revoked" ? { color: "var(--text-dim)" } : undefined}>
                      {fmtIssued(row.issued_at)}
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

      {/* Issue credentials modal — footer + note rendered in children to keep
          the mock's order (buttons, then the dashed note underneath). */}
      <Modal
        open={pair !== null}
        title="Issue credentials"
        sub="Hand these to the player after payment. They work at this kiosk and in the BadmintonRallyUp app."
        onClose={() => setPair(null)}
      >
        {pair && (
          <div className="panel" style={{ textAlign: "center", padding: "26px 22px" }}>
            <div style={PAIR_LABEL}>Username</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 500 }}>
              {pair.username}
            </div>
            <div style={{ ...PAIR_LABEL, margin: "16px 0 6px" }}>Password</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 500 }}>
              {pair.password}
            </div>
          </div>
        )}
        <div className="modal-foot">
          <button className="btn ghost" onClick={() => window.print()}>
            Print slip
          </button>
          <button className="btn primary" onClick={copyPair}>
            {copied ? "Copied" : "Copy"}
          </button>
          <button className="btn ghost" onClick={() => setPair(null)}>
            Done
          </button>
        </div>
        <div className="note" style={{ marginTop: 18, marginBottom: 0 }}>
          Generates a fresh unique pair each time — valid until you revoke it.
        </div>
      </Modal>

      {/* Close court modal */}
      <Modal
        open={closeTarget !== null}
        title={`Close Court ${closeTarget ?? ""}`}
        sub="The court will show as closed on the kiosk until you reopen it."
        onClose={closing ? undefined : () => setCloseTarget(null)}
        footer={
          <>
            <button className="btn ghost" disabled={closing} onClick={() => setCloseTarget(null)}>
              Cancel
            </button>
            <button
              className="btn danger"
              disabled={closing || !closeReason.trim()}
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
        <div style={{ color: "var(--full-text)", fontSize: 13, marginTop: 12 }}>
          The playing group can finish its session, but the court's queued groups are
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
        sub="The slip stops working at the kiosk and in the app right away. This can't be undone."
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
    </>
  );
}
