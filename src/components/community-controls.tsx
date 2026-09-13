"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  addComment,
  saveArtistRating,
  saveRating,
  toggleListened,
  toggleWantToListen,
} from "@/app/actions/community";
import type { ViewerAlbumState } from "@/lib/community";

const initialState = {};

function Feedback({ state }: { state: { message?: string; success?: boolean } }) {
  return state.message ? <p aria-live="polite" className={`mt-2 text-sm ${state.success ? "text-emerald-700" : "text-red-700"}`}>{state.message}</p> : null;
}

function Star({ fill }: { fill: number }) {
  const width = `${Math.max(0, Math.min(1, fill)) * 100}%`;
  const shape = "M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.59l-5.88 3.09 1.12-6.55-4.76-4.64 6.58-.96L12 2.5z";
  return <span aria-hidden="true" className="relative block h-6 w-6">
    <svg viewBox="0 0 24 24" className="absolute inset-0 h-full w-full fill-zinc-200"><path d={shape} /></svg>
    <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width }}>
      <svg viewBox="0 0 24 24" className="h-6 w-6 max-w-none fill-amber-400"><path d={shape} /></svg>
    </span>
  </span>;
}

export function RatingStars({ value, size = "normal", label }: { value: number; size?: "small" | "normal"; label?: string }) {
  return <div className={`flex ${size === "small" ? "gap-0" : "gap-0.5"}`} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    {Array.from({ length: 10 }, (_, index) => <span key={index} className={size === "small" ? "scale-75 -mx-0.5" : ""}><Star fill={value - index} /></span>)}
  </div>;
}

function RatingPanel({
  targetId,
  entity,
  average,
  ratingCount,
  initialRating,
  canRate,
  returnPath,
}: {
  targetId: number;
  entity: "album" | "artist";
  average: number | null;
  ratingCount: number;
  initialRating: number | null;
  canRate: boolean;
  returnPath: string;
}) {
  const saveAction = entity === "album" ? saveRating : saveArtistRating;
  const [state, action, pending] = useActionState(saveAction.bind(null, targetId), initialState);
  const [selected, setSelected] = useState(initialRating);
  const [hovered, setHovered] = useState<number | null>(null);
  const shown = hovered ?? selected ?? 0;

  const entityName = entity === "album" ? "album" : "artystę";
  return <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm" aria-labelledby={`${entity}-rating-heading`}>
    <div className="flex items-end justify-between gap-3">
      <div>
        <p id={`${entity}-rating-heading`} className="text-xs font-bold uppercase tracking-widest text-zinc-500">Ocena {entity === "album" ? "albumu" : "artysty"}</p>
        <div className="mt-1 flex items-baseline gap-1">
          <strong className="text-4xl font-black">{average === null ? "—" : average.toFixed(1)}</strong>
          <span className="text-sm text-zinc-500">/ 10</span>
        </div>
      </div>
      <p className="pb-1 text-sm text-zinc-500">{ratingCount} {ratingCount === 1 ? "ocena" : "ocen"}</p>
    </div>
    <div className="mt-2"><RatingStars value={average ?? 0} size="small" label={average === null ? "Brak ocen" : `Średnia ${average.toFixed(1)} na 10`} /></div>

    {canRate ? <form action={action} className="mt-5 border-t border-zinc-200 pt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-bold">Twoja ocena</p>
        <output className="text-sm font-semibold text-zinc-600">{shown ? `${shown.toFixed(1)} / 10` : "Wybierz"}</output>
      </div>
      <div className="mt-2 flex gap-0.5" onMouseLeave={() => setHovered(null)}>
        {Array.from({ length: 10 }, (_, index) => {
          const value = index + 1;
          const fill = hovered === null ? (selected ?? 0) - index : value <= hovered ? 1 : 0;
          return <button
            key={value}
            type="submit"
            name="rating"
            value={value}
            disabled={pending}
            aria-label={`Oceń ${entityName} na ${value} z 10`}
            aria-pressed={selected === value}
            className="rounded-sm transition-transform hover:scale-110 focus-visible:scale-110 disabled:opacity-50"
            onMouseEnter={() => setHovered(value)}
            onFocus={() => setHovered(value)}
            onBlur={() => setHovered(null)}
            onClick={() => setSelected(value)}
          ><Star fill={fill} /></button>;
        })}
      </div>
      {pending && <p aria-live="polite" className="mt-2 text-sm text-zinc-500">Zapisywanie oceny…</p>}
      <Feedback state={state} />
    </form> : <div className="mt-5 border-t border-zinc-200 pt-4">
      <Link href={`/login?next=${encodeURIComponent(returnPath)}`} className="inline-block text-sm font-bold hover:underline">Zaloguj się, aby ocenić →</Link>
    </div>}
  </section>;
}

type RatingPanelProps = {
  average: number | null;
  ratingCount: number;
  initialRating: number | null;
  canRate: boolean;
  returnPath: string;
};

export function AlbumRatingPanel({ albumId, ...props }: RatingPanelProps & { albumId: number }) {
  return <RatingPanel targetId={albumId} entity="album" {...props} />;
}

export function ArtistRatingPanel({ artistId, ...props }: RatingPanelProps & { artistId: number }) {
  return <RatingPanel targetId={artistId} entity="artist" {...props} />;
}

export function CommunityControls({ albumId, initial }: { albumId: number; initial: ViewerAlbumState }) {
  const [listenedState, listenedAction, listenedPending] = useActionState(toggleListened.bind(null, albumId, !initial.listened), initialState);
  const [wantedState, wantedAction, wantedPending] = useActionState(toggleWantToListen.bind(null, albumId, !initial.wantToListen), initialState);
  const [commentState, commentAction, commentPending] = useActionState(addComment.bind(null, albumId), initialState);

  return <div className="space-y-6">
    <div className="grid gap-3 sm:grid-cols-2">
      <form action={listenedAction}><button disabled={listenedPending} className={`w-full rounded-xl border px-5 py-3 font-bold ${initial.listened ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-zinc-300 bg-white"}`}>{initial.listened ? "✓ Posłuchane" : "+ Oznacz jako posłuchane"}</button><Feedback state={listenedState} /></form>
      <form action={wantedAction}><button disabled={wantedPending} className={`w-full rounded-xl border px-5 py-3 font-bold ${initial.wantToListen ? "border-amber-600 bg-amber-50 text-amber-800" : "border-zinc-300 bg-white"}`}>{initial.wantToListen ? "✓ Chcę posłuchać" : "+ Chcę posłuchać"}</button><Feedback state={wantedState} /></form>
    </div>
    <form action={commentAction} className="border-t border-zinc-200 pt-6">
      <label htmlFor="comment" className="font-bold">Dodaj komentarz</label>
      <textarea id="comment" name="content" rows={4} required maxLength={2000} className="mt-3 w-full rounded-xl border border-zinc-300 bg-white p-4" placeholder="Co sądzisz o tym albumie?" />
      <button disabled={commentPending} className="mt-3 rounded-xl bg-zinc-950 px-5 py-3 font-bold text-white disabled:opacity-60">{commentPending ? "Dodawanie…" : "Dodaj komentarz"}</button>
      <Feedback state={commentState} />
    </form>
  </div>;
}
