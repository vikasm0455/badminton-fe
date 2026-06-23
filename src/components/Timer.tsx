"use client";
import { useEffect, useState } from "react";
import { fmtAgo, fmtMMSS, untilMs } from "@/lib/time";

interface TimerProps {
  startAt: string;
  expiryAt: string;
  status: string;
}

type Phase = "prestart" | "comfortable" | "warning" | "urgent" | "expired" | "done";

function phaseFor(status: string, toStartMs: number, remainMs: number): Phase {
  if (status !== "active") return "done";
  if (toStartMs > 0) return "prestart";
  if (remainMs <= 0) return "expired";
  const mins = remainMs / 60000;
  if (mins < 10) return "urgent";
  if (mins <= 15) return "warning";
  return "comfortable";
}

const COLORS: Record<Phase, string> = {
  prestart: "text-name",
  comfortable: "text-brand",
  warning: "text-warn",
  urgent: "text-urgent animate-urgent",
  expired: "text-muted",
  done: "text-muted",
};

/** Large, self-ticking court countdown with PRD §7.2.1 color states. */
export default function Timer({ startAt, expiryAt, status }: TimerProps) {
  const [, force] = useState(0);
  useEffect(() => {
    if (status !== "active") return;
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  const toStart = untilMs(startAt);
  const remain = untilMs(expiryAt);
  const phase = phaseFor(status, toStart, remain);

  let label: string;
  if (status === "completed") label = "Completed";
  else if (status === "cancelled") label = "Cancelled";
  else if (phase === "prestart") label = `Starts in ${fmtMMSS(toStart)}`;
  else if (phase === "expired") label = `Expired ${fmtAgo(remain)}`;
  else label = `${fmtMMSS(remain)} left`;

  return (
    <div className={`text-[48px] font-extrabold leading-none tabular-nums ${COLORS[phase]}`}>
      {label}
    </div>
  );
}
