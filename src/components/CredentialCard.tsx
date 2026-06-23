"use client";
import { useEffect, useState } from "react";
import type { CredentialView } from "@/lib/types";
import { fmtClock, fmtCoarse, untilMs } from "@/lib/time";
import { Badge, Button, Card } from "./ui";

export default function CredentialCard({
  cred,
  isAdmin,
  onDelete,
}: {
  cred: CredentialView;
  isAdmin?: boolean;
  onDelete?: (id: string) => void;
}) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  const [showShot, setShowShot] = useState(false);

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted">Name</div>
          <div className="text-2xl font-extrabold text-name">{cred.bintang_name}</div>
          <div className="mt-2 text-xs uppercase tracking-wide text-muted">Password</div>
          <div className="text-2xl font-extrabold text-pass">{cred.bintang_password}</div>
        </div>
        {cred.in_use && <Badge color="amber">In use · Court {cred.in_use_court}</Badge>}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span>
          by {cred.posted_by_name} · {fmtClock(cred.posted_at)}
        </span>
        <span>Clears in {fmtCoarse(untilMs(cred.clears_at))}</span>
      </div>

      <div className="mt-2 flex gap-2">
        {cred.has_screenshot && (
          <Button variant="ghost" className="px-2 py-1 text-sm" onClick={() => setShowShot((s) => !s)}>
            {showShot ? "Hide screenshot" : "View screenshot"}
          </Button>
        )}
        {isAdmin && onDelete && (
          <Button variant="ghost" className="px-2 py-1 text-sm text-pass" onClick={() => onDelete(cred.id)}>
            Delete
          </Button>
        )}
      </div>

      {showShot && cred.has_screenshot && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/credentials/${cred.id}/screenshot`}
          alt="Kiosk screenshot"
          className="mt-2 w-full rounded-xl border border-gray-200"
        />
      )}
    </Card>
  );
}
