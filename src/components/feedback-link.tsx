"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function FeedbackLink() {
  const pathname = usePathname();
  return <Link href={`/feedback?from=${encodeURIComponent(pathname)}`}>Zgłoś błąd / pomysł</Link>;
}
