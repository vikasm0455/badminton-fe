"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";

const ITEMS = [
  { href: "/profile", label: "Profile & notifications", icon: "👤" },
  { href: "/history", label: "History", icon: "📅" },
  { href: "/kcal", label: "Calories", icon: "🔥" },
];

export default function MorePage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <PageHeader title="More" />
      <Card className="p-0">
        {ITEMS.map((it) => (
          <Link key={it.href} href={it.href} className="flex items-center gap-3 border-b border-gray-100 px-4 py-4 last:border-0">
            <span className="text-xl">{it.icon}</span>
            <span className="font-medium">{it.label}</span>
            <span className="ml-auto text-muted">›</span>
          </Link>
        ))}
        {user?.is_admin && (
          <Link href="/admin/members" className="flex items-center gap-3 border-t border-gray-100 px-4 py-4">
            <span className="text-xl">🛡️</span>
            <span className="font-medium">Admin panel</span>
            <span className="ml-auto text-muted">›</span>
          </Link>
        )}
      </Card>

      <button
        className="rounded-xl bg-white py-3 text-center font-semibold text-pass shadow-sm ring-1 ring-black/5"
        onClick={() => logout().then(() => router.replace("/login"))}
      >
        Log out
      </button>

      <p className="text-center text-xs text-muted">Signed in as {user?.email}</p>
    </div>
  );
}
