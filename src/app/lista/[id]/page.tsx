import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { getUserListById } from "@/lib/user-lists";
import { Artwork } from "@/components/catalog";
import { albumPath } from "@/lib/catalog-format";
import { removeAlbumFromUserList } from "@/app/actions/user-lists";
import { DeleteUserListForm, EditUserListForm } from "@/components/user-list-forms";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const id = Number((await params).id);
  const list = await getUserListById(id, false);
  return { title: list?.name ?? "Lista albumów" };
}

export default async function UserListPage({ params }: Props) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const viewer = await getViewer();
  const list = await getUserListById(id, Boolean(viewer));
  if (!list) notFound();
  const own = viewer?.id === list.user_id;

  return <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
    <Link href={own ? "/listy" : `/u/${encodeURIComponent(list.owner?.username ?? "")}`} className="text-sm font-bold hover:underline">← {own ? "Twoje listy" : "Profil autora"}</Link>
    <header className="mt-5 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-widest text-zinc-500">{list.is_public ? "Lista publiczna" : "Lista prywatna"}</p><h1 className="mt-2 break-words text-4xl font-black">{list.name}</h1>{list.owner && <Link href={`/u/${encodeURIComponent(list.owner.username)}`} className="mt-3 inline-block font-bold hover:underline">@{list.owner.username}</Link>}</div>
        <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-bold">{list.items.length} {list.items.length === 1 ? "album" : "albumów"}</span>
      </div>
      {list.description && <p className="mt-5 max-w-3xl whitespace-pre-wrap text-zinc-600">{list.description}</p>}
    </header>

    <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-2xl font-black">Albumy</h2>
      {list.items.length ? <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{list.items.map((item, index) => <li key={item.album.id} className="relative min-w-0 rounded-2xl border border-zinc-100 p-4">
        <span className="absolute left-2 top-2 z-10 flex h-8 min-w-8 items-center justify-center rounded-full bg-zinc-950 px-2 text-sm font-black text-white shadow">{index + 1}</span>
        <Link href={albumPath(item.album)}><Artwork src={item.album.cover_url} alt={`Okładka albumu ${item.album.title}`} /><h3 className="mt-4 truncate font-black hover:underline">{item.album.title}</h3></Link>
        {own && <form action={removeAlbumFromUserList.bind(null, list.id, item.album.id)}><button className="mt-3 text-sm font-semibold text-red-700 hover:underline">Usuń z listy</button></form>}
      </li>)}</ol> : <p className="mt-5 rounded-2xl bg-zinc-50 p-5 text-zinc-600">Ta lista nie zawiera jeszcze albumów.</p>}
    </section>

    {own && <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <EditUserListForm id={list.id} name={list.name} description={list.description} isPublic={list.is_public} />
      <DeleteUserListForm id={list.id} />
    </section>}
  </main>;
}
