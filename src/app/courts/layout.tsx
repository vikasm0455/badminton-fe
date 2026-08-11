import type { Metadata, Viewport } from "next";
import "./courts.css";

// Desktop-only shell for the Courts product (kiosk + club admin). No PWA
// chrome: no manifest, no viewport clamps — desktop scrolling/zoom allowed.
export const metadata: Metadata = {
  title: "BadmintonRallyUp Courts",
  description: "Live court board, queues, and club administration for partner clubs.",
  manifest: null,
  appleWebApp: null,
};

export const viewport: Viewport = {
  themeColor: "#b06f3c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function CourtsLayout({ children }: { children: React.ReactNode }) {
  return <div data-courts-root>{children}</div>;
}
