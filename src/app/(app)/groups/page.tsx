"use client";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { AutoPollConfig, GroupBrief, GroupDetail, GroupInviteRow, MyInvite } from "@/lib/types";
import { Badge, Button, Card, EmptyState, Field, PageHeader, Spinner, TextInput, useToast } from "@/components/ui";

/** Groups home: onboarding for fresh accounts, switching between groups, and
 *  (for group admins) invites + member management of the active group. */
export default function GroupsPage() {
  const { user, refresh } = useAuth();
  const { show } = useToast();

  const [groups, setGroups] = useState<GroupBrief[]>([]);
  const [invites, setInvites] = useState<MyInvite[]>([]);
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [pendingInvites, setPendingInvites] = useState<GroupInviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [newName, setNewName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

  const isGroupAdmin = groups.find((g) => g.is_active)?.role === "admin";

  const load = useCallback(async () => {
    const [gs, inv] = await Promise.all([
      api.get<GroupBrief[]>("/api/groups"),
      api.get<MyInvite[]>("/api/invites"),
    ]);
    setGroups(gs);
    setInvites(inv);
    const active = gs.find((g) => g.is_active);
    if (active) {
      const d = await api.get<GroupDetail>("/api/groups/current");
      setDetail(d);
      if (d.my_role === "admin") {
        setPendingInvites(await api.get<GroupInviteRow[]>("/api/groups/invites"));
      } else {
        setPendingInvites([]);
      }
    } else {
      setDetail(null);
      setPendingInvites([]);
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function run(fn: () => Promise<unknown>, okMsg?: string) {
    setBusy(true);
    try {
      await fn();
      await load();
      await refresh(); // active group / role may have changed
      if (okMsg) show(okMsg, "ok");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Something went wrong", "err");
    } finally {
      setBusy(false);
    }
  }

  const createGroup = () =>
    run(async () => {
      await api.post("/api/groups", { name: newName.trim() });
      setNewName("");
      setShowCreate(false);
    }, "Group created");

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // ---- onboarding: no groups yet -------------------------------------------
  if (groups.length === 0) {
    return (
      <div className="flex flex-col gap-4 px-4 py-4">
        <PageHeader title="Welcome to RallyUp 🏸" />
        <p className="-mt-2 text-sm text-muted">
          Play happens in groups. Create one for your crew, or accept an invite below.
        </p>

        {invites.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Your invites</h2>
            {invites.map((inv) => (
              <InviteCard key={inv.id} inv={inv} busy={busy} onAccept={() => run(() => api.post(`/api/invites/${inv.id}/accept`), `Joined ${inv.group_name}!`)} onDecline={() => run(() => api.post(`/api/invites/${inv.id}/decline`))} />
            ))}
          </section>
        )}

        <Card>
          <p className="mb-2 text-sm font-semibold">Start a new group</p>
          <div className="flex flex-col gap-3">
            <Field label="Group name">
              <TextInput value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Bintang Badminton" maxLength={60} />
            </Field>
            <Button loading={busy} disabled={newName.trim().length < 2} onClick={createGroup}>
              Create group
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ---- normal: group switcher + management ----------------------------------
  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <PageHeader title="My groups" />

      <Card className="p-0">
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            disabled={busy}
            onClick={() => (g.is_active ? undefined : run(() => api.put("/api/groups/active", { group_id: g.id }), `Now playing with ${g.name}`))}
            className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3.5 text-left last:border-0 active:bg-gray-50"
          >
            <span className={`h-3 w-3 rounded-full ${g.is_active ? "bg-brand" : "border-2 border-gray-300"}`} />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{g.name}</span>
              <span className="text-xs text-muted">
                {g.member_count} member{g.member_count === 1 ? "" : "s"}
              </span>
            </span>
            <span className="ml-auto flex items-center gap-2">
              {g.role === "admin" && <Badge color="blue">admin</Badge>}
              {g.is_active && <Badge color="green">active</Badge>}
            </span>
          </button>
        ))}
      </Card>

      {!showCreate ? (
        <button type="button" onClick={() => setShowCreate(true)} className="text-sm font-medium text-brand-dark">
          ＋ Create another group
        </button>
      ) : (
        <Card>
          <div className="flex flex-col gap-3">
            <Field label="Group name">
              <TextInput value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Weekend warriors" maxLength={60} />
            </Field>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button className="flex-1" loading={busy} disabled={newName.trim().length < 2} onClick={createGroup}>
                Create
              </Button>
            </div>
          </div>
        </Card>
      )}

      {invites.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Invites for you</h2>
          {invites.map((inv) => (
            <InviteCard key={inv.id} inv={inv} busy={busy} onAccept={() => run(() => api.post(`/api/invites/${inv.id}/accept`), `Joined ${inv.group_name}!`)} onDecline={() => run(() => api.post(`/api/invites/${inv.id}/decline`))} />
          ))}
        </section>
      )}

      {detail && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
            {detail.name} · members
          </h2>
          <Card className="p-0">
            {detail.members.map((m) => (
              <div key={m.id} className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 last:border-0">
                <span className="font-medium">{m.display_name}</span>
                {m.role === "admin" && <Badge color="blue">admin</Badge>}
                {m.id === user?.id && <span className="text-xs text-muted">(you)</span>}
                {isGroupAdmin && m.id !== user?.id && (
                  <span className="ml-auto flex gap-3 text-xs font-medium">
                    <button
                      type="button"
                      className="text-brand-dark"
                      onClick={() => run(() => api.put(`/api/groups/members/${m.id}`, { role: m.role === "admin" ? "member" : "admin" }))}
                    >
                      {m.role === "admin" ? "Demote" : "Make admin"}
                    </button>
                    <button
                      type="button"
                      className="text-pass"
                      onClick={() => confirm(`Remove ${m.display_name} from ${detail.name}?`) && run(() => api.del(`/api/groups/members/${m.id}`), "Member removed")}
                    >
                      Remove
                    </button>
                  </span>
                )}
              </div>
            ))}
          </Card>

          {isGroupAdmin && (
            <Card>
              <p className="mb-2 text-sm font-semibold">Invite by email</p>
              <div className="flex gap-2">
                <TextInput
                  type="email"
                  placeholder="friend@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <Button
                  className="shrink-0 px-4"
                  loading={busy}
                  disabled={!inviteEmail.includes("@")}
                  onClick={() =>
                    run(async () => {
                      // email_delivery: "sent" | "failed" | "skipped" — never
                      // claim "sent" when the invite email didn't go out.
                      const r = await api.post<{ email_delivery: string }>(
                        "/api/groups/invites",
                        { email: inviteEmail.trim() },
                      );
                      setInviteEmail("");
                      if (r.email_delivery === "sent") {
                        show(`Invite sent to ${inviteEmail.trim().toLowerCase()}`, "ok");
                      } else {
                        show(
                          "Invite saved, but the email couldn't be sent — they'll see it in RallyUp when they sign up with this address.",
                          "err",
                        );
                      }
                    })
                  }
                >
                  Invite
                </Button>
              </div>
              {pendingInvites.length > 0 && (
                <div className="mt-3 flex flex-col gap-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Pending</p>
                  {pendingInvites.map((pi) => (
                    <div key={pi.id} className="flex items-center justify-between py-1 text-sm">
                      <span className="truncate">{pi.email}</span>
                      <button
                        type="button"
                        className="text-xs font-medium text-pass"
                        onClick={() => run(() => api.del(`/api/groups/invites/${pi.id}`))}
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {isGroupAdmin && <RenameCard current={detail.name} busy={busy} onSave={(n) => run(() => api.put("/api/groups/current", { name: n }), "Group renamed")} />}

          {isGroupAdmin && <AutoPollCard groupId={detail.id} />}

          {isGroupAdmin && (
            <Button
              variant="ghost"
              className="text-sm"
              onClick={() =>
                confirm(`Remove ALL of today's logins from ${detail.name}? Owners keep them; other groups are unaffected.`) &&
                run(() => api.post("/api/credentials/clear-today"), "Today's logins cleared from this group")
              }
            >
              🧹 Clear today&apos;s logins from this group
            </Button>
          )}

          <Button
            variant="ghost"
            className="text-pass"
            onClick={() =>
              confirm(
                detail.members.length === 1
                  ? `You're the only member — leaving permanently deletes ${detail.name} and all its history. Continue?`
                  : `Leave ${detail.name}?`
              ) && run(() => api.post("/api/groups/leave"), "Left group")
            }
          >
            Leave this group
          </Button>
        </section>
      )}

      {groups.length > 0 && invites.length === 0 && !detail && (
        <Card>
          <EmptyState icon="👥" text="Pick a group above to make it active." />
        </Card>
      )}
    </div>
  );
}

function InviteCard({
  inv,
  busy,
  onAccept,
  onDecline,
}: {
  inv: MyInvite;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <Card>
      <p className="font-semibold">{inv.group_name}</p>
      <p className="text-xs text-muted">
        {inv.invited_by_name} invited you · {inv.member_count} member{inv.member_count === 1 ? "" : "s"}
      </p>
      <div className="mt-3 flex gap-2">
        <Button className="flex-1 py-2 text-sm" loading={busy} onClick={onAccept}>
          Accept
        </Button>
        <Button variant="ghost" className="flex-1 py-2 text-sm" onClick={onDecline}>
          Decline
        </Button>
      </div>
    </Card>
  );
}

/** Per-group auto-poll scheduler (creates the day's poll automatically). */
function AutoPollCard({ groupId }: { groupId: string }) {
  const { show } = useToast();
  const [cfg, setCfg] = useState<AutoPollConfig | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCfg(null);
    api.get<AutoPollConfig>("/api/config/auto-poll").then(setCfg).catch(() => {});
  }, [groupId]);

  async function save(patch: Partial<AutoPollConfig>) {
    setBusy(true);
    try {
      setCfg(await api.put<AutoPollConfig>("/api/config/auto-poll", patch));
      show("Auto-poll updated", "ok");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Could not update", "err");
    } finally {
      setBusy(false);
    }
  }

  if (!cfg) return null;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">⏰ Auto-poll scheduler</p>
          <p className="text-xs text-muted">Creates the day&apos;s poll automatically each morning.</p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => save({ enabled: !cfg.enabled })}
          className={`h-7 w-12 rounded-full p-0.5 transition-colors ${cfg.enabled ? "bg-brand" : "bg-gray-300"}`}
          aria-label="Toggle auto-poll"
        >
          <span className={`block h-6 w-6 rounded-full bg-white transition-transform ${cfg.enabled ? "translate-x-5" : ""}`} />
        </button>
      </div>
      {cfg.enabled && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Poll time">
            <TextInput type="time" value={cfg.time} onChange={(e) => setCfg({ ...cfg, time: e.target.value })} onBlur={() => save({ time: cfg.time })} />
          </Field>
          <Field label="Reminder time">
            <TextInput
              type="time"
              value={cfg.final_reminder_time}
              onChange={(e) => setCfg({ ...cfg, final_reminder_time: e.target.value })}
              onBlur={() => save({ final_reminder_time: cfg.final_reminder_time })}
            />
          </Field>
          <div className="col-span-2">
            <Field label="Poll note (optional)">
              <TextInput maxLength={120} value={cfg.note} onChange={(e) => setCfg({ ...cfg, note: e.target.value })} onBlur={() => save({ note: cfg.note })} placeholder="Usual 6pm session" />
            </Field>
          </div>
        </div>
      )}
    </Card>
  );
}

function RenameCard({ current, busy, onSave }: { current: string; busy: boolean; onSave: (name: string) => void }) {
  const [name, setName] = useState(current);
  useEffect(() => setName(current), [current]);
  return (
    <Card>
      <p className="mb-2 text-sm font-semibold">Group name</p>
      <div className="flex gap-2">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        <Button className="shrink-0 px-4" loading={busy} disabled={name.trim().length < 2 || name.trim() === current} onClick={() => onSave(name.trim())}>
          Save
        </Button>
      </div>
    </Card>
  );
}
