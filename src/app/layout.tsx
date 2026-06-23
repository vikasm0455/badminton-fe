import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/ui";
import AppBootstrap from "@/components/AppBootstrap";

export const metadata: Metadata = {
  title: "RallyUp",
  description: "Coordinate daily badminton sessions at Bintang Badminton.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "RallyUp" },
  icons: { apple: "/apple-touch-icon.png", icon: "/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#2E7D32",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <ToastProvider>
          <AuthProvider>
            <AppBootstrap />
            <div className="mx-auto min-h-dvh max-w-md">{children}</div>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
