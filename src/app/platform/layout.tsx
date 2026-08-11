import type { Metadata, Viewport } from "next";
import "../courts/courts.css";

// Desktop-only shell for the platform-owner console. Shares the Courts design
// system; no PWA chrome (no manifest, no viewport clamps).
export const metadata: Metadata = {
  title: "BadmintonRallyUp Courts",
  description: "Platform console — onboard and manage partner clubs.",
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

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return <div data-courts-root>{children}</div>;
}
