"use client";

import Image from "next/image";
import { useActionState } from "react";
import { moderateCatalogSubmissions, type ModerationState } from "@/app/admin/zgloszenia/actions";
import { MUSIC_GENRES } from "@/lib/genres";

export type AdminSubmission = {
  id: number; spotify_type: "artist" | "album"; spotify_id: string; spotify_url: string;
  title: string; thumbnail_url: string | null; status: "pending" | "approved" | "rejected" | "imported";
  moderator_note: string | null; rejection_reason: string | null; release_kind: "album" | "ep" | null;
  country_code: string;
  genre: string;
  created_at: string; supporters: number; submitters: string[];
  exactMatch: { label: string; href: string } | null;
  possibleEditions: { id: number; title: string; href: string; kind: string; date: string | null }[];
};

export type ModerationHistory = {
  id: number; title: string; action: "approved" | "rejected" | "imported" | "release_kind_changed";
  release_kind: "album" | "ep" | null; rejection_reason: string | null; moderator_note: string | null;
  created_at: string; adminName: string;
};

const labels = { pending: "Oczekuje", approved: "Zaakceptowane", rejected: "Odrzucone", imported: "Zaimportowane" };
const initialState: ModerationState = {};

const historyLabels = { approved: "Zaakceptowano", rejected: "Odrzucono", imported: "Zaimportowano", release_kind_changed: "Zmieniono typ wydania" };

export function CatalogSubmissionModeration({ submissions, history }: { submissions: AdminSubmission[]; history: ModerationHistory[] }) {
  const [state, action, pending] = useActionState(moderateCatalogSubmissions, initialState);
  return <form action={action} className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-black">Kolejka zgłoszeń</h2><p className="mt-1 text-sm text-zinc-500">Najczęściej zgłaszane pozycje są wyżej.</p></div><span className="text-sm text-zinc-500">{submissions.length} pozycji</span></div>
    {submissions.length ? <div className="mt-5 space-y-3">{submissions.map(item => <section key={item.id} className="rounded-2xl border border-zinc-200 p-4">
      <div className="flex items-start gap-4">
        <input type="checkbox" name="submissionIds" value={item.id} defaultChecked={item.status === "pending"} className="mt-5 h-5 w-5 shrink-0" aria-label={`Zaznacz ${item.title}`} />
        <input type="hidden" name={`spotifyType-${item.id}`} value={item.spotify_type} />
        {item.thumbnail_url ? <Image src={item.thumbnail_url} alt="" width={64} height={64} unoptimized className={`h-16 w-16 shrink-0 object-contain ${item.spotify_type === "artist" ? "rounded-full" : "rounded-lg"}`} /> : <div className="h-16 w-16 shrink-0 rounded-lg bg-zinc-100" />}
        <div className="min-w-0 flex-1">
          <a href={item.spotify_url} target="_blank" rel="noopener noreferrer" className="font-black hover:underline">{item.title}</a>
          <p className="mt-1 text-sm text-zinc-500">{item.spotify_type === "artist" ? "Artysta" : "Album"} · {labels[item.status]} · {item.supporters} {item.supporters === 1 ? "zgłaszający" : "zgłaszających"}</p>
          <p className="mt-1 truncate text-xs text-zinc-400">{item.submitters.join(", ")}</p>
          {item.spotify_type === "album" && <label className="mt-3 block max-w-xs text-sm font-bold">Typ wydania
            <select name={`releaseKind-${item.id}`} defaultValue={item.release_kind ?? "album"} className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 font-normal">
              <option value="album">Album</option><option value="ep">EP</option>
            </select>
          </label>}
          <label className="mt-3 block max-w-xs text-sm font-bold">Pochodzenie {item.spotify_type === "album" ? "głównego artysty" : "artysty"}
            <select name={`country-${item.id}`} defaultValue={item.country_code === "PL" ? "PL" : "INT"} className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 font-normal">
              <option value="PL">Polska</option><option value="INT">Zagranica</option>
            </select>
          </label>
          <label className="mt-3 block max-w-xs text-sm font-bold">Główny gatunek
            <select name={`genre-${item.id}`} defaultValue={item.genre} className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 font-normal">
              {MUSIC_GENRES.map(genre => <option key={genre.value} value={genre.value}>{genre.label}</option>)}
            </select>
          </label>
          {item.exactMatch && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">Ta pozycja już istnieje: <a href={item.exactMatch.href} className="underline">{item.exactMatch.label}</a></p>}
          {item.possibleEditions.length > 0 && <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800"><strong>Możliwe inne wydanie tego albumu:</strong><ul className="mt-1 space-y-1">{item.possibleEditions.map(album => <li key={album.id}><a href={album.href} className="underline">{album.title}</a> · {album.kind === "ep" ? "EP" : "album"}{album.date ? ` · ${album.date}` : ""}</li>)}</ul></div>}
          {item.moderator_note && <p className="mt-2 text-sm text-zinc-600">Notatka: {item.moderator_note}</p>}
        </div>
      </div>
    </section>)}</div> : <p className="mt-5 text-zinc-500">Kolejka jest pusta.</p>}
    {submissions.length > 0 && <div className="mt-6 border-t border-zinc-100 pt-5">
      <label className="block text-sm font-bold">Notatka dla zgłaszających (opcjonalnie)<textarea name="moderatorNote" rows={2} maxLength={1000} className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 font-normal" /></label>
      <label className="mt-4 block text-sm font-bold">Powód odrzucenia <span className="font-normal text-zinc-500">(wymagany przy odrzuceniu)</span><textarea name="rejectionReason" rows={2} maxLength={1000} className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 font-normal" /></label>
      <div className="mt-4 flex flex-wrap gap-3"><button name="decision" value="approved" disabled={pending} className="rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white disabled:opacity-60">Zaakceptuj zaznaczone</button><button name="decision" value="rejected" disabled={pending} className="rounded-xl bg-red-700 px-5 py-3 font-bold text-white disabled:opacity-60">Odrzuć zaznaczone</button></div>
      {state.message && <p aria-live="polite" className={`mt-3 text-sm ${state.success ? "text-emerald-700" : "text-red-700"}`}>{state.message}</p>}
    </div>}
    <section className="mt-8 border-t border-zinc-200 pt-6">
      <div className="flex items-center justify-between gap-3"><h2 className="text-2xl font-black">Historia moderacji</h2><span className="text-sm text-zinc-500">Ostatnie {history.length} działań</span></div>
      {history.length ? <ul className="mt-4 divide-y divide-zinc-100">{history.map(item => <li key={item.id} className="py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><p><strong>{historyLabels[item.action]}</strong> · {item.title}{item.release_kind ? ` · ${item.release_kind === "ep" ? "EP" : "album"}` : ""}</p><time className="text-xs text-zinc-500">{new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at))}</time></div>
        <p className="mt-1 text-sm text-zinc-500">Administrator: @{item.adminName}</p>
        {item.rejection_reason && <p className="mt-1 text-sm text-red-700">Powód: {item.rejection_reason}</p>}
        {item.moderator_note && <p className="mt-1 text-sm text-zinc-600">Notatka: {item.moderator_note}</p>}
      </li>)}</ul> : <p className="mt-4 text-zinc-500">Historia jest jeszcze pusta.</p>}
    </section>
  </form>;
}
