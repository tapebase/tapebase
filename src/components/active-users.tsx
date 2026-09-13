import Link from "next/link";
import { UserAvatar } from "@/components/user-avatar";
import type { ActiveUser } from "@/lib/community-leaderboard";

export function ActiveUsers({ users }: { users: ActiveUser[] }) {
  return <section className="mx-auto max-w-7xl px-6 pb-8" aria-labelledby="active-users-heading">
    <div className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="active-users-heading" className="text-2xl font-black">Najaktywniejsi użytkownicy</h2>
          <p className="mt-1 text-sm text-zinc-500">Aktywność z ostatnich 30 dni</p>
        </div>
        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Top 10</span>
      </div>
      {users.length ? <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {users.map((user, index) => <li key={user.user_id} className="rounded-2xl border border-zinc-100 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-zinc-950 px-2 text-sm font-black text-white">{index + 1}</span>
            <Link href={`/u/${encodeURIComponent(user.username)}`}><UserAvatar username={user.username} src={user.avatar_url} size="small" /></Link>
            <Link href={`/u/${encodeURIComponent(user.username)}`} className="min-w-0 truncate font-black hover:underline">@{user.username}</Link>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div><dt className="text-[11px] text-zinc-500">Albumy</dt><dd className="font-black">{user.added_albums}</dd></div>
            <div><dt className="text-[11px] text-zinc-500">Recenzje</dt><dd className="font-black">{user.reviews}</dd></div>
            <div><dt className="text-[11px] text-zinc-500">Oceny</dt><dd className="font-black">{user.ratings}</dd></div>
          </dl>
        </li>)}
      </ol> : <p className="mt-5 rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-600">W ostatnich 30 dniach nie odnotowano jeszcze aktywności.</p>}
      <p className="mt-4 text-xs text-zinc-500">Zaimportowany album: 5 pkt · recenzja albumu: 3 pkt · ocena albumu: 1 pkt.</p>
    </div>
  </section>;
}
