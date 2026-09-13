"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthFormState } from "@/lib/auth-validation";
import { requestPasswordReset } from "./actions";

const initialState: AuthFormState = {};

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, initialState);
  return <form action={action} className="space-y-4 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
    <h1 className="text-3xl font-black">Nie pamiętasz hasła?</h1>
    <p className="text-zinc-600">Podaj e-mail konta. Wyślemy bezpieczny link do ustawienia nowego hasła.</p>
    <label className="block text-sm font-semibold">E-mail
      <input className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3" name="email" type="email" autoComplete="email" required />
    </label>
    {state.errors?.email && <p className="text-sm text-red-700">{state.errors.email}</p>}
    {state.message && <p aria-live="polite" className={`text-sm ${state.success ? "text-emerald-700" : "text-red-700"}`}>{state.message}</p>}
    <button disabled={pending || state.success} className="w-full rounded-xl bg-zinc-950 px-5 py-3 font-bold text-white disabled:opacity-60">{pending ? "Wysyłanie…" : "Wyślij link"}</button>
    <Link href="/login" className="inline-block text-sm font-semibold hover:underline">← Wróć do logowania</Link>
  </form>;
}
