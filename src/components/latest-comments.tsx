import Link from "next/link";
import { Artwork } from "@/components/catalog";
import { RatingStars } from "@/components/community-controls";
import { UserAvatar } from "@/components/user-avatar";
import { albumPath, artistPath } from "@/lib/catalog-format";
import type { LatestComment } from "@/lib/community";

const commentDate = new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" });

function excerpt(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();
  return normalized.length > 220 ? `${normalized.slice(0, 217).trimEnd()}…` : normalized;
}

export function LatestComments({ comments }: { comments: LatestComment[] }) {
  return <section className="mx-auto max-w-7xl px-6 pb-16" aria-labelledby="latest-comments-heading">
    <div className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Społeczność</p>
        <h2 id="latest-comments-heading" className="mt-1 text-2xl font-black">Ostatnie komentarze</h2>
      </div>
      {comments.length ? <ol className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {comments.map(comment => {
          const targetPath = comment.target.type === "album" ? albumPath(comment.target) : artistPath(comment.target);
          const commentPath = `${targetPath}#comment-${comment.id}`;
          return <li key={comment.id} className="flex min-w-0 flex-col rounded-2xl border border-zinc-100 p-4">
            <div className="flex items-center justify-between gap-3">
              <Link href={`/u/${encodeURIComponent(comment.author.username)}`} className="flex min-w-0 items-center gap-3 font-bold hover:underline">
                <UserAvatar username={comment.author.username} src={comment.author.avatarUrl} size="small" />
                <span className="truncate">@{comment.author.username}</span>
              </Link>
              <time className="shrink-0 text-xs text-zinc-500" dateTime={comment.createdAt}>{commentDate.format(new Date(comment.createdAt))}</time>
            </div>
            <div className="mt-4 grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-3">
              <Link href={commentPath}><Artwork src={comment.target.imageUrl} alt={comment.target.type === "album" ? `Okładka albumu ${comment.target.title}` : `Zdjęcie: ${comment.target.title}`} /></Link>
              <div className="min-w-0">
                <Link href={commentPath} className="block truncate font-black hover:underline">{comment.target.title}</Link>
                {comment.target.type === "artist" ? <p className="mt-1 text-xs text-zinc-400">Komentarz o artyście</p> : comment.rating !== null ? <div className="mt-1">
                  <strong className="text-sm text-amber-600">{comment.rating.toFixed(1)}</strong>
                  <RatingStars value={comment.rating} size="small" label={`Ocena użytkownika ${comment.rating.toFixed(1)} na 10`} />
                </div> : <p className="mt-1 text-xs text-zinc-400">Bez oceny albumu</p>}
              </div>
            </div>
            <p className="mt-4 flex-1 break-words text-sm leading-6 text-zinc-700">{excerpt(comment.content)}</p>
            <Link href={commentPath} className="mt-4 text-sm font-bold underline underline-offset-4">Przejdź do dyskusji →</Link>
          </li>;
        })}
      </ol> : <p className="mt-5 rounded-2xl bg-zinc-50 p-5 text-zinc-600">Nie dodano jeszcze żadnego komentarza.</p>}
    </div>
  </section>;
}
