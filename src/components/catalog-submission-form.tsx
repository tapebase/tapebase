"use client";

import { useActionState } from "react";
import { submitSpotifyLink, type SubmissionActionState } from "@/app/zglos/actions";
import { MUSIC_GENRES } from "@/lib/genres";

const initialState: SubmissionActionState = {};

export function CatalogSubmissionForm() {
  const [state, action, pending] = useActionState(submitSpotifyLink, initialState);
  return <form action={action} className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
    <h1 className="text-3xl font-black">Zgłoś do katalogu</h1>
    <p className="mt-3 max-w-2xl text-zinc-600">Wklej link Spotify do albumu albo artysty. Sprawdzimy duplikaty i dodamy pozycję do kolejki administratorów.</p>
    <label className="mt-6 block text-sm font-bold">Link Spotify
      <input name="spotifyUrl" type="url" required placeholder="https://open.spotify.com/album/…" className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 font-normal" />
    </label>
    <label className="mt-4 block text-sm font-bold">Pochodzenie artysty
      <select name="country" defaultValue="PL" required className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 font-normal">
        <option value="PL">Polska</option>
        <option value="INT">Zagranica</option>
      </select>
      <span className="mt-2 block text-xs font-normal text-zinc-500">Dla albumu wybierz pochodzenie jego głównego wykonawcy. Administrator może poprawić wybór.</span>
    </label>
    <label className="mt-4 block text-sm font-bold">Główny gatunek
      <select name="genre" defaultValue="rap" required className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 font-normal">
        {MUSIC_GENRES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
      <span className="mt-2 block text-xs font-normal text-zinc-500">Dla artysty gatunek zostanie użyty jako propozycja dla jego albumów. Administrator może go poprawić.</span>
    </label>
    <button disabled={pending} className="mt-4 rounded-xl bg-zinc-950 px-5 py-3 font-bold text-white disabled:opacity-60">{pending ? "Sprawdzanie…" : "Wyślij zgłoszenie"}</button>
    {state.message && <p aria-live="polite" className={`mt-4 text-sm ${state.success ? "text-emerald-700" : "text-red-700"}`}>{state.message}</p>}
    <p className="mt-3 text-xs text-zinc-500">Możesz zgłosić do 10 nowych pozycji w ciągu 24 godzin. Ponowne zgłoszenie tej samej pozycji zwiększa jej priorytet.</p>
  </form>;
}
