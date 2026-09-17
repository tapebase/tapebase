"use client";

import { useActionState } from "react";
import { exportUserListToSpotify } from "@/app/actions/spotify-playlists";

export function SpotifyPlaylistExport({ listId, connected, playlistUrl, callbackStatus }: {
  listId: number; connected: boolean; playlistUrl: string | null; callbackStatus?: string;
}) {
  const [state, action, pending] = useActionState(exportUserListToSpotify.bind(null, listId), {});
  const url = state.url ?? playlistUrl;
  return <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
    <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Spotify beta</p>
    <h2 className="mt-1 text-2xl font-black">Eksport playlisty</h2>
    {callbackStatus === "connected" && <p className="mt-3 font-semibold text-emerald-700">Konto Spotify zostało połączone.</p>}
    {callbackStatus === "denied" && <p className="mt-3 font-semibold text-amber-800">Nie udzielono dostępu do Spotify.</p>}
    {callbackStatus === "error" && <p className="mt-3 font-semibold text-red-700">Nie udało się połączyć konta Spotify. Sprawdź konfigurację i spróbuj ponownie.</p>}
    {url ? <div className="mt-4">
      <p className="text-sm text-zinc-600">Kopia tej playlisty znajduje się już na Twoim koncie Spotify.</p>
      <a href={url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex rounded-xl bg-[#1DB954] px-5 py-3 font-bold text-black">Otwórz w Spotify</a>
    </div> : connected ? <form action={action} className="mt-4">
      <p className="text-sm text-zinc-600">TAPEBASE utworzy nową playlistę i doda utwory w widocznej kolejności.</p>
      <button disabled={pending} className="mt-3 rounded-xl bg-[#1DB954] px-5 py-3 font-bold text-black disabled:opacity-60">{pending ? "Eksportowanie…" : "Utwórz w Spotify"}</button>
    </form> : <div className="mt-4">
      <p className="text-sm text-zinc-600">Połącz konto, aby TAPEBASE mogło utworzyć na nim playlistę. Dostęp można później odłączyć.</p>
      <a href={`/api/spotify/connect?listId=${listId}`} className="mt-3 inline-flex rounded-xl bg-[#1DB954] px-5 py-3 font-bold text-black">Połącz ze Spotify</a>
    </div>}
    {state.message && <p aria-live="polite" className={`mt-3 text-sm font-semibold ${state.success ? "text-emerald-700" : "text-red-700"}`}>{state.message}</p>}
  </section>;
}
