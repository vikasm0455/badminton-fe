"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Card, Spinner, useToast } from "@/components/ui";

type JoinInfo = {
  group_name: string;
  member_count: number;
  invited_by_name: string;
};

/** Shareable invite-link landing page: shows the group, then joins (signed in)
 *  or routes through signup/login with returnTo back here. */
export default function JoinByLinkPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { user, loading, refresh } = useAuth();
  const { show } = useToast();

  const [info, setInfo] = useState<JoinInfo | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<JoinInfo>(`/api/join/${token}`)
      .then(setInfo)
      .catch(() => setMissing(true));
  }, [token]);

  const join = useCallback(async () => {
    setBusy(true);
    try {
      const r = await api.post<{ newly_joined: boolean; group_name: string }>(
        `/api/join/${token}`,
        undefined,
      );
      await refresh();
      show(
        r.newly_joined
          ? `Welcome to ${r.group_name}!`
          : `You're already a member of ${r.group_name}.`,
        "ok",
      );
      router.replace("/home");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Could not join the group.", "err");
      setBusy(false);
    }
  }, [token, refresh, router, show]);

  const returnTo = encodeURIComponent(`/join/${token}`);

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <Card className="w-full max-w-sm text-center">
        {missing ? (
          <>
            <div className="text-3xl">🏸</div>
            <h1 className="mt-2 text-lg font-bold">This invite link isn&apos;t active</h1>
            <p className="mt-2 text-sm text-muted">
              It may have expired or been replaced. Ask the group admin to share a fresh
              link from Group settings.
            </p>
          </>
        ) : !info ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <>
            <div className="text-3xl">🏸</div>
            <h1 className="mt-2 text-lg font-bold">
              Join {info.group_name} on RallyUp?
            </h1>
            <p className="mt-2 text-sm text-muted">
              {info.invited_by_name} invited you · {info.member_count} member
              {info.member_count === 1 ? "" : "s"}
              <br />
              Tonight&apos;s polls, live court timers, and shared logins for your
              badminton crew.
            </p>
            {loading ? (
              <div className="mt-4 flex justify-center">
                <Spinner />
              </div>
            ) : user ? (
              <Button className="mt-4 w-full py-2.5" loading={busy} onClick={join}>
                Join this group
              </Button>
            ) : (
              <div className="mt-4 flex flex-col gap-2">
                <Link href={`/signup?returnTo=${returnTo}`}>
                  <Button className="w-full py-2.5">Sign up to join</Button>
                </Link>
                <Link
                  href={`/login?returnTo=${returnTo}`}
                  className="text-sm font-medium text-muted underline-offset-2 hover:underline"
                >
                  I already have an account
                </Link>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
