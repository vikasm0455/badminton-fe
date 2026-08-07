import type { Metadata } from "next";

// Server-rendered so chat-app previews show the real group ("Join City
// Smashers on RallyUp · 6 members"). Capability URLs — never indexed.

const API_BASE =
  process.env.API_PROXY ??
  (process.env.NODE_ENV === "development"
    ? "http://localhost:8090"
    : "https://badmintonrallyup.com");

export async function generateMetadata({
  params,
}: {
  params: { token: string };
}): Promise<Metadata> {
  const robots = { index: false, follow: false };
  // iOS Safari renders the native "RallyUp — GET/OPEN" smart banner from
  // this; app-argument makes OPEN hand this exact link to the app.
  const itunes = {
    appId: "6790264978",
    appArgument: `https://badmintonrallyup.com/join/${params.token}`,
  };
  // Tokens are 32 hex chars — anything else never hits the API, so a crafted
  // "token" can't steer the server-side fetch to another path.
  if (!/^[0-9a-f]{32}$/i.test(params.token)) {
    return { title: "Join a group — RallyUp", robots, itunes };
  }
  try {
    const res = await fetch(`${API_BASE}/api/join/${params.token}`, { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      const info = json?.data as
        | { group_name: string; member_count: number; invited_by_name: string }
        | undefined;
      if (info) {
        const title = `Join ${info.group_name} on RallyUp`;
        const description = `${info.invited_by_name} invited you · ${info.member_count} member${info.member_count === 1 ? "" : "s"} · polls, court timers & shared logins`;
        return { title, description, robots, itunes, openGraph: { title, description, siteName: "RallyUp" } };
      }
    }
  } catch {
    /* fall through to the generic preview */
  }
  return { title: "Join a group — RallyUp", robots, itunes };
}

export default function JoinTokenLayout({ children }: { children: React.ReactNode }) {
  return children;
}
