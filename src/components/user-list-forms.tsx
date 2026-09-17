"use client";

import Link from "next/link";
import { useActionState } from "react";
import { addAlbumToUserList, addTrackToUserList, createUserList, deleteUserList, updateUserList } from "@/app/actions/user-lists";
import type { UserListChoice } from "@/lib/user-lists";

const initialState = {};

function Feedback({ state }: { state: { message?: string; success?: boolean } }) {
  return state.message ? <p aria-live="polite" className={`mt-3 text-sm font-semibold ${state.success ? "text-emerald-700" : "text-red-700"}`}>{state.message}</p> : null;
}

function ListFields({ name = "", description = "", isPublic = true }: { name?: string; description?: string; isPublic?: boolean }) {
  return <>
    <label className="block text-sm font-bold" htmlFor="list-name">Nazwa listy</label>
    <input id="list-name" name="name" required maxLength={80} defaultValue={name} className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3" placeholder="np. Najlepsze albumy 2026" />
    <label className="mt-4 block text-sm font-bold" htmlFor="list-description">Opis <span className="font-normal text-zinc-500">(opcjonalnie)</span></label>
    <textarea id="list-description" name="description" maxLength={500} rows={3} defaultValue={description} className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3" placeholder="O czym jest ta lista?" />
    <label className="mt-4 flex items-center gap-3 text-sm font-semibold"><input type="checkbox" name="isPublic" defaultChecked={isPublic} className="h-4 w-4" /> Lista publiczna</label>
  </>;
}

export function CreateUserListForm() {
  const [state, action, pending] = useActionState(createUserList, initialState);
  return <form action={action} className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
    <h1 className="text-3xl font-black">Utwórz nową listę</h1>
    <p className="mt-2 text-sm text-zinc-500">Wybierz, czy chcesz kolekcjonować całe albumy, czy pojedyncze utwory. Rodzaj listy pozostaje stały.</p>
    <fieldset className="mt-6">
      <legend className="text-sm font-bold">Rodzaj listy</legend>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <label className="rounded-2xl border border-zinc-200 p-4"><input type="radio" name="kind" value="albums" defaultChecked className="mr-2" /><strong>Lista albumów</strong><span className="mt-1 block text-sm text-zinc-500">Kolekcja całych wydawnictw.</span></label>
        <label className="rounded-2xl border border-zinc-200 p-4"><input type="radio" name="kind" value="tracks" className="mr-2" /><strong>Playlista utworów</strong><span className="mt-1 block text-sm text-zinc-500">Pojedyncze piosenki, gotowe do eksportu do Spotify.</span></label>
      </div>
    </fieldset>
    <div className="mt-6"><ListFields /></div>
    <button disabled={pending} className="mt-5 rounded-xl bg-zinc-950 px-5 py-3 font-bold text-white disabled:opacity-60">{pending ? "Tworzenie…" : "Utwórz listę"}</button>
    <Feedback state={state} />
  </form>;
}

export function EditUserListForm({ id, name, description, isPublic, kind }: { id: number; name: string; description: string | null; isPublic: boolean; kind: "albums" | "tracks" }) {
  const [state, action, pending] = useActionState(updateUserList.bind(null, id), initialState);
  return <form action={action} className="rounded-3xl border border-zinc-200 p-5">
    <h2 className="text-xl font-black">Ustawienia listy</h2>
    <p className="mt-1 text-sm text-zinc-500">Rodzaj: {kind === "albums" ? "lista albumów" : "playlista utworów"}</p>
    <div className="mt-4"><ListFields name={name} description={description ?? ""} isPublic={isPublic} /></div>
    <button disabled={pending} className="mt-5 rounded-xl bg-zinc-950 px-5 py-3 font-bold text-white disabled:opacity-60">{pending ? "Zapisywanie…" : "Zapisz zmiany"}</button>
    <Feedback state={state} />
  </form>;
}

export function AddAlbumToList({ albumId, lists, returnPath }: { albumId: number; lists: UserListChoice[] | null; returnPath: string }) {
  const [state, action, pending] = useActionState(addAlbumToUserList.bind(null, albumId), initialState);
  if (lists === null) return <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm"><Link href={`/login?next=${encodeURIComponent(returnPath)}`} className="text-sm font-bold underline">Zaloguj się, aby dodać album do własnej listy</Link></div>;
  if (!lists.length) return <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm"><p className="text-sm text-zinc-600">Nie masz jeszcze własnej listy.</p><Link href="/listy" className="mt-2 inline-block text-sm font-bold underline">Utwórz pierwszą listę →</Link></div>;

  return <form action={action} className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
    <label htmlFor="album-list" className="text-sm font-bold">Dodaj do własnej listy</label>
    <select id="album-list" name="listId" required className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm">
      {lists.map(list => <option key={list.id} value={list.id}>{list.name}{list.containsItem ? " — już dodany" : ""}{list.is_public ? "" : " — prywatna"}</option>)}
    </select>
    <button disabled={pending} className="mt-3 w-full rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{pending ? "Dodawanie…" : "Dodaj do listy"}</button>
    <Feedback state={state} />
  </form>;
}

export function AddTrackToPlaylist({ trackId, lists }: { trackId: number; lists: UserListChoice[] }) {
  const [state, action, pending] = useActionState(addTrackToUserList.bind(null, trackId), initialState);
  if (!lists.length) return <Link href="/listy" className="mt-1 inline-block text-xs font-semibold text-zinc-500 hover:underline">Utwórz playlistę utworów →</Link>;
  return <details className="mt-2">
    <summary className="cursor-pointer text-xs font-semibold text-zinc-500 hover:underline">Dodaj do playlisty</summary>
    <form action={action} className="mt-2 flex max-w-md flex-col gap-2 sm:flex-row">
      <select name="listId" required className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs">
        {lists.map(list => <option key={list.id} value={list.id}>{list.name}{list.containsItem ? " — już dodany" : ""}{list.is_public ? "" : " — prywatna"}</option>)}
      </select>
      <button disabled={pending} className="rounded-lg bg-zinc-950 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">{pending ? "Dodawanie…" : "Dodaj"}</button>
      <Feedback state={state} />
    </form>
  </details>;
}

export function DeleteUserListForm({ id }: { id: number }) {
  return <form action={deleteUserList.bind(null, id)} onSubmit={event => {
    if (!window.confirm("Usunąć tę listę? Tej operacji nie można cofnąć.")) event.preventDefault();
  }} className="mt-5 rounded-2xl border border-red-200 p-5">
    <h2 className="font-black text-red-800">Usuń listę</h2>
    <p className="mt-2 text-sm text-zinc-600">Albumy nie znikną z katalogu. Usunięta zostanie wyłącznie ta lista.</p>
    <button className="mt-4 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white">Usuń listę</button>
  </form>;
}
