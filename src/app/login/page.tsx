"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { LoginResult, VerificationPending } from "@/lib/types";
import { Button, Card, Field, Spinner, TextInput, useToast } from "@/components/ui";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params.get("returnTo");
  const { refresh } = useAuth();
  const { show } = useToast();

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<VerificationPending | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api.post<VerificationPending>("/api/auth/login", { email: email.trim() });
      setPending(res);
      setResendIn(Math.max(res.resend_after_secs, 0) || 0);
      setStep("otp");
      if (res.delivery === "server-log") {
        show("Dev mode: check the server console for your code.", "info");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api.post<LoginResult>("/api/auth/login/verify", {
        email: email.trim(),
        code: code.trim(),
      });
      await refresh();
      if (res.status === "active") {
        router.replace(returnTo && returnTo.startsWith("/") ? returnTo : "/home");
      } else {
        router.replace("/pending");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center gap-5 px-6 py-10 safe-top safe-bottom">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-brand text-3xl">
          🏸
        </div>
        <h1 className="text-2xl font-bold text-brand-dark">Welcome back</h1>
      </div>

      {step === "email" ? (
        <Card>
          <form onSubmit={sendCode} className="flex flex-col gap-4">
            <Field label="Email" hint="We'll send you a 6-digit code.">
              <TextInput
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            {error && <p className="text-sm text-pass">{error}</p>}
            <Button type="submit" loading={busy}>
              Send code
            </Button>
          </form>
        </Card>
      ) : (
        <Card>
          <form onSubmit={verify} className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              Enter the code sent to <span className="font-medium text-ink">{email}</span>.
            </p>
            <Field label="6-digit code">
              <TextInput
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="••••••"
                className="text-center text-2xl tracking-[0.5em]"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
              />
            </Field>
            {error && <p className="text-sm text-pass">{error}</p>}
            <Button type="submit" loading={busy} disabled={code.length < 6}>
              Verify &amp; log in
            </Button>
            <button
              type="button"
              className="text-sm text-brand-dark disabled:text-muted"
              disabled={resendIn > 0 || busy}
              onClick={() => sendCode()}
            >
              {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
            </button>
          </form>
        </Card>
      )}

      <Link href="/" className="text-center text-sm text-muted">
        ← Back
      </Link>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center"><Spinner /></div>}>
      <LoginInner />
    </Suspense>
  );
}
