"use client";

// Shared Courts UI, matching the approved mock's markup/classes exactly so
// courts.css styles them without page-level CSS.

import { ReactNode, useEffect } from "react";
import {
  CourtStatus,
  CourtView,
  PlayerCred,
  fmtMMSS,
  useCountdown,
} from "./lib";

/* -------------------------------------------------------------- Topbar */

export function Topbar({
  sub = "Courts",
  partnerLabel,
  partnerName,
  partnerMeta,
  brandColor,
  right,
}: {
  /** Text under the brand name (e.g. "Courts", "Courts · Platform"). */
  sub?: string;
  partnerLabel?: string;
  partnerName?: string;
  partnerMeta?: string;
  /** Club brand color, rendered as a chip before the partner name. */
  brandColor?: string;
  /** Optional right-most slot (e.g. <div className="top-user">…</div>). */
  right?: ReactNode;
}) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">🏸</div>
        <div>
          <div className="brand-name">BadmintonRallyUp</div>
          <div className="brand-sub">{sub}</div>
        </div>
      </div>
      <span className="spacer" />
      {partnerName && (
        <div className="top-partner">
          {partnerLabel && <div className="partner-label">{partnerLabel}</div>}
          <div className="partner-name">
            {brandColor && <span className="brand-chip" style={{ background: brandColor }} />}
            {partnerName}
          </div>
          {partnerMeta && <div className="partner-meta">{partnerMeta}</div>}
        </div>
      )}
      {right}
    </header>
  );
}

/* ------------------------------------------------------- StatusBadge */

const BADGES: Record<CourtStatus, { cls: string; label: string }> = {
  available: { cls: "ok", label: "Available" },
  half: { cls: "half", label: "2 spots open" },
  full: { cls: "full", label: "Full" },
  closed: { cls: "closed", label: "Closed" },
};

export function StatusBadge({ status }: { status: CourtStatus }) {
  const badge = BADGES[status];
  return <span className={`badge ${badge.cls}`}>{badge.label}</span>;
}

/* ---------------------------------------------------------- CourtCard */

const COURT_CLS: Record<CourtStatus, string> = {
  available: "is-ok",
  half: "is-half",
  full: "is-full",
  closed: "is-closed",
};

/** Timer turns amber inside the last 10 minutes (mock's `warn` state). */
const WARN_SECONDS = 600;

export function CourtCard({
  court,
  sessionMinutes,
  action,
  resyncKey,
}: {
  court: CourtView;
  sessionMinutes: number;
  /** Bottom action slot: Take / Join / Queue button (or nothing when closed). */
  action?: ReactNode;
  /** Changes on every board push so the countdown re-syncs (e.g. board.now). */
  resyncKey?: unknown;
}) {
  const left = useCountdown(court.seconds_left ?? null, resyncKey);
  const showTimer = left != null && (court.status === "half" || court.status === "full");
  const slots: (string | null)[] = [0, 1, 2, 3].map((i) => court.players[i] ?? null);
  const queueFull = court.queue_len >= court.queue_depth;

  return (
    <div className={`court ${COURT_CLS[court.status]}`}>
      <div className="court-head">
        <span className="court-num">Court {court.number}</span>
        <StatusBadge status={court.status} />
      </div>

      {court.status === "available" && (
        <div style={{ fontSize: "12.5px", color: "var(--text-dim)" }}>
          Bring a group of 2 or 4 — your {sessionMinutes}-min session starts right away.
        </div>
      )}
      {court.status === "closed" && (
        <div className="qrow empty">{court.closed_reason || "Closed by staff"}</div>
      )}
      {showTimer && (
        <div className={`court-timer${left < WARN_SECONDS ? " warn" : ""}`}>
          <span>{fmtMMSS(left)}</span>
          <span className="unit">left</span>
        </div>
      )}

      <div className="players">
        {slots.map((player, i) => (
          <div key={i} className={`pslot${player ? " taken" : ""}`}>
            {player ?? (court.status === "closed" ? "—" : "open")}
          </div>
        ))}
      </div>

      {court.status === "full" && (
        <div className="queue-block">
          <div className="queue-title">
            Queue{" "}
            <span>
              {court.queue_len} / {court.queue_depth}
              {queueFull ? " · full" : ""}
            </span>
          </div>
          {court.queue.length === 0 ? (
            <div className="qrow empty">
              {left != null && left < 180
                ? "Nobody waiting — ends in under 3 min"
                : "Nobody waiting"}
            </div>
          ) : (
            court.queue.map((q) => (
              <div key={q.position} className="qrow">
                <span className="qpos">{q.position}</span>
                <span>{q.label}</span>
                <span className="qeta">~{q.eta_minutes} min</span>
              </div>
            ))
          )}
        </div>
      )}

      {action}
    </div>
  );
}

/* -------------------------------------------------------------- Modal */

export function Modal({
  open,
  title,
  sub,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: ReactNode;
  sub?: ReactNode;
  onClose?: () => void;
  children?: ReactNode;
  /** Rendered inside .modal-foot (Cancel / primary buttons). */
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="overlay open"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true">
        <h2>{title}</h2>
        {sub && <p className="sub">{sub}</p>}
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* --------------------------------------------------------- SegPlayers */

export function SegPlayers({
  value,
  onChange,
  disabled,
}: {
  value: 2 | 4;
  onChange: (players: 2 | 4) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
      <span
        style={{
          fontSize: 11,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: "var(--text-dim)",
          fontWeight: 600,
        }}
      >
        Players
      </span>
      <div className="seg">
        <button
          type="button"
          className={value === 2 ? "on" : ""}
          disabled={disabled}
          onClick={() => onChange(2)}
        >
          2
        </button>
        <button
          type="button"
          className={value === 4 ? "on" : ""}
          disabled={disabled}
          onClick={() => onChange(4)}
        >
          4
        </button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- CredFields */

export function CredFields({
  count,
  values,
  errors,
  onChange,
  disabled,
}: {
  /** Group size: exactly 2 or 4 credential rows. */
  count: 2 | 4;
  values: PlayerCred[];
  /** Per-player error text, indexed like `values` (shown under the username). */
  errors?: (string | null | undefined)[];
  onChange: (index: number, field: "username" | "password", value: string) => void;
  disabled?: boolean;
}) {
  const row = (i: number) => (
    <div className="cred-pair" key={i}>
      <label className="field">
        <b>Player {i + 1} · Username</b>
        <input
          type="text"
          className="mono"
          placeholder="username"
          autoComplete="off"
          disabled={disabled}
          value={values[i]?.username ?? ""}
          onChange={(e) => onChange(i, "username", e.target.value)}
        />
        {errors?.[i] ? <span className="field-err">{errors[i]}</span> : null}
      </label>
      <label className="field">
        <b>Player {i + 1} · Password</b>
        <input
          type="password"
          placeholder="password"
          autoComplete="off"
          disabled={disabled}
          value={values[i]?.password ?? ""}
          onChange={(e) => onChange(i, "password", e.target.value)}
        />
      </label>
    </div>
  );

  return (
    <>
      <div className="cred-grid">{[0, 1].map(row)}</div>
      {count === 4 && (
        <div className="cred-grid" style={{ marginTop: 12 }}>
          {[2, 3].map(row)}
        </div>
      )}
    </>
  );
}

/* --------------------------------------------------------------- Chip */

export function Chip({
  tone = "dim",
  children,
}: {
  tone?: "ok" | "dim" | "cork";
  children: ReactNode;
}) {
  return <span className={`chip ${tone}`}>{children}</span>;
}

/* ---------------------------------------------------------- StatPanel */

export function StatPanel({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="panel">
      <div className="stat">
        <span className="v">{value}</span>
        <span className="k">{label}</span>
      </div>
    </div>
  );
}
