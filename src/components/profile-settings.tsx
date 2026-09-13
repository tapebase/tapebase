"use client";

import { useActionState } from "react";
import { updateProfile, type ProfileActionState } from "@/app/actions/profile";
import { UserAvatar } from "@/components/user-avatar";

const initialState: ProfileActionState = {};

export function ProfileSettings({ username, avatarUrl }: { username: string; avatarUrl: string | null }) {
  const [state, action, pending] = useActionState(updateProfile, initialState);
  return <section className="rounded-3xl bg-white p-6 shadow-sm lg:col-span-2" aria-labelledby="profile-settings-heading">
    <h2 id="profile-settings-heading" className="text-2xl font-black">Dane profilu</h2>
    <form action={action} className="mt-5 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
      <UserAvatar username={username} src={avatarUrl} size="large" />
      <div className="space-y-4">
        <label className="block font-bold">Nazwa użytkownika
          <input name="username" defaultValue={username} minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" required className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 font-normal" />
        </label>
        {state.errors?.username && <p className="text-sm text-red-700">{state.errors.username}</p>}
        <label className="block font-bold">Nowy avatar
          <input name="avatar" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="mt-2 block w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-normal" />
        </label>
        <p className="text-xs text-zinc-500">JPG, PNG, WebP lub GIF, maksymalnie 2 MB.</p>
        {state.errors?.avatar && <p className="text-sm text-red-700">{state.errors.avatar}</p>}
        <button disabled={pending} className="rounded-xl bg-zinc-950 px-5 py-3 font-bold text-white disabled:opacity-60">{pending ? "Zapisywanie…" : "Zapisz profil"}</button>
        {state.message && <p aria-live="polite" className={`text-sm ${state.success ? "text-emerald-700" : "text-red-700"}`}>{state.message}</p>}
      </div>
    </form>
  </section>;
}
