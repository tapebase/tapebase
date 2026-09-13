"use client";

import { useActionState } from "react";
import { runConcertSync, type ConcertSyncActionState } from "@/app/admin/koncerty/actions";

const initialState: ConcertSyncActionState = {};

export function ConcertSyncPanel({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(runConcertSync, initialState);
  return <form action={action} className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
    <h2 className="text-2xl font-black">Synchronizacja Ticketmaster</h2>
    <p className="mt-3 max-w-3xl text-zinc-600">Jedno uruchomienie sprawdza kolejnych 20 artystów z katalogu. Postęp jest zapisany w bazie, więc możesz wrócić później bez rozpoczynania od początku.</p>
    {!configured && <p className="mt-4 rounded-xl bg-amber-100 p-4 text-sm font-semibold text-amber-950">Brakuje TICKETMASTER_API_KEY w konfiguracji serwera.</p>}
    <button disabled={pending || !configured} className="mt-5 rounded-xl bg-zinc-950 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
      {pending ? "Synchronizuję…" : "Sprawdź następną partię"}
    </button>
    {state.message && <p role="status" className={`mt-4 rounded-xl p-4 text-sm font-semibold ${state.success ? "bg-emerald-100 text-emerald-950" : "bg-red-100 text-red-950"}`}>{state.message}</p>}
  </form>;
}
