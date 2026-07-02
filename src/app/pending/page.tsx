"use client";
// LEGACY-SINGLE-TENANT: the pending-approval state no longer exists under open
// signup (accounts are active immediately; groups gate access). Delete this page
// and the /pending redirects in login + layouts with the backend approve/reject.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Button, Card, Spinner } from "@/components/ui";

export default function PendingPage() {
  const { user, loading, refresh, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (user.status === "active") {
      router.replace("/home");
    }
  }, [user, loading, router]);

  // Poll for approval every 60s (PRD §11).
  useEffect(() => {
    const id = setInterval(() => refresh(), 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  if (loading || !user || user.status === "active") {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center safe-top safe-bottom">
      <span className="text-5xl">⏳</span>
      <h1 className="text-2xl font-bold text-brand-dark">Request under review</h1>
      <Card>
        <p className="text-sm text-ink">
          Thanks, {user.display_name}! An admin is reviewing your request to join. This page updates
          automatically — you&apos;ll also get an email once you&apos;re approved.
        </p>
      </Card>
      <Button variant="ghost" onClick={() => logout().then(() => router.replace("/login"))}>
        Log out
      </Button>
    </main>
  );
}
