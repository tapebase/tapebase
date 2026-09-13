import { notFound, redirect } from "next/navigation";
import { AdminTabs } from "@/components/admin-tabs";
import { updateManagedUser } from "@/app/admin/actions";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Użytkownicy" };
const joined = new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium" });

export default async function AdminUsersPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=%2Fadmin%2Fuzytkownicy");
  if (viewer.role !== "admin") notFound();
  const client = await createClient();
  const { data: users, error } = await client.from("users")
    .select("id,username,role,created_at,suspended_at,suspension_reason")
    .order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error("Nie udało się pobrać użytkowników.");
  return <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
    <header className="rounded-3xl bg-white p-6 shadow-sm sm:p-8"><p className="text-sm font-bold uppercase tracking-widest text-zinc-500">Panel administratora</p><h1 className="mt-2 text-4xl font-black">Użytkownicy</h1><p className="mt-4 text-zinc-600">Zmieniaj role testerów i czasowo blokuj konta naruszające zasady.</p><AdminTabs active="users" /></header>
    <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-2xl font-black">Konta ({users?.length ?? 0})</h2>
      <ul className="mt-5 space-y-4">{(users ?? []).map(user => <li key={user.id} className="rounded-2xl border border-zinc-200 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><strong>@{user.username}</strong><p className="mt-1 text-xs text-zinc-500">Od {joined.format(new Date(user.created_at))} · {user.suspended_at ? "konto zawieszone" : "konto aktywne"}</p>{user.suspension_reason && <p className="mt-2 text-sm text-red-700">Powód: {user.suspension_reason}</p>}</div>{user.id === viewer.id && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">Twoje konto</span>}</div>
        <form action={updateManagedUser} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] sm:items-end">
          <input type="hidden" name="userId" value={user.id} />
          <label className="text-sm font-bold">Rola<select name="role" defaultValue={user.role} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-normal"><option value="user">Użytkownik</option><option value="admin">Administrator</option><option value="verified_artist">Zweryfikowany artysta</option><option value="verified_producer">Zweryfikowany producent</option></select></label>
          <div><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="suspended" defaultChecked={Boolean(user.suspended_at)} disabled={user.id === viewer.id} /> Konto zawieszone</label><input name="reason" defaultValue={user.suspension_reason ?? ""} maxLength={500} placeholder="Powód zawieszenia" className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm" /></div>
          <button className="rounded-lg bg-zinc-950 px-4 py-2 font-bold text-white">Zapisz</button>
        </form>
      </li>)}</ul>
    </section>
  </main>;
}
