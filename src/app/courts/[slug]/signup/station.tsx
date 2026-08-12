"use client";

// WALK-IN SIGNUP STATION — faithful port of the approved mock (register.html).
// Self-serve terminal: pick a username, see availability live (debounced
// 400 ms), create today's day pass, read the giant result panel. The screen
// clears itself after 45 s (or on Done) for the next player.

import { useEffect, useRef, useState } from "react";
import {
  CourtsApiError,
  CredentialPair,
  WALKIN_USERNAME_RE,
  useStationClub,
  walkinCheck,
  walkinCreate,
} from "../../lib";
import { Topbar } from "../../components";

const RESET_MS = 45_000;

type Avail =
  | { state: "idle" }
  | { state: "invalid" }
  | { state: "checking" }
  | { state: "free"; username: string }
  | { state: "taken"; username: string; reason: string | null }
  | { state: "error"; message: string };

export default function SignupStation({ slug }: { slug: string }) {
  const { club, error: clubError } = useStationClub(slug);

  const [username, setUsername] = useState("");
  const [avail, setAvail] = useState<Avail>({ state: "idle" });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<CredentialPair | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const seqRef = useRef(0);

  // Apply the club's kiosk theme to the courts root (courts.css reads
  // [data-theme=dark] on the root or any ancestor of it).
  const theme = club?.kiosk_theme ?? null;
  useEffect(() => {
    if (!theme) return;
    const root = rootRef.current?.closest("[data-courts-root]");
    if (!(root instanceof HTMLElement)) return;
    root.setAttribute("data-theme", theme);
    return () => root.removeAttribute("data-theme");
  }, [theme]);

  // Debounced availability check: 400 ms after the last keystroke. A sequence
  // counter drops stale responses so fast typing can't flash wrong states.
  useEffect(() => {
    const name = username;
    seqRef.current += 1;
    const seq = seqRef.current;
    if (!name) {
      setAvail({ state: "idle" });
      return;
    }
    if (!WALKIN_USERNAME_RE.test(name)) {
      setAvail({ state: "invalid" });
      return;
    }
    setAvail({ state: "checking" });
    const timer = setTimeout(async () => {
      try {
        const r = await walkinCheck(slug, name);
        if (seqRef.current !== seq) return;
        setAvail(
          r.available
            ? { state: "free", username: name }
            : { state: "taken", username: name, reason: r.reason ?? null },
        );
      } catch (e) {
        if (seqRef.current !== seq) return;
        setAvail({
          state: "error",
          message:
            e instanceof CourtsApiError
              ? e.message
              : "Can’t check right now — try again.",
        });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [slug, username]);

  // Result screen clears itself for the next player.
  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(() => setResult(null), RESET_MS);
    return () => clearTimeout(timer);
  }, [result]);

  const create = async () => {
    if (busy || avail.state !== "free" || avail.username !== username) return;
    setBusy(true);
    setFormError(null);
    try {
      const pair = await walkinCreate(slug, username);
      setResult(pair);
      setUsername("");
      setAvail({ state: "idle" });
    } catch (e) {
      // Server messages (incl. the rate-limit line) are shown verbatim.
      setFormError(
        e instanceof CourtsApiError ? e.message : "Something went wrong — try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const done = () => {
    setResult(null);
    setFormError(null);
  };

  /* ---------------------------------------------- loading / unavailable */

  if (!club) {
    return (
      <div ref={rootRef} id="s-register">
        <Topbar sub="Courts" />
        <main className="main">
          <div
            className="qrow empty"
            style={{ maxWidth: 460, margin: "90px auto 0", padding: "14px 18px" }}
          >
            {clubError ?? "Loading signup station…"}
          </div>
        </main>
      </div>
    );
  }

  /* ------------------------------------------------------------- station */

  const availLine = (() => {
    switch (avail.state) {
      case "idle":
        return null;
      case "invalid":
        return (
          <div className="avail" style={{ marginTop: 10 }}>
            3–20 characters — lowercase letters, numbers, and . _ -
          </div>
        );
      case "checking":
        return (
          <div className="avail" style={{ marginTop: 10 }}>
            Checking availability…
          </div>
        );
      case "free":
        return (
          <div className="avail free" style={{ marginTop: 10 }}>
            ✓ {avail.username} is available
          </div>
        );
      case "taken":
        return (
          <div className="avail taken" style={{ marginTop: 10 }}>
            {/* reason is a machine code ("taken" | "invalid"), not display copy */}
            ✕{" "}
            {avail.reason === "invalid"
              ? "3–20 characters — lowercase letters, numbers, and . _ -"
              : `${avail.username} is taken today — try another`}
          </div>
        );
      case "error":
        return (
          <div className="avail err" style={{ marginTop: 10 }}>
            {avail.message}
          </div>
        );
    }
  })();

  return (
    <div ref={rootRef} id="s-register">
      <Topbar
        sub="Courts"
        partnerLabel="Partner club"
        partnerName={club.name}
        partnerMeta="Walk-in signup station"
        brandColor={club.brand_color}
      />

      <main className="main">
        <div className="station-col">
          <div className="station-label">Walk-in signup station</div>

          {result ? (
            <>
              <h1>You’re in for today</h1>
              <div className="panel cred-panel">
                <div className="partner-label">Your login for today</div>
                <div className="cred-k">Username</div>
                <div className="cred-big">{result.username}</div>
                <div className="cred-k">Password</div>
                <div className="cred-big pw">{result.password}</div>
                <div className="cred-note">
                  Valid until midnight tonight. Snap a photo — the front desk can look
                  it up if you forget.
                </div>
              </div>
              <button className="btn ghost block" onClick={done}>
                Done
              </button>
              <div className="reset-hint">This screen clears itself for the next player.</div>
            </>
          ) : (
            <>
              <h1>Get your login for today</h1>
              <p className="station-sub">
                Pick a username — we’ll make you an easy password. It works at the
                court board until midnight.
              </p>

              <div>
                <label className="field" style={{ gap: 10 }}>
                  <b>Your username</b>
                  <input
                    type="text"
                    className="mono station-input"
                    autoComplete="off"
                    spellCheck={false}
                    autoFocus
                    maxLength={20}
                    disabled={busy}
                    value={username}
                    onChange={(e) =>
                      setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") create();
                    }}
                  />
                </label>
                {availLine}
              </div>

              <button
                className="btn primary block station-cta"
                disabled={
                  busy || avail.state !== "free" || avail.username !== username
                }
                onClick={create}
              >
                {busy ? "Creating…" : "Create my login"}
              </button>

              {formError && (
                <div className="avail err" role="alert">
                  {formError}
                </div>
              )}

              <div className="reset-hint">This screen clears itself for the next player.</div>
            </>
          )}
        </div>

        <div className="foot-note">{club.name} · walk-in signup</div>
      </main>
    </div>
  );
}
