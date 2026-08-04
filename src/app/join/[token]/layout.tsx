import type { Metadata } from "next";

// Invite links are capability URLs — keep them out of search indexes.
export const metadata: Metadata = {
  title: "Join a group — RallyUp",
  robots: { index: false, follow: false },
};

export default function JoinTokenLayout({ children }: { children: React.ReactNode }) {
  return children;
}
