import type { Metadata } from "next";
import KioskBoard from "./board";

// Server shell: metadata only. The board itself is fully client-side (SSE +
// local countdowns), rendered by ./board.tsx.
export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  return {
    title: `${params.slug} · BadmintonRallyUp Courts`,
    description:
      "Live court board — see availability, take a court, join a pair, or queue for the next open session.",
  };
}

export default function KioskPage({ params }: { params: { slug: string } }) {
  return <KioskBoard slug={params.slug} />;
}
