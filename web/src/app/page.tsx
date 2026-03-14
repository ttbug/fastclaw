"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getStatus } from "@/lib/api";

export default function RootRedirect() {
  const router = useRouter();

  useEffect(() => {
    getStatus()
      .then((status) => {
        if (status.configured) {
          router.replace("/overview/");
        } else {
          router.replace("/onboard/");
        }
      })
      .catch(() => {
        router.replace("/onboard/");
      });
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-violet-500" />
    </div>
  );
}
