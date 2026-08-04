"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Card, Spinner, useToast } from "@/components/ui";

export type SharePoll = {
  poll_id: string;
  group_name: string;
  proposed_time: string;
  note: string | null;
  locked: boolean;
  yes: number;
  maybe: number;
  no: number;
};
export type ShareInfo = { ended: boolean; poll: SharePoll | null };

/** Poll share landing: vote in place (members), sign-in round-trip (guests),
 *  info-only for non-members. Initial data comes server-rendered for OG. */
export default function PollShareClient({
  token,
  initial,
}: {
  token: string;
  initial: ShareInfo | null;
}) {
  const { user, loading } = useAuth();
  const { show } = useToast();

  const [info, setInfo] = useState<ShareInfo | null>(initial);
  const [missing, setMissing] = useState(initial === null);
  // Discovered from the vote response, not pre-checked: the "tonight" list is
  // moderation-filtered, so a member who blocked the poll's creator would be
  // misclassified as an outsider by any list-based check.
  const [notMember, setNotMember] = useState(false);
  const [voted, setVoted] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    api
      .get<ShareInfo>(`/api/poll-share/${token}`)
      .then((i) => {
        setInfo(i);
        setMissing(false);
      })
      .catch(() => setMissing(true));
  }, [token]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function vote(v: "yes" | "maybe" | "no") {
    if (!info?.poll) return;
    setBusy(true);
    try {
      await api.put(`/api/polls/${info.poll.poll_id}/vote`, { vote: v });
      setVoted(v);
      reload();
    } catch (e) {
      // 404 = the server says this poll isn't in any of my groups.
      if (e instanceof ApiError && e.status === 404) {
        setNotMember(true);
      } else {
        show(e instanceof ApiError ? e.message : "Could not vote.", "err");
      }
    } finally {
      setBusy(false);
    }
  }

  const returnTo = encodeURIComponent(`/p/${token}`);

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <Card className="w-full max-w-sm text-center">
        {missing ? (
          <>
            <div className="text-3xl">🏸</div>
            <h1 className="mt-2 text-lg font-bold">This poll link isn&apos;t active</h1>
            <p className="mt-2 text-sm text-muted">
              Ask in your group for a fresh link, or check RallyUp for tonight&apos;s poll.
            </p>
          </>
        ) : !info ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : info.ended || !info.poll ? (
          <>
            <div className="text-3xl">🌙</div>
            <h1 className="mt-2 text-lg font-bold">This poll has ended</h1>
            <p className="mt-2 text-sm text-muted">
              Polls clear every night. Check RallyUp for tonight&apos;s poll.
            </p>
          </>
        ) : (
          <>
            <div className="text-3xl">🏸</div>
            <h1 className="mt-2 text-lg font-bold">
              Playing tonight at {info.poll.proposed_time}?
            </h1>
            <p className="mt-2 text-sm text-muted">
              {info.poll.group_name}
              {info.poll.note ? ` · ${info.poll.note}` : ""}
            </p>
            <div className="mt-3 flex justify-center gap-5 text-xs text-muted">
              <span>
                <b className="block text-base text-ink">{info.poll.yes}</b> yes
              </span>
              <span>
                <b className="block text-base text-ink">{info.poll.maybe}</b> maybe
              </span>
              <span>
                <b className="block text-base text-ink">{info.poll.no}</b> no
              </span>
            </div>

            {info.poll.locked ? (
              <p className="mt-4 text-sm font-semibold text-muted">
                🔒 Voting is closed — attendance is confirmed. See you on court!
              </p>
            ) : loading ? (
              <div className="mt-4 flex justify-center">
                <Spinner />
              </div>
            ) : !user ? (
              <div className="mt-4 flex flex-col gap-2">
                <Link href={`/login?returnTo=${returnTo}`}>
                  <Button className="w-full py-2.5">Sign in to vote</Button>
                </Link>
              </div>
            ) : notMember ? (
              <p className="mt-4 text-sm text-muted">
                You&apos;re not in {info.poll.group_name} yet — ask a member for the
                group&apos;s invite link to join.
              </p>
            ) : (
              <>
                {voted && (
                  <p className="mt-4 text-sm font-semibold text-brand-dark">
                    {voted === "yes"
                      ? `You're in! See you at ${info.poll.proposed_time} 🏸`
                      : "Vote saved — you can change it anytime."}
                  </p>
                )}
                <div className="mt-4 flex gap-2">
                  <Button
                    variant={voted && voted !== "yes" ? "ghost" : undefined}
                    className="flex-1 py-2.5"
                    loading={busy}
                    onClick={() => vote("yes")}
                  >
                    I&apos;m in
                  </Button>
                  <Button
                    variant={voted === "maybe" ? undefined : "ghost"}
                    className="flex-1 py-2.5"
                    disabled={busy}
                    onClick={() => vote("maybe")}
                  >
                    Maybe
                  </Button>
                  <Button
                    variant={voted === "no" ? undefined : "ghost"}
                    className="flex-1 py-2.5"
                    disabled={busy}
                    onClick={() => vote("no")}
                  >
                    Can&apos;t
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
