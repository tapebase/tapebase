"use client";

import { useActionState } from "react";
import { submitFeedback, type FeedbackState } from "./actions";

const initialState: FeedbackState = {};

export function FeedbackForm({ pageUrl }: { pageUrl: string }) {
  const [state, action, pending] = useActionState(submitFeedback, initialState);
  return <form action={action} className="mt-6 space-y-5 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
    <input type="hidden" name="pageUrl" value={pageUrl} />
    <label className="block font-bold">Rodzaj uwagi
      <select name="category" className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 font-normal">
        <option value="bug">Błąd</option><option value="idea">Pomysł</option><option value="other">Inna uwaga</option>
      </select>
    </label>
    <label className="block font-bold">Co zauważyłeś?
      <textarea name="message" minLength={5} maxLength={3000} rows={7} required placeholder="Opisz, co się wydarzyło albo co warto zmienić…" className="mt-2 w-full rounded-xl border border-zinc-300 bg-white p-4 font-normal" />
    </label>
    {pageUrl && <p className="text-sm text-zinc-500">Strona: <code>{pageUrl}</code></p>}
    {state.message && <p role="status" className={`rounded-xl p-4 text-sm font-semibold ${state.success ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{state.message}</p>}
    <button disabled={pending || state.success} className="rounded-xl bg-zinc-950 px-5 py-3 font-bold text-white disabled:opacity-60">{pending ? "Wysyłanie…" : state.success ? "Wysłano" : "Wyślij uwagę"}</button>
  </form>;
}
