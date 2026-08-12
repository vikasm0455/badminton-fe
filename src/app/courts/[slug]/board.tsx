"use client";

// KIOSK BOARD — faithful port of the approved mock (kiosk.html). Shared
// computer: no player session; every action posts credentials which the server
// validates and forgets. Board arrives via GET + SSE (useBoardStream), court
// timers count down locally and re-sync on every push.

import { useEffect, useRef, useState } from "react";
import {
  BoardResponse,
  CourtView,
  CourtsApiError,
  PlayerCred,
  courtsApi,
  credErrorMessage,
  etaMinutes,
  fmtMMSS,
  useBoardStream,
} from "../lib";
import { CourtCard, CredFields, Modal, SegPlayers, Topbar } from "../components";

/* ------------------------------------------------------------- helpers */

type ModalKind = "take" | "join" | "queue" | "leave" | "leave_queue";

const ACTION_PATH: Record<ModalKind, string> = {
  take: "take",
  join: "join",
  queue: "queue",
  leave: "leave",
  leave_queue: "queue/leave",
};

const emptyCreds = (): PlayerCred[] => [
  { username: "", password: "" },
  { username: "", password: "" },
  { username: "", password: "" },
  { username: "", password: "" },
];

/** "06:00:00" or "06:00" → "06:00". */
const hhmm = (t: string) => t.slice(0, 5);

/** Long-form ETA for the queue modal ("~37 min", "~1 h 43 min"). */
function fmtEtaLong(minutes: number): string {
  if (minutes < 60) return `~${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `~${h} h ${m} min` : `~${h} h`;
}

/** Live wall clock in the strip (mock's data-clock). Client-tick only. */
function Clock() {
  const [now, setNow] = useState("");
  useEffect(() => {
    const tick = () =>
      setNow(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }),
      );
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);
  return <span className="clock">{now}</span>;
}

/* ---------------------------------------------------------------- page */

export default function KioskBoard({ slug }: { slug: string }) {
  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modal state. `values` always holds 4 rows; `count` decides how many are
  // shown and submitted (join is fixed at 2, take/queue toggle 2/4).
  const [modal, setModal] = useState<{ kind: ModalKind; court: number } | null>(null);
  const [count, setCount] = useState<2 | 4>(4);
  const [values, setValues] = useState<PlayerCred[]>(emptyCreds);
  const [fieldErrors, setFieldErrors] = useState<(string | null)[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);

  useBoardStream(slug, (b) => {
    setBoard(b);
    setLoadError(null);
  });

  // The stream hook swallows fetch errors (it just retries), so probe once to
  // surface an unknown/suspended club instead of loading forever.
  useEffect(() => {
    let cancelled = false;
    courtsApi.get<BoardResponse>(`/api/clubs/${slug}/board`).catch((e) => {
      if (!cancelled && e instanceof CourtsApiError && e.status === 404) {
        setLoadError("This club isn’t available. Check the kiosk URL with the front desk.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Apply the club's kiosk theme to the courts root (courts.css reads
  // [data-theme=dark] on the root or any ancestor of it).
  const theme = board?.club.kiosk_theme ?? null;
  useEffect(() => {
    if (!theme) return;
    const root = rootRef.current?.closest("[data-courts-root]");
    if (!(root instanceof HTMLElement)) return;
    root.setAttribute("data-theme", theme);
    return () => root.removeAttribute("data-theme");
  }, [theme]);

  /* ------------------------------------------------------ modal actions */

  const openModal = (kind: ModalKind, court: number) => {
    setModal({ kind, court });
    // Join is a fixed pair; leaving defaults to a pair (mock's "2" seg on).
    setCount(kind === "take" || kind === "queue" ? 4 : 2);
    setValues(emptyCreds());
    setFieldErrors([]);
    setFormError(null);
    setBusy(false);
  };

  const closeModal = () => {
    if (busy) return;
    setModal(null);
  };

  const setCred = (index: number, field: "username" | "password", value: string) => {
    setValues((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
    if (field === "username" && fieldErrors[index]) {
      setFieldErrors((prev) => prev.map((e, i) => (i === index ? null : e)));
    }
  };

  const submit = async () => {
    if (!modal || busy) return;
    const players = values
      .slice(0, count)
      .map((c) => ({ username: c.username.trim(), password: c.password }));

    setBusy(true);
    setFormError(null);
    setFieldErrors([]);
    try {
      await courtsApi.post(`/api/clubs/${slug}/${ACTION_PATH[modal.kind]}`, {
        court_number: modal.court,
        players,
      });
      // Success: just close — the board updates via the stream.
      setModal(null);
    } catch (e) {
      const err = e instanceof CourtsApiError ? e : null;
      if (err && err.errors.length > 0) {
        // Pin each server error under its username's field; anything that
        // doesn't match a visible row falls back to the form-level line.
        const perField: (string | null)[] = [null, null, null, null];
        const unmatched: string[] = [];
        for (const ce of err.errors) {
          const idx = players.findIndex(
            (p, i) => p.username === ce.username && perField[i] == null,
          );
          if (idx >= 0) perField[idx] = credErrorMessage(ce);
          else unmatched.push(credErrorMessage(ce));
        }
        setFieldErrors(perField);
        setFormError(unmatched.length > 0 ? unmatched.join(" · ") : null);
      } else {
        setFormError(err?.message ?? "Something went wrong — try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  /* -------------------------------------------------------------- empty */

  if (!board) {
    return (
      <div ref={rootRef} id="kiosk">
        <Topbar sub="Courts" />
        <main className="main">
          <div
            className="qrow empty"
            style={{ maxWidth: 460, margin: "90px auto 0", padding: "14px 18px" }}
          >
            {loadError ?? "Loading court board…"}
          </div>
        </main>
      </div>
    );
  }

  /* -------------------------------------------------------------- board */

  const club = board.club;
  const actionsDisabled = !club.open_now;

  const actionFor = (court: CourtView) => {
    switch (court.status) {
      case "available":
        return (
          <button
            className="btn ok block"
            disabled={actionsDisabled}
            onClick={() => openModal("take", court.number)}
          >
            Take this court
          </button>
        );
      case "half":
        return (
          <button
            className="btn primary block"
            disabled={actionsDisabled}
            onClick={() => openModal("join", court.number)}
          >
            Join with your pair · 2 spots
          </button>
        );
      case "full": {
        const queueFull = court.queue_len >= court.queue_depth;
        return (
          <button
            className="btn sm ghost"
            disabled={actionsDisabled || queueFull}
            onClick={() => openModal("queue", court.number)}
          >
            {queueFull ? "Queue full" : "Join queue"}
          </button>
        );
      }
      case "closed":
        return null;
    }
  };

  const modalCourt = modal ? board.courts.find((c) => c.number === modal.court) : undefined;
  const incomplete = values.slice(0, count).some((c) => !c.username.trim() || !c.password);
  // Leaving is deliberately NOT gated on opening hours (mirrors the server):
  // players must always be able to sign off a court or step out of a queue.
  const isLeaveKind = modal?.kind === "leave" || modal?.kind === "leave_queue";
  const submitDisabled = busy || incomplete || (actionsDisabled && !isLeaveKind);
  const queuePosition = (modalCourt?.queue_len ?? 0) + 1;

  return (
    <div ref={rootRef} id="kiosk">
      <Topbar
        sub="Courts"
        partnerLabel="Partner club"
        partnerName={club.name}
        partnerMeta={`${club.court_count} courts · ${club.session_minutes}-min sessions`}
        brandColor={club.brand_color}
      />

      <main className="main">
        {!club.open_now && (
          <div className="note">
            The club is closed right now — open hours are {hhmm(club.opens_at)}–
            {hhmm(club.closes_at)}. The board stays live, but court actions are paused
            until opening.
          </div>
        )}

        <div className="strip">
          <h1>Court board</h1>
          <div className="legend">
            <div className="legend-row">
              <span className="dot ok" /> Available — take it now
            </div>
            <div className="legend-row">
              <span className="dot half" /> Half — 2 spots open
            </div>
            <div className="legend-row">
              <span className="dot full" /> Full — queue for it
            </div>
            <div className="legend-row">
              <span className="dot closed" /> Closed by staff
            </div>
          </div>
          <span className="spacer" />
          <span className="live">Live</span>
          <Clock />
        </div>

        <div className="court-grid">
          {board.courts.map((court) => (
            <CourtCard
              key={court.number}
              court={court}
              sessionMinutes={club.session_minutes}
              resyncKey={board.now}
              timezone={club.timezone}
              action={actionFor(court)}
              onLeaveCourt={
                court.status === "half" || court.status === "full"
                  ? () => openModal("leave", court.number)
                  : undefined
              }
              onLeaveQueue={
                court.queue.length > 0
                  ? () => openModal("leave_queue", court.number)
                  : undefined
              }
            />
          ))}
        </div>

        <div className="foot-note">
          Need a login? Walk-in signup station · Members: check-in station — both by
          the front desk
        </div>
      </main>

      {/* Take an available court */}
      <Modal
        open={modal?.kind === "take"}
        onClose={closeModal}
        title={`Take Court ${modal?.court ?? ""}`}
        sub="Enter the club credentials for everyone playing. Ask the front desk if you don’t have yours."
        footer={
          <>
            <button className="btn ghost" onClick={closeModal} disabled={busy}>
              Cancel
            </button>
            <button className="btn ok" onClick={submit} disabled={submitDisabled}>
              {busy ? "Validating…" : "Validate & take court"}
            </button>
          </>
        }
      >
        <SegPlayers value={count} onChange={setCount} disabled={busy} />
        <CredFields
          count={count}
          values={values}
          errors={fieldErrors}
          onChange={setCred}
          disabled={busy}
        />
        {formError && (
          <div className="field-err" style={{ marginTop: 12 }}>
            {formError}
          </div>
        )}
      </Modal>

      {/* Join a half court with a pair */}
      <Modal
        open={modal?.kind === "join"}
        onClose={closeModal}
        title={`Join Court ${modal?.court ?? ""}`}
        sub={`Exactly 2 spots are open. Your pair joins the running session and shares its remaining ${fmtMMSS(
          modalCourt?.seconds_left ?? 0,
        )} — when the timer ends, the whole court clears. Credentials are checked and then forgotten.`}
        footer={
          <>
            <button className="btn ghost" onClick={closeModal} disabled={busy}>
              Cancel
            </button>
            <button className="btn primary" onClick={submit} disabled={submitDisabled}>
              {busy ? "Validating…" : "Join court"}
            </button>
          </>
        }
      >
        <CredFields
          count={2}
          values={values}
          errors={fieldErrors}
          onChange={setCred}
          disabled={busy}
        />
        {formError && (
          <div className="field-err" style={{ marginTop: 12 }}>
            {formError}
          </div>
        )}
      </Modal>

      {/* Queue for a full court */}
      <Modal
        open={modal?.kind === "queue"}
        onClose={closeModal}
        title={`Queue for Court ${modal?.court ?? ""}`}
        sub="Enter the club credentials for everyone in your group. We’ll call your group when the court clears."
        footer={
          <>
            <button className="btn ghost" onClick={closeModal} disabled={busy}>
              Cancel
            </button>
            <button className="btn primary" onClick={submit} disabled={submitDisabled}>
              {busy ? "Validating…" : "Join queue"}
            </button>
          </>
        }
      >
        <SegPlayers value={count} onChange={setCount} disabled={busy} />
        <CredFields
          count={count}
          values={values}
          errors={fieldErrors}
          onChange={setCred}
          disabled={busy}
        />
        <div
          style={{
            marginTop: 16,
            fontSize: 13,
            color: "var(--text-dim)",
            borderTop: "1px solid var(--line)",
            paddingTop: 12,
          }}
        >
          You’ll be position <b style={{ color: "var(--text)" }}>{queuePosition}</b> ·
          estimated start{" "}
          <b style={{ color: "var(--text)" }}>
            {fmtEtaLong(
              etaMinutes(
                modalCourt?.seconds_left ?? 0,
                queuePosition,
                club.session_minutes,
              ),
            )}
          </b>
        </div>
        {formError && (
          <div className="field-err" style={{ marginTop: 12 }}>
            {formError}
          </div>
        )}
      </Modal>

      {/* Leave a court (pair or whole group) */}
      <Modal
        open={modal?.kind === "leave"}
        onClose={closeModal}
        title={`Leave Court ${modal?.court ?? ""}`}
        sub="Leaving works like signing up — a pair leaves together, or the whole group."
        footer={
          <>
            <button className="btn ghost" onClick={closeModal} disabled={busy}>
              Cancel
            </button>
            <button className="btn danger" onClick={submit} disabled={submitDisabled}>
              {busy ? "Validating…" : "Leave court"}
            </button>
          </>
        }
      >
        <SegPlayers label="Leaving" value={count} onChange={setCount} disabled={busy} />
        <CredFields
          count={count}
          values={values}
          errors={fieldErrors}
          onChange={setCred}
          disabled={busy}
        />
        <div
          style={{
            marginTop: 16,
            fontSize: 13,
            color: "var(--text-dim)",
            borderTop: "1px solid var(--line)",
            paddingTop: 12,
          }}
        >
          If everyone leaves, the court goes to the next group in the queue right away.
        </div>
        {formError && (
          <div className="field-err" style={{ marginTop: 12 }}>
            {formError}
          </div>
        )}
      </Modal>

      {/* Leave a queue (pair or whole group, same group only) */}
      <Modal
        open={modal?.kind === "leave_queue"}
        onClose={closeModal}
        title={`Leave the queue for Court ${modal?.court ?? ""}`}
        sub="Leaving works like signing up — a pair steps out together, or the whole group."
        footer={
          <>
            <button className="btn ghost" onClick={closeModal} disabled={busy}>
              Cancel
            </button>
            <button className="btn danger" onClick={submit} disabled={submitDisabled}>
              {busy ? "Validating…" : "Leave queue"}
            </button>
          </>
        }
      >
        <SegPlayers label="Leaving" value={count} onChange={setCount} disabled={busy} />
        <CredFields
          count={count}
          values={values}
          errors={fieldErrors}
          onChange={setCred}
          disabled={busy}
        />
        <div
          style={{
            marginTop: 16,
            fontSize: 13,
            color: "var(--text-dim)",
            borderTop: "1px solid var(--line)",
            paddingTop: 12,
          }}
        >
          Everyone leaving must be in the same queue group. If the whole group leaves,
          everyone behind moves up a spot.
        </div>
        {formError && (
          <div className="field-err" style={{ marginTop: 12 }}>
            {formError}
          </div>
        )}
      </Modal>
    </div>
  );
}
