"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, signUp } from "./actions";
import type { AuthFormState } from "@/lib/auth-validation";
import { TurnstileField } from "./turnstile-field";

const initialState: AuthFormState = {};
const fieldClass = "mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3";

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, initialState);
  return <form id="logowanie" action={action} className="scroll-mt-6 space-y-4 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
    <input type="hidden" name="next" value={next} />
    <h2 className="text-2xl font-black">Logowanie</h2>
    <label className="block text-sm font-semibold">E-mail
      <input className={fieldClass} name="email" type="email" autoComplete="email" required />
    </label>
    {state.errors?.email && <p className="text-sm text-red-700">{state.errors.email}</p>}
    <label className="block text-sm font-semibold">Hasło
      <input className={fieldClass} name="password" type="password" autoComplete="current-password" required />
    </label>
    {state.errors?.password && <p className="text-sm text-red-700">{state.errors.password}</p>}
    <Link href="/reset-hasla" className="inline-block text-sm font-semibold hover:underline">Nie pamiętasz hasła?</Link>
    <TurnstileField resetKey={`${state.success ?? false}:${state.message ?? ""}`} />
    {state.message && <p aria-live="polite" className="text-sm text-red-700">{state.message}</p>}
    <button disabled={pending} className="w-full rounded-xl bg-zinc-950 px-5 py-3 font-bold text-white disabled:opacity-60">
      {pending ? "Logowanie…" : "Zaloguj się"}
    </button>
  </form>;
}

export function SignUpForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signUp, initialState);
  return <form id="rejestracja" action={action} className="scroll-mt-6 space-y-4 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
    <input type="hidden" name="next" value={next} />
    <h2 className="text-2xl font-black">Nowe konto</h2>
    <label className="block text-sm font-semibold">Nazwa użytkownika
      <input className={fieldClass} name="username" autoComplete="username" minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" required />
    </label>
    {state.errors?.username && <p className="text-sm text-red-700">{state.errors.username}</p>}
    <label className="block text-sm font-semibold">E-mail
      <input className={fieldClass} name="email" type="email" autoComplete="email" required />
    </label>
    {state.errors?.email && <p className="text-sm text-red-700">{state.errors.email}</p>}
    <label className="block text-sm font-semibold">Hasło
      <input className={fieldClass} name="password" type="password" autoComplete="new-password" minLength={8} required />
    </label>
    {state.errors?.password && <p className="text-sm text-red-700">{state.errors.password}</p>}
    <TurnstileField resetKey={`${state.success ?? false}:${state.message ?? ""}`} />
    {state.message && <p aria-live="polite" className={`text-sm ${state.success ? "text-emerald-700" : "text-red-700"}`}>{state.message}</p>}
    <button disabled={pending || state.success} className="w-full rounded-xl bg-zinc-950 px-5 py-3 font-bold text-white disabled:opacity-60">
      {pending ? "Tworzenie…" : "Utwórz konto"}
    </button>
  </form>;
}
