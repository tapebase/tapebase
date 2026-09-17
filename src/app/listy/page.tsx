import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { getOwnUserLists } from "@/lib/user-lists";
import { CreateUserListForm } from "@/components/user-list-forms";
import { UserListCards } from "@/components/user-lists";

export const metadata = { title: "Twoje listy albumów" };

export default async function UserListsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/listy");
  const lists = await getOwnUserLists(viewer.id);

  return <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
    <CreateUserListForm />
    <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Kolekcje</p><h2 className="mt-1 text-3xl font-black">Twoje listy</h2></div><span className="text-sm font-bold text-zinc-500">{lists.length}/50</span></div>
      {lists.length ? <UserListCards lists={lists} /> : <p className="mt-5 rounded-2xl bg-zinc-50 p-5 text-zinc-600">Utwórz pierwszą listę, a następnie dodawaj do niej albumy bezpośrednio z ich stron.</p>}
    </section>
  </main>;
}
