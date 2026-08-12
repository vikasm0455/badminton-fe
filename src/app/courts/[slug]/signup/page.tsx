import type { Metadata } from "next";
import "../../courts-stations.css";
import SignupStation from "./station";

// Server shell: metadata + station CSS only. The station itself is fully
// client-side (debounced availability, auto-reset), rendered by ./station.tsx.
export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  return {
    title: `${params.slug} · Walk-in signup · BadmintonRallyUp Courts`,
    description:
      "Walk-in signup station — pick a username and get an easy password that works at the court board until midnight.",
  };
}

export default function SignupStationPage({ params }: { params: { slug: string } }) {
  return <SignupStation slug={params.slug} />;
}
