"use client";

import { useActionState } from "react";
import { runYouTubeSync, type YouTubeSyncActionState } from "@/app/admin/teledyski/actions";

const initialState: YouTubeSyncActionState = {};

export function YouTubeSyncPanel({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(runYouTubeSync, initialState);
  return <form action={action} className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
    <h2 className="text-2xl font-black">Synchronizacja YouTube</h2>
    <p className="mt-3 max-w-3xl text-zinc-600">Jedna seria sprawdza maksymalnie 10 artystów. Wewnętrzny limit wyszukiwania wynosi 50 zapytań dziennie, aby zostawić zapas na ręczne działania.</p>
    {!configured && <p className="mt-4 rounded-xl bg-amber-100 p-4 text-sm font-semibold text-amber-950">Brakuje YOUTUBE_API_KEY w konfiguracji serwera.</p>}
    <button disabled={pending || !configured} className="mt-5 rounded-xl bg-zinc-950 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
      {pending ? "Synchronizuję…" : "Sprawdź następną partię"}
    </button>
    {state.message && <p role="status" className={`mt-4 rounded-xl p-4 text-sm font-semibold ${state.success ? "bg-emerald-100 text-emerald-950" : "bg-red-100 text-red-950"}`}>{state.message}</p>}
  </form>;
}
