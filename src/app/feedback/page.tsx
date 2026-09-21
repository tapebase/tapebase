import { redirect } from "next/navigation";
import { FeedbackForm } from "./feedback-form";
import { getViewer } from "@/lib/auth";

export const metadata = { title: "Zgłoś błąd lub pomysł", robots: { index: false, follow: false } };

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=%2Ffeedback");
  const from = String((await searchParams).from ?? "");
  const pageUrl = from.startsWith("/") && !from.startsWith("//") ? from.slice(0, 2000) : "";
  return <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
    <header><p className="text-sm font-bold uppercase tracking-widest text-zinc-500">Wersja testowa</p><h1 className="mt-2 text-4xl font-black">Zgłoś błąd lub pomysł</h1><p className="mt-4 text-zinc-600">Każda konkretna uwaga pomaga poprawić TAPEBASE przed publiczną premierą.</p></header>
    <FeedbackForm pageUrl={pageUrl} />
  </main>;
}
