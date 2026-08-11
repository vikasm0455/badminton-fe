"use client";

// PLATFORM console — faithful port of the approved platform.html mock.
// OTP login (email → code → JWT in localStorage "rallyup_platform"), stats,
// clubs table with Manage (suspend / reactivate), and the onboarding form
// with live slug preview, brand-color swatches and a kiosk header preview.

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AuthToken,
  ClubStatus,
  CourtsApiError,
  OnboardClubResult,
  PlatformClub,
  TOKEN_KEYS,
  courtsApi,
  loadToken,
  saveToken,
} from "../courts/lib";
import { Chip, Modal, StatPanel, Topbar } from "../courts/components";

/* ------------------------------------------------------------ constants */

const SWATCHES: { color: string; label: string }[] = [
  { color: "#3b82c9", label: "Blue" },
  { color: "#2f9e63", label: "Green" },
  { color: "#d9a13b", label: "Amber" },
  { color: "#8a5bc9", label: "Violet" },
  { color: "#d45a4a", label: "Red" },
];

const SLUG_RE = /^[a-z0-9-]{3,32}$/;

/** Public kiosk URL for a slug (v1 is path-based). */
const kioskUrl = (slug: string) => `badmintonrallyup.com/courts/${slug}`;

const STATUS_CHIP: Record<ClubStatus, { tone: "ok" | "dim"; label: string; danger?: boolean }> = {
  live: { tone: "ok", label: "Live" },
  onboarding: { tone: "dim", label: "Onboarding" },
  suspended: { tone: "dim", label: "Suspended", danger: true },
};

function StatusChip({ status }: { status: ClubStatus }) {
  const c = STATUS_CHIP[status];
  if (c.danger) {
    return (
      <span className="chip" style={{ background: "var(--full-soft)", color: "var(--full-text)" }}>
        {c.label}
      </span>
    );
  }
  return <Chip tone={c.tone}>{c.label}</Chip>;
}

/* -------------------------------------------------------------- helpers */

function fmtCreated(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

/** Live wall clock, mock cadence (tick every 15 s). */
function useClock(): string {
  const [now, setNow] = useState("");
  useEffect(() => {
    const tick = () =>
      setNow(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    tick();
    const t = setInterval(tick, 15000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/* ----------------------------------------------------------- OTP login */

function LoginPanel({ onToken }: { onToken: (token: string) => void }) {
  const [stage, setStage] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await courtsApi.post("/api/platform/otp", { email: email.trim() });
      setStage("code");
    } catch (err) {
      setError(err instanceof CourtsApiError ? err.message : "Could not send the code.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const auth = await courtsApi.post<AuthToken>("/api/platform/verify", {
        email: email.trim(),
        code: code.trim(),
      });
      onToken(auth.token);
    } catch (err) {
      setError(err instanceof CourtsApiError ? err.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="main" style={{ minWidth: 0, display: "grid", placeItems: "center", minHeight: "calc(100vh - 61px)" }}>
      <div className="panel" style={{ width: 420 }}>
        <h3>Platform sign-in</h3>
        <p style={{ fontSize: "13px", color: "var(--text-dim)", marginBottom: 16 }}>
          {stage === "email"
            ? "Enter the platform owner email — we'll send a one-time code."
            : `Code sent to ${email.trim()}. Enter it below.`}
        </p>
        {stage === "email" ? (
          <form onSubmit={requestCode} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label className="field">
              <b>Email</b>
              <input
                type="email"
                className="mono"
                placeholder="owner@badmintonrallyup.com"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            {error && <span className="field-err">{error}</span>}
            <button className="btn primary block" disabled={busy || !email.trim()}>
              {busy ? "Sending…" : "Send code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label className="field">
              <b>One-time code</b>
              <input
                type="text"
                className="mono"
                placeholder="123456"
                autoComplete="one-time-code"
                inputMode="numeric"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
            {error && <span className="field-err">{error}</span>}
            <button className="btn primary block" disabled={busy || !code.trim()}>
              {busy ? "Verifying…" : "Verify & sign in"}
            </button>
            <button
              type="button"
              className="btn ghost block"
              disabled={busy}
              onClick={() => {
                setStage("email");
                setCode("");
                setError(null);
              }}
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

/* -------------------------------------------------------- onboard form */

interface OnboardDraft {
  name: string;
  slug: string;
  brandColor: string;
  courtCount: string;
  sessionMinutes: string;
  queueDepth: string;
  adminName: string;
  adminEmail: string;
}

const EMPTY_DRAFT: OnboardDraft = {
  name: "",
  slug: "",
  brandColor: SWATCHES[0].color,
  courtCount: "6",
  sessionMinutes: "45",
  queueDepth: "3",
  adminName: "",
  adminEmail: "",
};

function OnboardPanel({
  token,
  onCreated,
  onAuthError,
}: {
  token: string;
  onCreated: (result: OnboardClubResult) => void;
  onAuthError: () => void;
}) {
  const [draft, setDraft] = useState<OnboardDraft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const set = <K extends keyof OnboardDraft>(key: K, value: OnboardDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const slugValid = SLUG_RE.test(draft.slug);
  const slugError =
    draft.slug && !slugValid
      ? "3–32 chars, lowercase letters, digits and hyphens only"
      : null;
  const customColor = !SWATCHES.some((s) => s.color === draft.brandColor);

  const courtCount = parseInt(draft.courtCount, 10);
  const sessionMinutes = parseInt(draft.sessionMinutes, 10);
  const queueDepth = parseInt(draft.queueDepth, 10);
  const numbersValid =
    Number.isFinite(courtCount) && courtCount >= 1 &&
    Number.isFinite(sessionMinutes) && sessionMinutes >= 15 &&
    Number.isFinite(queueDepth) && queueDepth >= 1;
  const ready =
    draft.name.trim().length > 0 &&
    slugValid &&
    numbersValid &&
    draft.adminName.trim().length > 0 &&
    /.+@.+\..+/.test(draft.adminEmail.trim());

  const submit = async () => {
    setTouched(true);
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await courtsApi.post<OnboardClubResult>(
        "/api/platform/clubs",
        {
          name: draft.name.trim(),
          slug: draft.slug,
          brand_color: draft.brandColor,
          court_count: courtCount,
          session_minutes: sessionMinutes,
          queue_depth: queueDepth,
          admin_name: draft.adminName.trim(),
          admin_email: draft.adminEmail.trim(),
        },
        token,
      );
      // The create endpoint returns bare club_json (no admin_email /
      // courts_active_today) — fill them in from what we just submitted.
      const merged: OnboardClubResult = {
        ...result,
        club: {
          ...result.club,
          admin_email: result.club.admin_email ?? draft.adminEmail.trim(),
          courts_active_today: result.club.courts_active_today ?? 0,
        },
      };
      setDraft(EMPTY_DRAFT);
      setTouched(false);
      onCreated(merged);
    } catch (err) {
      if (err instanceof CourtsApiError && err.status === 401) return onAuthError();
      setError(err instanceof CourtsApiError ? err.message : "Could not create the club.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <h3>Onboard a new club</h3>
      <div className="panel-grid cols-2">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label className="field">
            <b>Club name</b>
            <input
              type="text"
              placeholder="e.g. Riverbend Racquet Hall"
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
            />
            {touched && !draft.name.trim() ? (
              <span className="field-err">Club name is required</span>
            ) : null}
          </label>
          <label className="field">
            <b>URL slug</b>
            <input
              type="text"
              className="mono"
              placeholder="riverbend"
              value={draft.slug}
              onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))}
            />
            <span
              className="mono"
              style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)" }}
            >
              {kioskUrl(draft.slug || "<slug>")}
            </span>
            {slugError || (touched && !draft.slug) ? (
              <span className="field-err">{slugError ?? "Slug is required"}</span>
            ) : null}
          </label>
          <label className="field">
            <b>Partner brand color</b>
            <span className="swatches">
              {SWATCHES.map((s) => (
                <button
                  key={s.color}
                  type="button"
                  className={`swatch${draft.brandColor === s.color ? " on" : ""}`}
                  style={{ background: s.color }}
                  aria-label={s.label}
                  onClick={() => set("brandColor", s.color)}
                />
              ))}
              <label
                className={`swatch${customColor ? " on" : ""}`}
                aria-label="Custom color"
                title="Custom color"
                style={{
                  background: customColor
                    ? draft.brandColor
                    : "conic-gradient(#d45a4a, #d9a13b, #2f9e63, #3b82c9, #8a5bc9, #d45a4a)",
                  display: "inline-grid",
                  placeItems: "center",
                }}
              >
                <input
                  type="color"
                  value={draft.brandColor}
                  onChange={(e) => set("brandColor", e.target.value)}
                  style={{ width: 0, height: 0, opacity: 0, border: 0, padding: 0 }}
                />
              </label>
              <span className="mono" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)" }}>
                {draft.brandColor}
              </span>
            </span>
          </label>
          <label className="field">
            <b>Logo</b>
            <span className="logo-drop">Drop logo — shown next to BadmintonRallyUp brand</span>
          </label>
          <label className="field">
            <b>Kiosk header preview</b>
            <span className="kiosk-preview">
              <span
                className="brand-mark"
                style={{ width: 26, height: 26, borderRadius: 8, fontSize: 14 }}
              >
                🏸
              </span>
              <span className="brand-name" style={{ fontSize: "13.5px" }}>
                BadmintonRallyUp
              </span>
              <span className="sep" />
              <span className="color-chip" style={{ background: draft.brandColor }} />
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "13.5px" }}>
                {draft.name.trim() || "Your Club Name"}
              </span>
              <span className="chip dim" style={{ marginLeft: "auto" }}>
                preview
              </span>
            </span>
          </label>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="panel-grid cols-3">
            <label className="field">
              <b>Number of courts</b>
              <input
                type="number"
                min={1}
                value={draft.courtCount}
                onChange={(e) => set("courtCount", e.target.value)}
              />
            </label>
            <label className="field">
              <b>Session length (min)</b>
              <input
                type="number"
                min={15}
                step={5}
                value={draft.sessionMinutes}
                onChange={(e) => set("sessionMinutes", e.target.value)}
              />
            </label>
            <label className="field">
              <b>Queue depth</b>
              <input
                type="number"
                min={1}
                value={draft.queueDepth}
                onChange={(e) => set("queueDepth", e.target.value)}
              />
            </label>
          </div>
          {touched && !numbersValid ? (
            <span className="field-err">
              Courts ≥ 1, session ≥ 15 minutes, queue depth ≥ 1.
            </span>
          ) : null}
          <label className="field">
            <b>Club admin full name</b>
            <input
              type="text"
              placeholder="Full name"
              value={draft.adminName}
              onChange={(e) => set("adminName", e.target.value)}
            />
            {touched && !draft.adminName.trim() ? (
              <span className="field-err">Admin name is required</span>
            ) : null}
          </label>
          <label className="field">
            <b>Club admin email</b>
            <input
              type="email"
              placeholder="admin@club.example"
              value={draft.adminEmail}
              onChange={(e) => set("adminEmail", e.target.value)}
            />
            {touched && !/.+@.+\..+/.test(draft.adminEmail.trim()) ? (
              <span className="field-err">A valid email is required</span>
            ) : null}
          </label>
          <span style={{ fontSize: "12.5px", color: "var(--text-dim)" }}>
            The club admin receives an invite email with a temporary password.
          </span>
          {error && <span className="field-err">{error}</span>}
          <div style={{ marginTop: "auto" }}>
            <button className="btn primary block" disabled={busy} onClick={submit}>
              {busy ? "Creating…" : "Create club & send invite"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ the page */

export default function PlatformPage() {
  // null = not signed in; undefined = still reading localStorage (pre-hydration).
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [clubs, setClubs] = useState<PlatformClub[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [manageClub, setManageClub] = useState<PlatformClub | null>(null);
  const [manageBusy, setManageBusy] = useState(false);
  const [manageError, setManageError] = useState<string | null>(null);
  const [created, setCreated] = useState<OnboardClubResult | null>(null);
  const clock = useClock();

  useEffect(() => {
    setToken(loadToken(TOKEN_KEYS.platform));
  }, []);

  const signOut = useCallback(() => {
    saveToken(TOKEN_KEYS.platform, null);
    setToken(null);
    setClubs(null);
    setManageClub(null);
  }, []);

  const loadClubs = useCallback(
    async (tok: string) => {
      setLoadError(null);
      try {
        setClubs(await courtsApi.get<PlatformClub[]>("/api/platform/clubs", tok));
      } catch (err) {
        if (err instanceof CourtsApiError && err.status === 401) return signOut();
        setLoadError(err instanceof CourtsApiError ? err.message : "Could not load clubs.");
      }
    },
    [signOut],
  );

  useEffect(() => {
    if (token) loadClubs(token);
  }, [token, loadClubs]);

  const stats = useMemo(() => {
    const list = clubs ?? [];
    return {
      clubs: list.length,
      courts: list.reduce((n, c) => n + c.court_count, 0),
      live: list.filter((c) => c.status === "live").length,
      activeClubs: list.filter((c) => c.courts_active_today > 0).length,
      activeCourts: list.reduce((n, c) => n + c.courts_active_today, 0),
    };
  }, [clubs]);

  const setStatus = async (club: PlatformClub, status: ClubStatus) => {
    if (!token || manageBusy) return;
    setManageBusy(true);
    setManageError(null);
    try {
      await courtsApi.patch(`/api/platform/clubs/${club.id}`, { status }, token);
      setClubs((list) =>
        list ? list.map((c) => (c.id === club.id ? { ...c, status } : c)) : list,
      );
      setManageClub(null);
    } catch (err) {
      if (err instanceof CourtsApiError && err.status === 401) return signOut();
      setManageError(err instanceof CourtsApiError ? err.message : "Update failed.");
    } finally {
      setManageBusy(false);
    }
  };

  const topbar = (
    <Topbar
      sub="Courts · Platform"
      partnerLabel="Signed in as"
      partnerName="Platform owner"
      partnerMeta="root access · internal"
      right={
        token ? (
          <div className="top-user">
            <button className="btn sm ghost" onClick={signOut}>
              Sign out
            </button>
          </div>
        ) : undefined
      }
    />
  );

  if (token === undefined) {
    // Reading localStorage — render the shell only (avoids a login flash).
    return topbar;
  }

  if (!token) {
    return (
      <>
        {topbar}
        <LoginPanel
          onToken={(tok) => {
            saveToken(TOKEN_KEYS.platform, tok);
            setToken(tok);
          }}
        />
      </>
    );
  }

  return (
    <>
      {topbar}
      <main className="main">
        <div className="strip">
          <h1>Partner clubs</h1>
          <div className="env-facts">
            <div className="legend-row">
              <span className="dot ok" /> Clubs live: <b>{stats.live}</b>
            </div>
            <div className="legend-row">
              <span className="dot half" /> Total courts: <b>{stats.courts}</b>
            </div>
          </div>
          <div className="spacer" />
          <span className="clock">{clock}</span>
        </div>

        <div
          className="panel-grid"
          style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 18 }}
        >
          <StatPanel value={stats.clubs} label="Clubs" />
          <StatPanel value={stats.courts} label="Courts across clubs" />
          <StatPanel value={stats.activeClubs} label="Active today" />
          <StatPanel value={stats.activeCourts} label="Courts in play today" />
        </div>

        <div className="panel" style={{ marginBottom: 18 }}>
          <h3>Clubs</h3>
          {loadError ? (
            <div className="note">
              {loadError}{" "}
              <button className="btn sm ghost" onClick={() => loadClubs(token)}>
                Retry
              </button>
            </div>
          ) : null}
          <table className="list">
            <thead>
              <tr>
                <th>Name</th>
                <th>URL slug</th>
                <th>Courts</th>
                <th>Club admin</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clubs === null ? (
                <tr>
                  <td colSpan={7} style={{ color: "var(--text-dim)" }}>
                    Loading clubs…
                  </td>
                </tr>
              ) : clubs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ color: "var(--text-dim)" }}>
                    No clubs yet — onboard the first one below.
                  </td>
                </tr>
              ) : (
                clubs.map((club) => (
                  <tr key={club.id}>
                    <td>{club.name}</td>
                    <td className="mono">{club.slug}</td>
                    <td className="mono">{club.court_count}</td>
                    <td className="mono">{club.admin_email ?? "—"}</td>
                    <td>
                      <StatusChip status={club.status} />
                    </td>
                    <td>{fmtCreated(club.created_at)}</td>
                    <td>
                      <button
                        className="btn sm ghost"
                        onClick={() => {
                          setManageError(null);
                          setManageClub(club);
                        }}
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <OnboardPanel
          token={token}
          onAuthError={signOut}
          onCreated={(result) => {
            setCreated(result);
            const club: PlatformClub = {
              ...result.club,
              admin_email: result.club.admin_email ?? null,
              courts_active_today: result.club.courts_active_today ?? 0,
            };
            setClubs((list) => (list ? [...list, club] : [club]));
          }}
        />
      </main>

      {/* -------- Manage club modal -------- */}
      <Modal
        open={manageClub !== null}
        title="Manage club"
        sub={
          manageClub ? (
            <>
              {manageClub.name} ·{" "}
              <span style={{ fontFamily: "var(--font-mono)" }}>{manageClub.slug}</span>
            </>
          ) : undefined
        }
        onClose={() => (manageBusy ? undefined : setManageClub(null))}
        footer={
          manageClub ? (
            <>
              <button
                className="btn ghost"
                disabled={manageBusy}
                onClick={() => setManageClub(null)}
              >
                Close
              </button>
              {manageClub.status !== "suspended" ? (
                <button
                  className="btn danger"
                  disabled={manageBusy}
                  onClick={() => setStatus(manageClub, "suspended")}
                >
                  {manageBusy ? "Working…" : "Suspend club"}
                </button>
              ) : null}
              {manageClub.status !== "live" ? (
                <button
                  className="btn primary"
                  disabled={manageBusy}
                  onClick={() => setStatus(manageClub, "live")}
                >
                  {manageBusy
                    ? "Working…"
                    : manageClub.status === "suspended"
                      ? "Reactivate club"
                      : "Mark live"}
                </button>
              ) : null}
            </>
          ) : undefined
        }
      >
        {manageClub ? (
          <>
            <div className="panel-grid cols-3" style={{ marginBottom: 18 }}>
              <div className="stat">
                <span className="v">{manageClub.court_count}</span>
                <span className="k">Courts</span>
              </div>
              <div className="stat">
                <span className="v">{manageClub.courts_active_today}</span>
                <span className="k">Courts active today</span>
              </div>
              <div className="stat">
                <span className="v" style={{ fontSize: 20 }}>
                  {fmtCreated(manageClub.created_at)}
                </span>
                <span className="k">Created</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label className="field">
                <b>Club admin email</b>
                <input type="email" value={manageClub.admin_email ?? ""} readOnly />
              </label>
              <div style={{ fontSize: "13.5px", display: "flex", alignItems: "center", gap: 8 }}>
                <StatusChip status={manageClub.status} />
                <span style={{ color: "var(--text-dim)" }}>
                  {manageClub.status === "suspended"
                    ? `Kiosk unreachable — ${kioskUrl(manageClub.slug)} returns 404.`
                    : `Kiosk reachable at ${kioskUrl(manageClub.slug)}`}
                </span>
              </div>
              {manageError && <span className="field-err">{manageError}</span>}
            </div>
          </>
        ) : null}
      </Modal>

      {/* -------- Club created modal -------- */}
      <Modal
        open={created !== null}
        title="Club created — invite sent"
        sub={
          <>
            The club is in <Chip tone="dim">Onboarding</Chip> until its admin signs in and
            confirms court setup.
          </>
        }
        onClose={() => setCreated(null)}
        footer={
          <button className="btn primary" onClick={() => setCreated(null)}>
            Done
          </button>
        }
      >
        {created ? (
          <table className="list">
            <tbody>
              <tr>
                <td style={{ color: "var(--text-dim)" }}>Kiosk URL</td>
                <td className="mono">{kioskUrl(created.club.slug)}</td>
              </tr>
              <tr>
                <td style={{ color: "var(--text-dim)" }}>Invite sent to</td>
                <td className="mono">
                  {created.club.admin_email}
                  {created.invite_emailed ? (
                    <span className="chip ok" style={{ marginLeft: 8 }}>
                      Invite emailed
                    </span>
                  ) : (
                    <span
                      className="chip"
                      style={{
                        marginLeft: 8,
                        background: "var(--full-soft)",
                        color: "var(--full-text)",
                      }}
                    >
                      Email failed — resend manually
                    </span>
                  )}
                </td>
              </tr>
              <tr>
                <td style={{ color: "var(--text-dim)" }}>Temporary password</td>
                <td className="mono">emailed · must be changed on first sign-in</td>
              </tr>
            </tbody>
          </table>
        ) : null}
      </Modal>
    </>
  );
}
