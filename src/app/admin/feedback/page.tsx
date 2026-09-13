import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminTabs } from "@/components/admin-tabs";
import { updateFeedbackAction } from "@/app/admin/actions";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Uwagi testerów" };
const date = new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" });
const categoryLabel = { bug: "Błąd", idea: "Pomysł", other: "Inna uwaga" };

export default async function AdminFeedbackPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=%2Fadmin%2Ffeedback");
  if (viewer.role !== "admin") notFound();
  const client = await createClient();
  const { data, error } = await client.from("user_feedback")
    .select("id,category,message,page_url,status,admin_note,created_at,user:users!user_feedback_user_id_fkey(username)")
    .order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error("Nie udało się pobrać uwag testerów.");
  return <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
    <header className="rounded-3xl bg-white p-6 shadow-sm sm:p-8"><p className="text-sm font-bold uppercase tracking-widest text-zinc-500">Panel administratora</p><h1 className="mt-2 text-4xl font-black">Uwagi testerów</h1><p className="mt-4 text-zinc-600">Błędy i pomysły przesłane bezpośrednio z aplikacji.</p><AdminTabs active="feedback" /></header>
    <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      {(data ?? []).length ? <ol className="space-y-4">{(data ?? []).map(item => { const user = Array.isArray(item.user) ? item.user[0] : item.user; return <li key={item.id} className="rounded-2xl border border-zinc-200 p-5">
        <div className="flex flex-wrap justify-between gap-3"><div><span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-black">{categoryLabel[item.category as keyof typeof categoryLabel]}</span><strong className="ml-3">@{user?.username ?? "Użytkownik"}</strong></div><time className="text-xs text-zinc-500">{date.format(new Date(item.created_at))}</time></div>
        <p className="mt-4 whitespace-pre-wrap break-words text-zinc-700">{item.message}</p>
        {item.page_url && <Link href={item.page_url} className="mt-3 inline-block text-sm font-semibold underline">Otwórz wskazaną stronę: {item.page_url}</Link>}
        <form action={updateFeedbackAction} className="mt-4 grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-end"><input type="hidden" name="feedbackId" value={item.id} /><label className="text-sm font-bold">Status<select name="status" defaultValue={item.status} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-normal"><option value="new">Nowe</option><option value="reviewed">Sprawdzone</option><option value="resolved">Rozwiązane</option></select></label><label className="text-sm font-bold">Notatka administratora<input name="note" defaultValue={item.admin_note ?? ""} maxLength={2000} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-normal" /></label><button className="rounded-lg bg-zinc-950 px-4 py-2 font-bold text-white">Zapisz</button></form>
      </li>;})}</ol> : <p className="text-zinc-500">Brak uwag od testerów.</p>}
    </section>
  </main>;
}
