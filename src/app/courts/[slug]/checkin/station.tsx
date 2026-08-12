"use client";

// MEMBER CHECK-IN STATION — faithful port of the approved mock (checkin.html).
// Barcode-first: the member-ID input is ALWAYS focused (autoFocus, refocus on
// blur and after every result) so a USB scanner — which types the ID and
// presses Enter — just works. Typing the ID manually is the same input.
// The result panel clears itself after 45 s.

import { FormEvent, useEffect, useRef, useState } from "react";
import { CheckinResult, CourtsApiError, memberCheckin, useStationClub } from "../../lib";
import { Topbar } from "../../components";

const RESET_MS = 45_000;

/** Bar widths of the decorative barcode glyph, straight from the mock. */
const BARCODE = [
  3, 7, 2, 5, 2, 9, 3, 2, 6, 2, 4, 8, 2, 3, 6, 2, 5, 2, 7, 3, 2, 9, 2, 4, 2,
  6, 3, 8, 2, 5,
];

export default function CheckinStation({ slug }: { slug: string }) {
  const { club, error: clubError } = useStationClub(slug);

  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckinResult | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refocus = () => {
    // Deferred so it wins over whatever just stole focus (button click, tap).
    setTimeout(() => inputRef.current?.focus(), 30);
  };

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

  // Result panel clears itself for the next member.
  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(() => {
      setResult(null);
      refocus();
    }, RESET_MS);
    return () => clearTimeout(timer);
  }, [result]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const memberRef = value.trim();
    if (!memberRef || busy) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await memberCheckin(slug, memberRef));
    } catch (err) {
      setResult(null);
      // Server messages (unknown card, lockout) are shown verbatim.
      setError(
        err instanceof CourtsApiError
          ? err.message
          : "Something went wrong — try again.",
      );
    } finally {
      // Always clear the field so the next scan starts clean, and refocus so
      // the scanner keeps working without anyone touching the screen.
      setBusy(false);
      setValue("");
      refocus();
    }
  };

  /* ---------------------------------------------- loading / unavailable */

  if (!club) {
    return (
      <div ref={rootRef} id="s-checkin">
        <Topbar sub="Courts" />
        <main className="main">
          <div
            className="qrow empty"
            style={{ maxWidth: 460, margin: "90px auto 0", padding: "14px 18px" }}
          >
            {clubError ?? "Loading check-in station…"}
          </div>
        </main>
      </div>
    );
  }

  /* ------------------------------------------------------------- station */

  return (
    <div ref={rootRef} id="s-checkin">
      <Topbar
        sub="Courts"
        partnerLabel="Club"
        partnerName={club.name}
        partnerMeta="Member check-in station"
        brandColor={club.brand_color}
      />

      <main className="main">
        <div className="ck-col">
          <div className="ck-station-label">Member check-in</div>
          <h1 className="ck-title">Scan your membership card</h1>

          <section className="panel ck-scan" aria-label="Card scanner">
            <div className="ck-barcode" role="img" aria-label="Barcode illustration">
              {BARCODE.map((w, i) => (
                <span key={i} style={{ width: w }} />
              ))}
            </div>
            <p className="ck-scan-line">Hold your card under the scanner</p>
            <form className="field ck-manual" onSubmit={submit}>
              <label className="field" style={{ width: "100%" }}>
                <b>Or type your member ID</b>
                <input
                  ref={inputRef}
                  type="text"
                  className="mono"
                  aria-label="Member ID"
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus
                  disabled={busy}
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    if (error) setError(null);
                  }}
                  onBlur={refocus}
                />
              </label>
            </form>
            {error && (
              <div className="ck-err" role="alert">
                {error}
              </div>
            )}
          </section>

          {result && (
            <section className="panel ck-result" aria-label="Check-in result">
              <div className="ck-welcome">
                Welcome back, {result.display_name || result.username}
              </div>
              <div className="ck-member-row">
                <span className="chip cork">Member</span>
                <span className="ck-mono-id">{result.member_ref}</span>
              </div>
              <div className="ck-login-label">Your login for today</div>
              <div className="ck-cred-rows">
                <div className="ck-cred">
                  <span className="ck-cred-k">Username</span>
                  <span className="ck-cred-v">{result.username}</span>
                </div>
                <div className="ck-cred">
                  <span className="ck-cred-k">Password</span>
                  <span className="ck-cred-v ck-cred-pass">{result.password}</span>
                </div>
              </div>
              <p className="ck-note">
                New password every day — yesterday’s won’t work. Valid until midnight.
              </p>
              <div className="reset-hint">This screen clears itself for the next member.</div>
            </section>
          )}

          <p className="ck-hint">Wrong card? See the front desk.</p>
        </div>

        <div className="foot-note">{club.name} · member check-in</div>
      </main>
    </div>
  );
}
