"use client";

import { useActionState, useState } from "react";
import { submitArtistBiography, type BiographyActionState } from "@/app/artist/[slug]/actions";

const initialState: BiographyActionState = {};

export function ArtistBiographyForm({ artistId, hasBiography }: { artistId: number; hasBiography: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(submitArtistBiography.bind(null, artistId), initialState);
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="mt-6 rounded-xl bg-zinc-950 px-5 py-3 text-sm font-bold text-white hover:bg-zinc-800">
    Dodaj biografię
  </button>;

  return <form action={action} className="mt-6 rounded-2xl border border-zinc-200 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <h2 className="text-xl font-black">{hasBiography ? "Zaproponuj nową biografię" : "Dodaj biografię"}</h2>
      <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-1 text-sm font-bold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">Zamknij</button>
    </div>
    <p className="mt-2 text-sm text-zinc-500">Napisz własny, rzeczowy opis artysty. Po akceptacji administratora pod biografią pojawi się Twój nick.</p>
    <label className="mt-4 block text-sm font-bold">Treść biografii
      <textarea name="biography" minLength={80} maxLength={5000} required rows={7} disabled={state.success}
        className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 font-normal disabled:bg-zinc-100"
        placeholder="Opisz twórczość, najważniejsze etapy kariery i dorobek artysty…" />
    </label>
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <button disabled={pending || state.success} className="rounded-xl bg-zinc-950 px-5 py-3 font-bold text-white disabled:opacity-60">
        {pending ? "Wysyłanie…" : state.success ? "Wysłano" : "Wyślij do akceptacji"}
      </button>
      <span className="text-xs text-zinc-500">80–5000 znaków · maksymalnie 5 nowych zgłoszeń na dobę</span>
    </div>
    {state.message && <p aria-live="polite" className={`mt-3 text-sm ${state.success ? "text-emerald-700" : "text-red-700"}`}>{state.message}</p>}
  </form>;
}
