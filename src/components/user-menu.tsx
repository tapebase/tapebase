"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/login/actions";

function UserIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>;
}

export function UserMenu({ username, role }: { username: string; role: string }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return <div ref={containerRef} className="relative">
    <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-haspopup="menu" aria-label={`Menu użytkownika @${username}`} title={`Profil @${username}`} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-zinc-100">
      <UserIcon />
    </button>
    {open && <div role="menu" className="absolute right-0 top-12 z-50 w-52 rounded-2xl border border-zinc-200 bg-white p-2 text-sm shadow-xl">
      <p className="truncate px-3 py-2 text-xs font-bold text-zinc-500">@{username}</p>
      <Link onClick={() => setOpen(false)} href="/profil" role="menuitem" className="block rounded-xl px-3 py-2.5 font-semibold hover:bg-zinc-100">Twój profil</Link>
      <Link onClick={() => setOpen(false)} href="/listy" role="menuitem" className="block rounded-xl px-3 py-2.5 font-semibold hover:bg-zinc-100">Twoje listy</Link>
      {role === "admin" && <Link onClick={() => setOpen(false)} href="/admin/zgloszenia" role="menuitem" className="block rounded-xl px-3 py-2.5 font-semibold hover:bg-zinc-100">Administracja</Link>}
      <form action={signOut}><button role="menuitem" className="w-full rounded-xl px-3 py-2.5 text-left text-zinc-600 hover:bg-zinc-100">Wyloguj się</button></form>
    </div>}
  </div>;
}
