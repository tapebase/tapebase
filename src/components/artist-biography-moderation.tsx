"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { moderateArtistBiographyAction, removeArtistBiographyAction, type BiographyModerationState } from "@/app/admin/biografie/actions";

export type BiographySubmission = {
  id: number;
  content: string;
  created_at: string;
  artist: {
    name: string | null;
    slug: string | null;
    description: string | null;
    enrichment_field_sources: Record<string, unknown> | null;
  } | null;
  author: { username: string } | null;
};

export type PublishedBiography = {
  id: number;
  name: string | null;
  slug: string | null;
  description: string;
  biography_author: { username: string } | null;
};

const initialState: BiographyModerationState = {};
const date = new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" });

function BiographyCard({ submission }: { submission: BiographySubmission }) {
  const [state, action, pending] = useActionState(moderateArtistBiographyAction, initialState);
  const currentBiography = submission.artist?.enrichment_field_sources?.description
    ? null
    : submission.artist?.description ?? null;
  return <article className="rounded-2xl border border-zinc-200 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-xl font-black">{submission.artist?.name ?? "Nieznany artysta"}</h3>
        <p className="mt-1 text-sm text-zinc-500">Autor: {submission.author
          ? <Link href={`/u/${encodeURIComponent(submission.author.username)}`} className="font-bold hover:underline">@{submission.author.username}</Link>
          : "konto usunięte"} · {date.format(new Date(submission.created_at))}</p>
      </div>
      {submission.artist?.slug && <Link href={`/artist/${submission.artist.slug}`} className="text-sm font-bold underline">Otwórz profil</Link>}
    </div>
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-zinc-200 p-4">
        <h4 className="text-sm font-black uppercase tracking-wide text-zinc-500">Obecna biografia</h4>
        <p className="mt-3 whitespace-pre-line text-zinc-700">{currentBiography ?? "Brak opublikowanej biografii."}</p>
      </section>
      <section className="rounded-xl bg-[#f6f4ef] p-4">
        <h4 className="text-sm font-black uppercase tracking-wide text-zinc-500">Proponowana wersja</h4>
        <p className="mt-3 whitespace-pre-line text-zinc-700">{submission.content}</p>
      </section>
    </div>
    <form action={action} className="mt-4">
      <input type="hidden" name="submissionId" value={submission.id} />
      <label className="block text-sm font-bold">Powód odrzucenia
        <input name="reason" maxLength={1000} placeholder="Wymagany tylko przy odrzuceniu" className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 font-normal" />
      </label>
      <div className="mt-3 flex flex-wrap gap-3">
        <button name="decision" value="approve" disabled={pending} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">Zaakceptuj</button>
        <button name="decision" value="reject" disabled={pending} className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-60">Odrzuć</button>
      </div>
      {state.message && <p aria-live="polite" className={`mt-3 text-sm ${state.success ? "text-emerald-700" : "text-red-700"}`}>{state.message}</p>}
    </form>
  </article>;
}

export function ArtistBiographyModeration({ submissions }: { submissions: BiographySubmission[] }) {
  return <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
    <h2 className="text-2xl font-black">Biografie od użytkowników</h2>
    <p className="mt-2 text-sm text-zinc-500">Akceptacja publikuje tekst na profilu artysty i podpisuje go nickiem autora.</p>
    {submissions.length
      ? <div className="mt-6 space-y-4">{submissions.map(item => <BiographyCard key={item.id} submission={item} />)}</div>
      : <p className="mt-6 rounded-2xl bg-[#f6f4ef] p-5 text-zinc-600">Brak biografii oczekujących na akceptację.</p>}
  </section>;
}

function PublishedBiographyCard({ biography }: { biography: PublishedBiography }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(removeArtistBiographyAction, initialState);
  return <article className="rounded-2xl border border-zinc-200 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-xl font-black">{biography.name ?? "Nieznany artysta"}</h3>
        <p className="mt-1 text-sm text-zinc-500">{biography.biography_author
          ? <>Dodane przez <Link href={`/u/${encodeURIComponent(biography.biography_author.username)}`} className="font-bold hover:underline">@{biography.biography_author.username}</Link></>
          : "Biografia redakcyjna"}</p>
      </div>
      {biography.slug && <Link href={`/artist/${biography.slug}`} className="text-sm font-bold underline">Otwórz profil</Link>}
    </div>
    <p className="mt-4 whitespace-pre-line rounded-xl bg-[#f6f4ef] p-4 text-zinc-700">{biography.description}</p>
    <form action={action} className="mt-4">
      <input type="hidden" name="artistId" value={biography.id} />
      <label className="block text-sm font-bold">Powód usunięcia
        <input name="reason" maxLength={1000} placeholder="Opcjonalna notatka dla historii moderacji" className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 font-normal" />
      </label>
      {!confirming
        ? <button type="button" onClick={() => setConfirming(true)} disabled={state.success} className="mt-3 rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">Usuń biografię</button>
        : <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-800">Czy na pewno usunąć biografię artysty {biography.name ?? "bez nazwy"}?</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button disabled={pending || state.success} className="rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{pending ? "Usuwanie…" : state.success ? "Usunięto" : "Tak, usuń"}</button>
            <button type="button" onClick={() => setConfirming(false)} disabled={pending || state.success} className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-bold disabled:opacity-60">Anuluj</button>
          </div>
        </div>}
      {state.message && <p aria-live="polite" className={`mt-3 text-sm ${state.success ? "text-emerald-700" : "text-red-700"}`}>{state.message}</p>}
    </form>
  </article>;
}

export function PublishedArtistBiographies({ biographies }: { biographies: PublishedBiography[] }) {
  return <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
    <h2 className="text-2xl font-black">Opublikowane biografie</h2>
    <p className="mt-2 text-sm text-zinc-500">Usunięcie czyści tekst i podpis autora z publicznego profilu. Decyzja pozostaje w historii moderacji.</p>
    {biographies.length
      ? <div className="mt-6 space-y-4">{biographies.map(item => <PublishedBiographyCard key={item.id} biography={item} />)}</div>
      : <p className="mt-6 rounded-2xl bg-[#f6f4ef] p-5 text-zinc-600">Brak opublikowanych biografii.</p>}
  </section>;
}
