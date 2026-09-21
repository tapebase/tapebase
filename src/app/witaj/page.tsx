import { redirect } from "next/navigation";
import { completeOnboarding } from "./actions";
import { getViewer } from "@/lib/auth";
import { safeNextPath } from "@/lib/auth-validation";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Witaj w TAPEBASE", robots: { index: false, follow: false } };

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=%2Fwitaj");
  const next = safeNextPath((await searchParams).next ?? null, "/profil");
  const client = await createClient();
  const { data: profile } = await client.from("users").select("onboarding_completed_at").eq("id", viewer.id).single();
  if (profile?.onboarding_completed_at) redirect(next);
  return <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
    <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-10"><p className="text-sm font-bold uppercase tracking-widest text-zinc-500">Pierwsze kroki</p><h1 className="mt-2 text-4xl font-black">Witaj w TAPEBASE, @{viewer.username}</h1><p className="mt-4 text-lg text-zinc-600">Tutaj polski rap porządkuje społeczność — album po albumie.</p>
      <ol className="mt-8 grid gap-4 sm:grid-cols-2">
        <li className="rounded-2xl bg-zinc-50 p-5"><strong>1. Oceniaj</strong><p className="mt-2 text-sm text-zinc-600">Wystawiaj albumom i artystom oceny od 1 do 10 oraz prowadź listy odsłuchów.</p></li>
        <li className="rounded-2xl bg-zinc-50 p-5"><strong>2. Dyskutuj</strong><p className="mt-2 text-sm text-zinc-600">Komentuj albumy, odpowiadaj innym i otrzymuj powiadomienia o reakcjach.</p></li>
        <li className="rounded-2xl bg-zinc-50 p-5"><strong>3. Rozbudowuj katalog</strong><p className="mt-2 text-sm text-zinc-600">Zgłaszaj linki Spotify do brakujących albumów i artystów.</p></li>
        <li className="rounded-2xl bg-zinc-50 p-5"><strong>4. Pomagaj w testach</strong><p className="mt-2 text-sm text-zinc-600">Użyj „Zgłoś błąd / pomysł”, gdy coś nie działa albo można zrobić lepiej.</p></li>
      </ol>
      <form action={completeOnboarding} className="mt-8"><input type="hidden" name="next" value={next} /><button className="rounded-xl bg-zinc-950 px-6 py-3 font-bold text-white">Zaczynam korzystać →</button></form>
    </section>
  </main>;
}
