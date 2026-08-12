import type { Metadata } from "next";
import "../../courts-stations.css";
import CheckinStation from "./station";

// Server shell: metadata + station CSS only. The station itself is fully
// client-side (always-focused scanner input, auto-reset), see ./station.tsx.
export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  return {
    title: `${params.slug} · Member check-in · BadmintonRallyUp Courts`,
    description:
      "Member check-in station — scan your membership card to get today's court-board login.",
  };
}

export default function CheckinStationPage({ params }: { params: { slug: string } }) {
  return <CheckinStation slug={params.slug} />;
}
