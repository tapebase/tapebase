"use client";

import { useActionState } from "react";
import type { AuthFormState } from "@/lib/auth-validation";
import { updatePassword } from "./actions";

const initialState: AuthFormState = {};

export function UpdatePasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, initialState);
  return <form action={action} className="space-y-4 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
    <h1 className="text-3xl font-black">Ustaw nowe hasło</h1>
    <p className="text-zinc-600">Hasło musi mieć co najmniej 8 znaków, jedną literę i jedną cyfrę.</p>
    <label className="block text-sm font-semibold">Nowe hasło
      <input className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3" name="password" type="password" autoComplete="new-password" minLength={8} required />
    </label>
    <label className="block text-sm font-semibold">Powtórz nowe hasło
      <input className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3" name="confirmation" type="password" autoComplete="new-password" minLength={8} required />
    </label>
    {state.errors?.password && <p className="text-sm text-red-700">{state.errors.password}</p>}
    {state.message && <p aria-live="polite" className="text-sm text-red-700">{state.message}</p>}
    <button disabled={pending} className="w-full rounded-xl bg-zinc-950 px-5 py-3 font-bold text-white disabled:opacity-60">{pending ? "Zapisywanie…" : "Zapisz nowe hasło"}</button>
  </form>;
}
