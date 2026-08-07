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
            {/* Store routing: with the app installed this link opens RallyUp
                directly (Universal Links); this badge covers everyone else. */}
            <a
              href="https://apps.apple.com/app/id6790264978"
              className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-black px-4 py-2.5 text-white"
            >
              {/* Apple logo — inline SVG (the  glyph only renders on Apple platforms) */}
              <svg viewBox="0 0 814 1000" className="h-5 w-5 fill-white" aria-hidden="true">
                <path d="M788 341c-6 4-108 62-108 189 0 147 129 199 133 200-1 3-21 71-68 141-42 61-86 123-153 123s-84-39-161-39c-75 0-102 40-163 40s-104-57-153-127C58 787 12 664 12 547c0-187 122-286 242-286 64 0 117 42 157 42 38 0 97-45 169-45 27 0 125 3 208 83zM554 172c30-36 52-86 52-136 0-7-1-14-2-19-49 2-108 33-143 74-28 32-54 82-54 132 0 8 1 15 2 18 3 1 8 1 13 1 44 0 100-29 132-70z" />
              </svg>
              <span className="text-left leading-tight">
                <span className="block text-[9px] text-gray-300">Download on the</span>
                <span className="block text-sm font-semibold">App Store</span>
              </span>
            </a>
          </>
        )}
      </Card>
    </div>
  );
}
