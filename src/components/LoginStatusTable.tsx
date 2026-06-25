"use client";
import type { CredentialView } from "@/lib/types";
import { Card, EmptyState, useToast } from "./ui";

/** Compact status table for court logins: who's posted, which are in use
 *  (green ✓ + court) and which are free (red ✗). Free logins show their
 *  password in small text — tap it to copy. */
export default function LoginStatusTable({ creds }: { creds: CredentialView[] }) {
  const { show } = useToast();

  // Free logins first (actionable), then in-use; each alphabetical.
  const sorted = [...creds].sort((a, b) => {
    if (a.in_use !== b.in_use) return a.in_use ? 1 : -1;
    return a.bintang_name.localeCompare(b.bintang_name);
  });

  async function copy(c: CredentialView) {
    try {
      await navigator.clipboard.writeText(c.bintang_password);
      show(`Copied ${c.bintang_name}'s password`, "ok");
    } catch {
      show(c.bintang_password, "info"); // clipboard blocked → at least surface it
    }
  }

  if (creds.length === 0) {
    return (
      <Card>
        <EmptyState icon="🔑" text="No logins posted yet today." />
      </Card>
    );
  }

  const free = creds.filter((c) => !c.in_use).length;

  return (
    <Card className="overflow-hidden p-0">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-muted">
            <th className="px-3 py-2 font-medium">Player</th>
            <th className="px-3 py-2 text-right font-medium">In use</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => (
            <tr key={c.id} className="border-b border-gray-100 last:border-0">
              <td className="px-3 py-2 align-top">
                <div className="font-semibold text-name">{c.bintang_name}</div>
                {!c.in_use && (
                  <button
                    type="button"
                    onClick={() => copy(c)}
                    className="mt-0.5 font-mono text-xs text-pass active:opacity-60"
                    title="Tap to copy password"
                  >
                    🔑 {c.bintang_password}
                  </button>
                )}
              </td>
              <td className="px-3 py-2 text-right align-top">
                {c.in_use ? (
                  <span className="inline-flex items-center gap-1 font-medium text-green-700">
                    <span aria-hidden>✓</span>
                    <span className="text-xs">Court {c.in_use_court ?? "?"}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-medium text-red-600">
                    <span aria-hidden>✗</span>
                    <span className="text-xs">Free</span>
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-gray-100 px-3 py-2 text-xs text-muted">
        {free} of {creds.length} free · tap a password to copy
      </div>
    </Card>
  );
}
