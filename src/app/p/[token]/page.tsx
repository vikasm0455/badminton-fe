import type { Metadata } from "next";
import PollShareClient, { type ShareInfo } from "./PollShareClient";

// Server-rendered so WhatsApp/iMessage previews show the LIVE poll (they fetch
// the page without running JS). Never indexed — these are capability URLs.

const API_BASE =
  process.env.API_PROXY ??
  (process.env.NODE_ENV === "development"
    ? "http://localhost:8090"
    : "https://badmintonrallyup.com");

async function fetchInfo(token: string): Promise<ShareInfo | null> {
  // Tokens are 32 hex chars — anything else never hits the API, so a crafted
  // "token" can't steer the server-side fetch to another path.
  if (!/^[0-9a-f]{32}$/i.test(token)) return null;
  try {
    const res = await fetch(`${API_BASE}/api/poll-share/${token}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.data as ShareInfo) ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { token: string };
}): Promise<Metadata> {
  const { token } = params;
  const info = await fetchInfo(token);
  const robots = { index: false, follow: false };
  // iOS Safari renders the native "RallyUp — GET/OPEN" smart banner from
  // this; app-argument makes OPEN hand this exact link to the app.
  const itunes = {
    appId: "6790264978",
    appArgument: `https://badmintonrallyup.com/p/${token}`,
  };
  if (!info || info.ended || !info.poll) {
    return { title: "Tonight's poll — RallyUp", robots, itunes };
  }
  const p = info.poll;
  const title = `Playing tonight at ${p.proposed_time}? — ${p.group_name}`;
  const description = `${p.yes} in so far · tap to vote on RallyUp`;
  return {
    title,
    description,
    robots,
    itunes,
    openGraph: { title, description, siteName: "RallyUp" },
  };
}

export default async function PollSharePage({
  params,
}: {
  params: { token: string };
}) {
  const { token } = params;
  const info = await fetchInfo(token);
  return <PollShareClient token={token} initial={info} />;
}
