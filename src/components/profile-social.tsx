import Link from "next/link";
import { Artwork } from "@/components/catalog";
import { UserAvatar } from "@/components/user-avatar";
import type { FollowingActivityItem, RelationshipState } from "@/lib/follows";
import type { ProfileFollowUser } from "@/lib/profiles";
import {
  blockUserAction,
  followUserAction,
  unblockUserAction,
  unfollowUserAction,
} from "@/app/u/[username]/actions";

const date = new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium" });

export function ProfileFollowControls({
  targetUserId,
  username,
  relationship,
}: {
  targetUserId: string;
  username: string;
  relationship: RelationshipState;
}) {
  const follow = followUserAction.bind(null, targetUserId, username);
  const unfollow = unfollowUserAction.bind(null, targetUserId, username);
  const block = blockUserAction.bind(null, targetUserId, username);
  const unblock = unblockUserAction.bind(null, targetUserId, username);

  return <section className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
    {relationship.blocked_by_you ? <>
      <span className="text-sm font-bold text-zinc-600">Ten użytkownik jest zablokowany.</span>
      <form action={unblock}><button className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-bold">Odblokuj</button></form>
    </> : relationship.blocked_you ?
      <p className="text-sm text-zinc-600">Nie możesz obserwować tego użytkownika.</p> : <>
        <form action={relationship.following ? unfollow : follow}>
          <button className={relationship.following ? "rounded-xl border border-zinc-300 px-4 py-2 text-sm font-bold" : "rounded-xl bg-zinc-950 px-4 py-2 text-sm font-bold text-white"}>
            {relationship.following ? "Przestań obserwować" : "Obserwuj"}
          </button>
        </form>
        {relationship.follows_you && <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-600">Obserwuje Ciebie</span>}
        <form action={block} className="ml-auto"><button className="rounded-xl px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50">Zablokuj</button></form>
      </>}
  </section>;
}

export function ProfileConnections({ followers, following }: { followers: ProfileFollowUser[]; following: ProfileFollowUser[] }) {
  return <div className="mt-6 grid gap-6 lg:grid-cols-2">
    <ConnectionList title="Obserwujący" empty="Nikt jeszcze nie obserwuje tego profilu." users={followers} />
    <ConnectionList title="Obserwowani" empty="Ten użytkownik nikogo jeszcze nie obserwuje." users={following} />
  </div>;
}

function ConnectionList({ title, empty, users }: { title: string; empty: string; users: ProfileFollowUser[] }) {
  return <section className="rounded-3xl bg-white p-6 shadow-sm">
    <h2 className="text-2xl font-black">{title}</h2>
    {users.length ? <ul className="mt-4 grid gap-2 sm:grid-cols-2">{users.map(user => <li key={user.id}>
      <Link href={`/u/${encodeURIComponent(user.username)}`} className="flex items-center gap-3 rounded-xl border border-zinc-100 p-3 hover:bg-zinc-50">
        <UserAvatar username={user.username} src={user.avatar_url} />
        <span className="min-w-0 truncate font-bold">@{user.username}</span>
      </Link>
    </li>)}</ul> : <p className="mt-4 text-zinc-500">{empty}</p>}
  </section>;
}

function activityText(item: FollowingActivityItem) {
  if (item.kind === "album_rating") return <>ocenia album <strong>{item.target_title}</strong> na <strong>{item.rating?.toFixed(1)}</strong></>;
  if (item.kind === "artist_rating") return <>ocenia artystę <strong>{item.target_title}</strong> na <strong>{item.rating?.toFixed(1)}</strong></>;
  if (item.kind === "album_added") return <>dodaje album <strong>{item.target_title}</strong></>;
  return <>komentuje {item.target_type === "album" ? "album" : "artystę"} <strong>{item.target_title}</strong></>;
}

export function FollowingActivity({ items }: { items: FollowingActivityItem[] }) {
  return <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
    <h2 className="text-2xl font-black">Aktywność obserwowanych</h2>
    {items.length ? <ol className="mt-4 space-y-3">{items.map((item, index) => {
      const targetHref = `/${item.target_type}/${item.target_slug}`;
      return <li key={`${item.kind}-${item.actor_id}-${item.occurred_at}-${index}`} className="grid grid-cols-[auto_minmax(0,1fr)_3.5rem] items-start gap-3 rounded-xl border border-zinc-100 p-4">
        <Link href={`/u/${encodeURIComponent(item.username)}`}><UserAvatar username={item.username} src={item.avatar_url} /></Link>
        <div className="min-w-0">
          <p className="text-sm"><Link href={`/u/${encodeURIComponent(item.username)}`} className="font-black hover:underline">@{item.username}</Link> {activityText(item)}</p>
          {item.content && <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm text-zinc-600">{item.content}</p>}
          <time className="mt-2 block text-xs text-zinc-500" dateTime={item.occurred_at}>{date.format(new Date(item.occurred_at))}</time>
        </div>
        <Link href={targetHref}><Artwork src={item.target_image_url} alt={item.target_title} /></Link>
      </li>;
    })}</ol> : <p className="mt-4 text-zinc-500">Zaobserwuj użytkowników, aby zobaczyć tutaj ich oceny, komentarze i dodane albumy.</p>}
  </section>;
}
