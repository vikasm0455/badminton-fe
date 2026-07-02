"use client";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { CredentialView, GroupBrief } from "@/lib/types";
import { fmtClock, fmtCoarse, untilMs } from "@/lib/time";
import { Badge, Button, Card, useToast } from "./ui";

export default function CredentialCard({
  cred,
  isAdmin,
  onDelete,
}: {
  cred: CredentialView;
  isAdmin?: boolean;
  onDelete?: (id: string) => void;
}) {
  const { show } = useToast();
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  const [showShot, setShowShot] = useState(false);
  const [showShares, setShowShares] = useState(false);
  const [myGroups, setMyGroups] = useState<GroupBrief[] | null>(null);
  const [shareIds, setShareIds] = useState<string[]>(cred.shared_group_ids ?? []);
  const [busy, setBusy] = useState(false);

  async function openShares() {
    setShowShares((s) => !s);
    if (!myGroups) setMyGroups(await api.get<GroupBrief[]>("/api/groups").catch(() => []));
  }

  async function saveShares() {
    setBusy(true);
    try {
      await api.put(`/api/credentials/${cred.id}/shares`, { group_ids: shareIds });
      show("Sharing updated", "ok");
      setShowShares(false);
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Could not update sharing", "err");
    } finally {
      setBusy(false);
    }
  }

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

      <div className="mt-2 flex flex-wrap gap-2">
        {cred.has_screenshot && (
          <Button variant="ghost" className="px-2 py-1 text-sm" onClick={() => setShowShot((s) => !s)}>
            {showShot ? "Hide screenshot" : "View screenshot"}
          </Button>
        )}
        {cred.is_mine && (
          <Button variant="ghost" className="px-2 py-1 text-sm" onClick={openShares}>
            🔗 Shared with {shareIds.length} group{shareIds.length === 1 ? "" : "s"}
          </Button>
        )}
        {(cred.is_mine || isAdmin) && onDelete && (
          <Button variant="ghost" className="px-2 py-1 text-sm text-pass" onClick={() => onDelete(cred.id)}>
            {cred.is_mine ? "Delete" : "Remove from group"}
          </Button>
        )}
      </div>

      {showShares && cred.is_mine && (
        <div className="mt-2 rounded-xl border border-gray-200 p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Share with groups</p>
          {myGroups === null ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {myGroups.map((g) => (
                <label key={g.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={shareIds.includes(g.id)}
                    onChange={(e) =>
                      setShareIds((ids) =>
                        e.target.checked ? [...new Set([...ids, g.id])] : ids.filter((x) => x !== g.id)
                      )
                    }
                  />
                  <span className="font-medium">{g.name}</span>
                </label>
              ))}
              <Button className="mt-2 w-full py-2 text-sm" loading={busy} onClick={saveShares}>
                Save sharing
              </Button>
            </div>
          )}
        </div>
      )}

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
