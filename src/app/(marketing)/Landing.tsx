"use client";

import { useEffect, useRef } from "react";
import "./landing.css";

/**
 * Marketing landing — the signed-out front door for browser visitors.
 * Faithful React port of the approved static mock (courts-mock/landing.html).
 * All classes are prefixed lp- and every rule is scoped under .lp-root so the
 * PWA's Tailwind/globals styling can never collide with the landing, or vice
 * versa. See landing.css.
 */
export default function Landing() {
  const timerRef = useRef<HTMLSpanElement>(null);

  // Tick the hero vignette timer so the page feels alive (skipped for reduced motion).
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    let s = 32 * 60 + 14;
    const id = window.setInterval(() => {
      s = s > 0 ? s - 1 : 35 * 60;
      const m = Math.floor(s / 60);
      const r = s % 60;
      const el = timerRef.current;
      if (el) {
        el.textContent = `${m < 10 ? "0" + m : m}:${r < 10 ? "0" + r : r}`;
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="lp-root" id="top">
      {/* ================= TOPBAR ================= */}
      <header className="lp-topbar">
        <div className="lp-topbar-inner">
          <a className="lp-brand" href="#top" aria-label="BadmintonRallyUp home">
            <div className="lp-brand-mark" aria-hidden="true">
              🏸
            </div>
            <div>
              <div className="lp-brand-name">BadmintonRallyUp</div>
              <div className="lp-brand-sub">Game night, sorted</div>
            </div>
          </a>
          <nav className="lp-topnav" aria-label="Page sections">
            <a href="#app">The app</a>
            <a href="#clubs">For clubs</a>
            <a href="#download">Download</a>
          </nav>
          <div className="lp-spacer" />
          <a className="lp-btn" href="/login">
            Open the app
          </a>
        </div>
      </header>

      {/* ================= HERO ================= */}
      <section className="lp-hero">
        {/* oversized court-line motif (deliberate editorial gesture) */}
        <svg className="lp-court-motif" viewBox="0 0 610 1340" fill="none" aria-hidden="true">
          <g stroke="currentColor" strokeWidth="6">
            <rect x="5" y="5" width="600" height="1330" />
            <line x1="51" y1="5" x2="51" y2="1335" />
            <line x1="559" y1="5" x2="559" y2="1335" />
            <line x1="5" y1="670" x2="605" y2="670" strokeWidth="10" />
            <line x1="5" y1="472" x2="605" y2="472" />
            <line x1="5" y1="868" x2="605" y2="868" />
            <line x1="5" y1="81" x2="605" y2="81" />
            <line x1="5" y1="1259" x2="605" y2="1259" />
            <line x1="305" y1="5" x2="305" y2="472" />
            <line x1="305" y1="868" x2="305" y2="1335" />
          </g>
        </svg>
        {/* shuttle trajectory arc over the headline */}
        <svg
          className="lp-shuttle-arc"
          viewBox="0 0 1200 620"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <path
            d="M -40 560 Q 330 40 760 210 T 1260 120"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="3 10"
            strokeLinecap="round"
            fill="none"
            opacity="0.5"
          />
          <g transform="translate(760 210) rotate(24)" opacity="0.75">
            <circle cx="0" cy="0" r="7" fill="currentColor" />
            <path
              d="M -4 -5 L -22 -15 M 0 -7 L -14 -22 M 4 -5 L -2 -23"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </g>
        </svg>

        <div className="lp-hero-inner">
          <div>
            <span className="lp-hero-eyebrow">Now on the App Store</span>
            <h1>
              Your badminton <span className="lp-accent">crew,</span> organized.
            </h1>
            <p className="lp-hero-sub">
              Tonight&apos;s poll, live court timers, and your group&apos;s shared court logins —
              one app that gets everyone from &ldquo;who&apos;s in?&rdquo; to on-court.
            </p>

            <div className="lp-dl-row" id="download">
              <a className="lp-appstore-badge" href="https://apps.apple.com/app/id6790264978">
                <svg viewBox="0 0 384 512" fill="currentColor" aria-hidden="true">
                  <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.7-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
                </svg>
                <span>
                  <span className="lp-tiny">Download on the</span>
                  <span className="lp-big">App Store</span>
                </span>
              </a>
              <span className="lp-play-chip" aria-label="Google Play version coming soon">
                Google Play <span className="lp-soon">Coming soon</span>
              </span>
            </div>
            <p className="lp-hero-footnote">
              Also runs in the browser — <a href="/login">open the web app</a> and sign in.
            </p>
          </div>

          {/* honest product vignette: poll + timer + shared logins */}
          <div
            className="lp-vignette"
            aria-label="Illustration of the app: tonight's poll, a live court timer, and shared court logins"
          >
            <div className="lp-v-card lp-tilt-l">
              <div className="lp-v-head">
                <span className="lp-v-title">Tonight · Thursday</span>
                <span className="lp-v-meta">7:00 pm session</span>
              </div>
              <div className="lp-poll-row">
                <span className="lp-avatar" aria-hidden="true">
                  M
                </span>
                <span className="lp-handle">mira-77</span>
                <span className="lp-vote lp-in">IN</span>
              </div>
              <div className="lp-poll-row">
                <span className="lp-avatar lp-g" aria-hidden="true">
                  A
                </span>
                <span className="lp-handle">AlexK</span>
                <span className="lp-vote lp-in">IN</span>
              </div>
              <div className="lp-poll-row">
                <span className="lp-avatar lp-q" aria-hidden="true">
                  J
                </span>
                <span className="lp-handle">jordan.p</span>
                <span className="lp-vote lp-in">IN</span>
              </div>
              <div className="lp-poll-row">
                <span className="lp-avatar" aria-hidden="true">
                  S
                </span>
                <span className="lp-handle">sam_t</span>
                <span className="lp-vote lp-out">OUT</span>
              </div>
              <div className="lp-poll-tally">
                <span>5 in · 2 out</span>
                <span className="lp-tally-bar" aria-hidden="true">
                  <i />
                </span>
                <span>doubles ✓</span>
              </div>
            </div>

            <div className="lp-v-card lp-tilt-r">
              <div className="lp-v-head">
                <span className="lp-v-title">Court 3</span>
                <span className="lp-chip lp-ok">On court</span>
              </div>
              <div className="lp-big-timer">
                <span ref={timerRef}>32:14</span>
                <span className="lp-unit">left</span>
              </div>
              <div className="lp-timer-sub">mira-77 · AlexK · jordan.p · dev_akh</div>
            </div>

            <div className="lp-v-card">
              <div className="lp-v-head">
                <span className="lp-v-title">Shared logins</span>
                <span className="lp-v-meta">tonight</span>
              </div>
              <div className="lp-login-rows">
                <div className="lp-login-row">
                  <span className="lp-dotk lp-used" aria-hidden="true" />
                  <span className="lp-lg">login-1</span>
                  <span className="lp-who">booked · Court 3, 7–8 pm</span>
                  <span className="lp-chip lp-dim">In use</span>
                </div>
                <div className="lp-login-row">
                  <span className="lp-dotk lp-free" aria-hidden="true" />
                  <span className="lp-lg">login-2</span>
                  <span className="lp-who">nobody&apos;s on it</span>
                  <span className="lp-chip lp-ok">Free</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= THE APP ================= */}
      <section id="app" className="lp-section-pad">
        <div className="lp-wrap">
          <div className="lp-section-head">
            <div className="lp-kicker">The app</div>
            <h2>Everything between &ldquo;who&apos;s in?&rdquo; and match point.</h2>
            <p>
              RallyUp is built for regular groups that play together every week — the polls, timers,
              and logistics that usually live in a group chat, done properly.
            </p>
          </div>
          <div className="lp-feat-grid">
            <div className="lp-feat">
              <div className="lp-feat-ico" aria-hidden="true">
                🗳️
              </div>
              <h3>Tonight&apos;s polls</h3>
              <p>
                One tap to say you&apos;re in. The count updates live for the whole group, so you
                know if it&apos;s doubles or drills before you leave the house.
              </p>
            </div>
            <div className="lp-feat">
              <div className="lp-feat-ico lp-g" aria-hidden="true">
                ⏱️
              </div>
              <h3>Live court timers</h3>
              <p>
                Every court on a clock. Check time remaining from the bench instead of hovering at
                the baseline.
              </p>
            </div>
            <div className="lp-feat">
              <div className="lp-feat-ico" aria-hidden="true">
                🔑
              </div>
              <h3>Shared court logins</h3>
              <p>
                Groups that share booking logins can see at a glance which one is free — no more
                double-booking on the same account.
              </p>
            </div>
            <div className="lp-feat">
              <div className="lp-feat-ico lp-g" aria-hidden="true">
                📈
              </div>
              <h3>Personal stats</h3>
              <p>
                Sessions played, total court time, and kcal burned — your season, in numbers
                you&apos;ll actually check.
              </p>
            </div>
            <div className="lp-feat">
              <div className="lp-feat-ico" aria-hidden="true">
                ❤️
              </div>
              <h3>Apple Health sync</h3>
              <p>
                Finish a session and it lands in Apple Health as a badminton workout. Nothing to log
                twice.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FOR CLUBS ================= */}
      <section id="clubs" className="lp-clubs-band lp-section-pad">
        <div className="lp-wrap">
          <div className="lp-clubs-grid">
            <div className="lp-clubs-copy">
              <div className="lp-kicker">For clubs · Courts</div>
              <h2>A digital court board for your front desk.</h2>
              <ul>
                <li>
                  Players take a free court or join one in groups of 2 or 4 — straight from the
                  board.
                </li>
                <li>Full courts form a queue with live ETAs, so nobody hovers at the net post.</li>
                <li>Admins set session hours and closures; the board enforces them on its own.</li>
              </ul>
              <div className="lp-clubs-ctas">
                <a
                  className="lp-btn lp-primary"
                  href="mailto:support@badmintonrallyup.com?subject=Courts%20for%20our%20club"
                >
                  Get Courts for your club
                </a>
                <a className="lp-btn" href="/courts/signin">
                  Club admin sign-in
                </a>
              </div>
            </div>

            <div>
              <div
                className="lp-board"
                aria-label="Illustration of the court board: an open court, a full court with a queue, and a closed court"
              >
                <div className="lp-mini-court lp-is-ok">
                  <div className="lp-mc-head">
                    <span className="lp-mc-num">Court 1</span>
                    <span className="lp-chip lp-ok">Open</span>
                  </div>
                  <div className="lp-mc-slots">
                    <span className="lp-mc-slot">open</span>
                    <span className="lp-mc-slot">open</span>
                    <span className="lp-mc-slot">open</span>
                    <span className="lp-mc-slot">open</span>
                  </div>
                  <div className="lp-mc-queue">
                    <div
                      className="lp-mc-qrow"
                      style={{ justifyContent: "center", color: "var(--text-dim)" }}
                    >
                      tap to take the court
                    </div>
                  </div>
                </div>
                <div className="lp-mini-court lp-is-full">
                  <div className="lp-mc-head">
                    <span className="lp-mc-num">Court 2</span>
                    <span className="lp-chip lp-full">Full</span>
                  </div>
                  <div className="lp-mc-timer">
                    21:40<span className="lp-unit">left</span>
                  </div>
                  <div className="lp-mc-slots">
                    <span className="lp-mc-slot lp-taken">mira-77</span>
                    <span className="lp-mc-slot lp-taken">AlexK</span>
                    <span className="lp-mc-slot lp-taken">jordan.p</span>
                    <span className="lp-mc-slot lp-taken">dev_akh</span>
                  </div>
                  <div className="lp-mc-queue">
                    <div className="lp-mc-qrow">
                      <span className="lp-pos">1</span>
                      <span className="lp-nm">priya.s +1</span>
                      <span className="lp-eta">~22m</span>
                    </div>
                    <div className="lp-mc-qrow">
                      <span className="lp-pos">2</span>
                      <span className="lp-nm">tom_w +3</span>
                      <span className="lp-eta">~67m</span>
                    </div>
                  </div>
                </div>
                <div className="lp-mini-court lp-is-closed">
                  <div className="lp-mc-head">
                    <span className="lp-mc-num">Court 3</span>
                    <span className="lp-chip lp-dim">Closed</span>
                  </div>
                  <div className="lp-mc-closed-note">
                    Closed by admin — reopens for the 7 pm session.
                  </div>
                </div>
              </div>
              <p className="lp-board-cap">
                The board, as your players see it — statuses, queues, and ETAs update live.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= SIGN-IN ROUTER ================= */}
      <section className="lp-section-pad">
        <div className="lp-wrap">
          <div className="lp-section-head">
            <div className="lp-kicker">Already with us?</div>
            <h2>Pick your door.</h2>
          </div>
          <div className="lp-router-grid">
            <div className="lp-route">
              <span className="lp-who-label">Players</span>
              <h3>Open the web app</h3>
              <p>
                Vote on tonight, check the timers, and see your stats — right in the browser.
              </p>
              <a className="lp-go" href="/login">
                Sign in
              </a>
            </div>
            <div className="lp-route">
              <span className="lp-who-label">Club admins</span>
              <h3>Run the court board</h3>
              <p>Manage courts, sessions, and closures from your front-desk console.</p>
              <a className="lp-go" href="/courts/signin">
                Admin sign-in
              </a>
            </div>
            <div className="lp-route">
              <span className="lp-who-label">New here</span>
              <h3>Start on iPhone</h3>
              <p>The fastest way in — grab the app and join your group from your phone.</p>
              <a className="lp-go" href="https://apps.apple.com/app/id6790264978">
                Get the app
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="lp-footer">
        <div className="lp-wrap lp-foot-inner">
          <span className="lp-copy">© BadmintonRallyUp</span>
          <nav className="lp-foot-links" aria-label="Footer">
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="mailto:support@badmintonrallyup.com">Contact</a>
            <a href="/platform" className="lp-quiet">
              Platform
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
