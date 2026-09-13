"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { markNotificationsRead } from "@/app/actions/notifications";

export function NotificationsReadReceipt() {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void markNotificationsRead().then(() => router.refresh());
  }, [router]);

  return null;
}
