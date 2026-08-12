"use client";

// CLUB ADMIN email sign-in — the slug-less "door" from the Courts landing.
// Admins land here without knowing their club slug; a successful sign-in POSTs
// /api/courts/admin/login (email+password), stashes the JWT under
// `rallyup_club_admin`, and routes into /courts/<slug>/admin, which picks the
// token up from localStorage and — if must_change — shows its forced
// password-change screen. Rate-limit / bad-credential messages surface verbatim.

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AdminEmailLogin,
  CourtsApiError,
  TOKEN_KEYS,
  courtsApi,
  saveToken,
} from "../lib";
import { Topbar } from "../components";

export default function ClubAdminSignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await courtsApi.post<AdminEmailLogin>("/api/courts/admin/login", {
        email: email.trim(),
        password,
      });
      // The admin page reads the token (and must_change) from localStorage on
      // mount, so we don't need to pass anything through the route.
      saveToken(TOKEN_KEYS.clubAdmin, res.token);
      setPassword("");
      router.push(`/courts/${res.club.slug}/admin`);
    } catch (err) {
      // Surface the server's message verbatim — the rate-limit copy in
      // particular ("Too many failed sign-ins…") is what the admin should read.
      setError(err instanceof CourtsApiError ? err.message : "Sign-in failed — try again.");
      setBusy(false);
    }
  };

  return (
    <>
      <Topbar sub="Courts · Club admin" />
      <main className="main" style={{ minWidth: 0, display: "grid", placeItems: "center", minHeight: "calc(100vh - 61px)" }}>
        <form className="panel" style={{ width: 440, maxWidth: "100%", padding: "26px 28px" }} onSubmit={onSubmit}>
          <h3>Club admin sign-in</h3>
          <p style={{ color: "var(--text-dim)", fontSize: "13.5px", marginBottom: 18 }}>
            Sign in with the email your club was onboarded with.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label className="field">
              <b>Email</b>
              <input
                type="email"
                autoComplete="email"
                placeholder="you@club.com"
                required
                autoFocus
                disabled={busy}
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
                disabled={busy}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && <span className="field-err">{error}</span>}
            <button
              className="btn primary block"
              type="submit"
              disabled={busy || !email.trim() || !password}
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </div>
          <div
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: "1px solid var(--line)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              fontSize: "13px",
              color: "var(--text-dim)",
            }}
          >
            <div>
              Are you a player?{" "}
              <Link href="/login" style={{ color: "var(--cork)", fontWeight: 600 }}>
                Sign in to the app
              </Link>
            </div>
            <div>
              Run a club?{" "}
              <a
                href="mailto:support@badmintonrallyup.com"
                style={{ color: "var(--cork)", fontWeight: 600 }}
              >
                Talk to us
              </a>
            </div>
          </div>
        </form>
      </main>
    </>
  );
}
