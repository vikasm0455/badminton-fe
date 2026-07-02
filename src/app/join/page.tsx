"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui";

/** Legacy invite-code join page — signup is open now; old links land on /signup. */
export default function JoinPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/signup");
  }, [router]);
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Spinner />
    </div>
  );
}
