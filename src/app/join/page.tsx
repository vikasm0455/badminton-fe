"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import type { VerificationPending } from "@/lib/types";
import { Button, Card, Field, Spinner, TextInput, useToast } from "@/components/ui";

type Step = "checking" | "invalid" | "details" | "otp" | "done";

function JoinInner() {
  const router = useRouter();
  const params = useSearchParams();
  const code = params.get("code") || "";
  const { show } = useToast();

  const [step, setStep] = useState<Step>("checking");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      if (!code) {
        setStep("invalid");
        return;
      }
      try {
        await api.post("/api/auth/validate-invite", { code });
        setStep("details");
      } catch {
        setStep("invalid");
      }
    })();
  }, [code]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  async function submitDetails(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api.post<VerificationPending>("/api/auth/signup", {
        code,
        display_name: displayName.trim(),
        email: email.trim(),
      });
      setResendIn(res.resend_after_secs || 0);
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

  async function resend() {
    setBusy(true);
    try {
      const res = await api.post<VerificationPending>("/api/auth/signup", {
        code,
        display_name: displayName.trim(),
        email: email.trim(),
      });
      setResendIn(res.resend_after_secs || 60);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not resend.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.post("/api/auth/signup/verify", { email: email.trim(), code: otp.trim() });
      setStep("done");
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
        <h1 className="text-2xl font-bold text-brand-dark">Join RallyUp</h1>
      </div>

      {step === "checking" && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}

      {step === "invalid" && (
        <Card>
          <p className="text-sm text-ink">
            This invite link is invalid or has expired. Ask the admin for a new one.
          </p>
          <Link href="/login" className="mt-3 block text-sm text-brand-dark">
            Already have an account? Log in
          </Link>
        </Card>
      )}

      {step === "details" && (
        <Card>
          <form onSubmit={submitDetails} className="flex flex-col gap-4">
            <Field label="Display name" hint="2–30 letters, numbers or spaces.">
              <TextInput
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Sharan"
                required
              />
            </Field>
            <Field label="Email" hint="We'll send a 6-digit code to verify.">
              <TextInput
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </Field>
            {error && <p className="text-sm text-pass">{error}</p>}
            <Button type="submit" loading={busy}>
              Continue
            </Button>
          </form>
        </Card>
      )}

      {step === "otp" && (
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
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                required
              />
            </Field>
            {error && <p className="text-sm text-pass">{error}</p>}
            <Button type="submit" loading={busy} disabled={otp.length < 6}>
              Verify
            </Button>
            <button
              type="button"
              className="text-sm text-brand-dark disabled:text-muted"
              disabled={resendIn > 0 || busy}
              onClick={resend}
            >
              {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
            </button>
          </form>
        </Card>
      )}

      {step === "done" && (
        <Card className="text-center">
          <span className="text-4xl">✅</span>
          <h2 className="mt-2 text-lg font-bold">Request sent!</h2>
          <p className="mt-1 text-sm text-muted">
            Your account is awaiting admin approval. You&apos;ll get an email once you&apos;re in.
          </p>
          <Link href="/login" className="mt-4 inline-block text-sm font-medium text-brand-dark">
            Go to login
          </Link>
        </Card>
      )}
    </main>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center"><Spinner /></div>}>
      <JoinInner />
    </Suspense>
  );
}
