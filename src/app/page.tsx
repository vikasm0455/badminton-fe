"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { isIosNeedingInstall } from "@/lib/push";
import { Button, Card, Spinner } from "@/components/ui";
import Landing from "./(marketing)/Landing";

/** True when running as an installed PWA (home-screen app), not a browser tab.
 *  Mirrors the standalone-detection pattern used in lib/push.ts. */
function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  const displayModeStandalone =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone =
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return displayModeStandalone || iosStandalone;
}

export default function SplashPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace(user.status === "active" ? "/home" : "/pending");
    }
  }, [user, loading, router]);

  if (loading || user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // Signed-out visitors in a normal browser see the marketing landing.
  // Installed PWA (home-screen app) users keep the app splash so their
  // icon opens straight to login, not to marketing.
  if (!isStandalonePwa()) {
    return <Landing />;
  }

  const iosInstall = typeof window !== "undefined" && isIosNeedingInstall();

  return (
    <main className="flex min-h-dvh flex-col justify-center gap-6 px-6 py-10 safe-top safe-bottom">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-brand text-4xl">
          🏸
        </div>
        <h1 className="text-3xl font-extrabold text-brand-dark">RallyUp</h1>
        <p className="mt-1 text-muted">Bintang Badminton group coordination</p>
      </div>

      <Card>
        <p className="text-sm text-ink">
          Vote on today&apos;s game, share court logins, track live court timers, and log your
          calories — all in one place.
        </p>
      </Card>

      {iosInstall && (
        <Card className="bg-brand-light">
          <p className="mb-2 text-sm font-semibold text-brand-dark">
            Get court timer alerts on your iPhone
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink">
            <li>
              Tap the Share button <span className="font-mono">(□↑)</span> in Safari
            </li>
            <li>Tap &quot;Add to Home Screen&quot;</li>
            <li>Open RallyUp from your Home Screen and allow notifications</li>
          </ol>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        <Link href="/login">
          <Button className="w-full">Log in</Button>
        </Link>
        <p className="text-center text-xs text-muted">
          New here? Open the invite link the admin shared with you.
        </p>
      </div>
    </main>
  );
}
