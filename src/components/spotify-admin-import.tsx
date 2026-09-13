"use client";

import Image from "next/image";
import { useActionState } from "react";
import { importSpotifyArtists, previewSpotifyArtists, type ImportPreviewState } from "@/app/admin/import/actions";
import { MUSIC_GENRES, genreLabel } from "@/lib/genres";

const initialState: ImportPreviewState = {};

function HiddenInput({ name, value }: { name: string; value: string | number }) {
  return <input type="hidden" name={name} value={value} />;
}

export function SpotifyAdminImport({ initialArtists = "" }: { initialArtists?: string }) {
  const [state, previewAction, previewPending] = useActionState(previewSpotifyArtists, initialState);
  const [importState, importAction, importPending] = useActionState(importSpotifyArtists, initialState);
  const ready = state.previews?.filter(item => !item.error && item.albums.length > 0) ?? [];
  const defaultCountryCode = state.input?.countryCode ?? "PL";

  return <div className="mt-6 space-y-6">
    <form action={previewAction} className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-2xl font-black">Nowa kolejka importu</h2>
      <p className="mt-2 max-w-3xl text-sm text-zinc-600">Wklej od 1 do 20 profili artystów. Lekki podgląd pobierze listę albumów; kompletne tracklisty zostaną pobrane dopiero dla zaznaczonych pozycji podczas importu.</p>
      <label className="mt-6 block text-sm font-bold">Linki lub ID artystów ze Spotify
        <textarea name="artists" rows={6} required defaultValue={initialArtists} placeholder={"Jeden link w każdym wierszu\nhttps://open.spotify.com/artist/…"} className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 font-normal" />
      </label>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold">Rynek
          <input name="market" defaultValue="PL" maxLength={2} required className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 font-normal uppercase" />
        </label>
        <label className="text-sm font-bold">Maksymalnie albumów na artystę
          <input name="maxAlbums" type="number" min={1} max={100} defaultValue={100} required className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 font-normal" />
        </label>
      </div>
      <label className="mt-4 block max-w-md text-sm font-bold">Domyślne pochodzenie artystów
        <select name="countryCode" defaultValue="PL" className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 font-normal">
          <option value="PL">Polska</option><option value="ZZ">Zagranica</option>
        </select>
      </label>
      <p className="mt-2 text-xs text-zinc-500">W kolejnym kroku możesz zmienić pochodzenie osobno dla każdego artysty.</p>
      <label className="mt-4 block max-w-md text-sm font-bold">Domyślny gatunek
        <select name="genre" defaultValue="rap" className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 font-normal">
          {MUSIC_GENRES.map(genre => <option key={genre.value} value={genre.value}>{genre.label}</option>)}
        </select>
      </label>
      <label className="mt-4 block text-sm font-bold">Potwierdzone EP z całej kolejki (opcjonalnie)
        <textarea name="epIds" rows={3} placeholder="Linki lub ID albumów oddzielone przecinkiem albo nowym wierszem" className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 font-normal" />
      </label>
      <p className="mt-2 text-xs text-zinc-500">Panel sam przypisze EP do właściwego artysty. Spotify oznacza EP jako „single”, więc wskazane ID musi występować w jednej z podanych dyskografii.</p>
      <button disabled={previewPending} className="mt-6 rounded-xl bg-zinc-950 px-5 py-3 font-bold text-white disabled:opacity-60">{previewPending ? "Pobieranie kolejki…" : "Pobierz podgląd kolejki"}</button>
      {state.message && <p aria-live="polite" className={`mt-4 text-sm ${state.success ? "text-emerald-700" : "text-red-700"}`}>{state.message}</p>}
    </form>

    {state.previews && state.input && state.previewToken && <form action={importAction} className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Krok 2</p><h2 className="mt-1 text-2xl font-black">Wybierz zakres importu</h2></div>
        <p className="text-sm text-zinc-500">{ready.length} z {state.previews.length} artystów gotowych</p>
      </div>
      <HiddenInput name="previewToken" value={state.previewToken} />
      <div className="mt-6 space-y-5">
        {state.previews.map(item => <section key={item.artistId} className="rounded-2xl border border-zinc-200 p-4 sm:p-5">
          <div className="flex items-center gap-4">
            {item.artistImage ? <Image src={item.artistImage} alt="" width={64} height={64} unoptimized className="h-16 w-16 rounded-full object-cover" /> : <div className="h-16 w-16 rounded-full bg-zinc-100" />}
            <div className="min-w-0 flex-1">
              <label className="flex items-center gap-3 font-black">
                {!item.error && item.albums.length > 0 && <input type="checkbox" name="selectedArtists" value={item.artistId} defaultChecked className="h-5 w-5" />}
                <span className="truncate">{item.artistName}</span>
              </label>
              {item.error
                ? <p className="mt-1 text-sm text-red-700">{item.error}</p>
                : <p className="mt-1 text-sm text-zinc-500">{item.albums.length} albumów · {item.tracksPrepared} utworów według Spotify · {item.excludedCount} pominiętych wydań{item.albumsRemaining ? ` · ${item.albumsRemaining} poza limitem` : ""}</p>}
            </div>
          </div>
          {!item.error && item.albums.length > 0 && <label className="mt-4 block max-w-xs text-sm font-bold">Pochodzenie artysty
            <select name={`countryCode-${item.artistId}`} defaultValue={defaultCountryCode} className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 font-normal">
              <option value="PL">Polska</option><option value="ZZ">Zagranica</option>
            </select>
          </label>}
          {!item.error && item.albums.length > 0 && <label className="mt-4 block max-w-xs text-sm font-bold">Gatunek albumów
            <select name={`genre-${item.artistId}`} defaultValue={item.suggestedGenre} className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 font-normal">
              {MUSIC_GENRES.map(genre => <option key={genre.value} value={genre.value}>{genre.label}</option>)}
            </select>
            <span className="mt-1 block text-xs font-normal text-zinc-500">{item.spotifyGenres.length ? `Sugestia: ${genreLabel(item.suggestedGenre)}. Spotify: ${item.spotifyGenres.join(", ")}.` : "Spotify nie podało gatunków; użyto wyboru domyślnego."}</span>
          </label>}
          {!item.error && item.albums.length > 0 && <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {item.albums.map(album => <li key={album.spotifyId}>
              <label className="flex h-full items-start gap-3 rounded-xl bg-zinc-50 p-3 text-sm">
                <input type="checkbox" name="selectedAlbums" value={`${item.artistId}:${album.spotifyId}`} defaultChecked className="mt-0.5 h-4 w-4 shrink-0" />
                <span><strong className="block">{album.title}</strong><span className="text-xs text-zinc-500">{album.type === "ep" ? "EP" : "Album"} · {album.date} · {album.tracks} utworów</span></span>
              </label>
            </li>)}
          </ul>}
        </section>)}
      </div>
      {ready.length > 0 && <button disabled={importPending} className="mt-6 rounded-xl bg-emerald-700 px-6 py-3 font-bold text-white disabled:opacity-60">{importPending ? "Importowanie kolejki…" : "Importuj wybrane do Supabase"}</button>}
      <p className="mt-3 text-xs text-zinc-500">Każdy artysta jest zapisywany w osobnej transakcji. Błąd jednej pozycji nie cofa poprawnych importów pozostałych artystów.</p>
    </form>}

    {importState.message && <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-2xl font-black">Wynik kolejki</h2>
      <p aria-live="polite" className={`mt-3 text-sm ${importState.success ? "text-emerald-700" : "text-red-700"}`}>{importState.message}</p>
      {importState.results && <ul className="mt-5 space-y-3">{importState.results.map(item => <li key={item.artistId} className={`rounded-xl p-4 ${item.success ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}><strong>{item.artistName}</strong><span className="ml-2 text-sm">{item.message}</span></li>)}</ul>}
    </section>}
  </div>;
}
