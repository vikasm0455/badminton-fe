"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  isIosNeedingInstall,
  notificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";
import type { MeProfile } from "@/lib/types";
import { Button, Card, Field, PageHeader, Spinner, TextInput, useToast } from "@/components/ui";

const CATEGORIES: { key: string; label: string }[] = [
  { key: "polls", label: "New polls" },
  { key: "votes", label: "Vote updates" },
  { key: "credentials", label: "Court logins" },
  { key: "reservations", label: "Reservations" },
  { key: "timers", label: "Court timers" },
  { key: "account", label: "Account updates" },
];

export default function ProfilePage() {
  const { user, refresh, logout } = useAuth();
  const router = useRouter();
  const { show } = useToast();

  const [name, setName] = useState("");
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [perm, setPerm] = useState<string>("default");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.display_name);
      setPrefs(user.notif_prefs || {});
    }
    setPerm(notificationPermission());
  }, [user]);

  async function saveName() {
    setBusy(true);
    try {
      await api.patch<MeProfile>("/api/auth/me", { display_name: name.trim() });
      await refresh();
      show("Saved", "ok");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Could not save", "err");
    } finally {
      setBusy(false);
    }
  }

  async function togglePref(key: string) {
    const next = { ...prefs, [key]: prefs[key] === false ? true : false };
    setPrefs(next);
    try {
      await api.patch<MeProfile>("/api/auth/me", { notif_prefs: next });
    } catch {
      show("Could not update preference", "err");
    }
  }

  async function enablePush() {
    const res = await subscribeToPush();
    setPerm(notificationPermission());
    if (res.ok) show("Notifications enabled", "ok");
    else if (res.reason === "denied")
      show("Notifications are blocked — enable them in your browser/app settings.", "err");
    else if (res.reason === "unsupported") show("Push isn't supported on this device/browser.", "err");
    else show("Could not enable notifications", "err");
  }

  async function disablePush() {
    await unsubscribeFromPush();
    show("Notifications disabled on this device", "info");
  }

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const iosInstall = typeof window !== "undefined" && isIosNeedingInstall();

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <PageHeader title="Profile" />

      <Card>
        <Field label="Display name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <p className="mt-2 text-xs text-muted">{user.email}</p>
        <Button className="mt-3 w-full" loading={busy} onClick={saveName} disabled={name.trim() === user.display_name}>
          Save name
        </Button>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">Notifications</h2>
        {iosInstall && (
          <p className="mb-3 rounded-lg bg-brand-light px-3 py-2 text-xs text-brand-dark">
            On iPhone, add RallyUp to your Home Screen first (Share → Add to Home Screen), then open
            it from there to enable notifications.
          </p>
        )}
        {perm === "granted" ? (
          <Button variant="secondary" className="w-full" onClick={disablePush}>
            Disable on this device
          </Button>
        ) : (
          <Button className="w-full" onClick={enablePush}>
            Enable notifications
          </Button>
        )}
        {perm === "denied" && (
          <p className="mt-2 text-xs text-pass">
            Notifications are off. Enable them in your browser/app settings.
          </p>
        )}

        <div className="mt-4 flex flex-col gap-1">
          {CATEGORIES.map((c) => (
            <label key={c.key} className="flex items-center justify-between py-2">
              <span className="text-sm">{c.label}</span>
              <input
                type="checkbox"
                className="h-6 w-6"
                checked={prefs[c.key] !== false}
                onChange={() => togglePref(c.key)}
              />
            </label>
          ))}
        </div>
      </Card>

      <Button variant="ghost" className="text-pass" onClick={() => logout().then(() => router.replace("/login"))}>
        Log out
      </Button>

      <Card className="border border-red-100">
        <h2 className="mb-1 font-semibold text-pass">Danger zone</h2>
        <p className="mb-3 text-xs text-muted">
          Deletes your account and personal data (calorie logs, your court logins, notification
          registrations). Group history you took part in stays, anonymized. This cannot be undone.
        </p>
        <Button
          variant="ghost"
          className="w-full text-pass"
          loading={busy}
          onClick={async () => {
            if (!confirm("Delete your account? This cannot be undone.")) return;
            if (!confirm("Last check — your logins and personal data will be permanently deleted. Continue?")) return;
            setBusy(true);
            try {
              await api.del("/api/auth/me");
              router.replace("/");
            } catch (e) {
              show(e instanceof ApiError ? e.message : "Could not delete account", "err");
              setBusy(false);
            }
          }}
        >
          Delete my account
        </Button>
      </Card>
    </div>
  );
}
