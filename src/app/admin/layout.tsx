"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Spinner } from "@/components/ui";

const TABS = [
  { href: "/admin/members", label: "Members" },
  { href: "/admin/invites", label: "Invites" },
  { href: "/admin/security", label: "Security" },
  { href: "/admin/data", label: "Data" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (!user.is_admin) router.replace("/home");
  }, [user, loading, router]);

  if (loading || !user || !user.is_admin) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-dvh safe-top">
      <header className="sticky top-0 z-30 bg-brand px-4 py-3 text-white safe-top">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">🛡️ Admin</h1>
          <Link href="/home" className="text-sm underline">
            Back to app
          </Link>
        </div>
        <nav className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          {TABS.map((t) => {
            const active = pathname.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`whitespace-nowrap rounded-full px-3 py-1 text-sm ${
                  active ? "bg-white text-brand-dark font-semibold" : "bg-white/20"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <div className="pb-10">{children}</div>
    </div>
  );
}
