import Link from "next/link";
import type { Viewer } from "@/lib/auth";
import type { AlbumCommunity, ViewerAlbumState } from "@/lib/community";
import { CommunityControls } from "@/components/community-controls";
import { CommentActions } from "@/components/comment-actions";
import { UserAvatar } from "@/components/user-avatar";
import type { AlbumComment } from "@/lib/community";

const commentDate = new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" });

function CommentThreadItem({ comment, albumId, viewer, returnPath, depth = 0 }: {
  comment: AlbumComment;
  albumId: number;
  viewer: Viewer | null;
  returnPath: string;
  depth?: number;
}) {
  return <li className={depth ? "mt-3 border-l-2 border-zinc-200 pl-3 sm:pl-5" : ""}>
    <article id={`comment-${comment.id}`} className="scroll-mt-6 rounded-2xl border border-zinc-200 p-4 target:ring-2 target:ring-amber-400 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><Link href={`/u/${encodeURIComponent(comment.username)}`} className="flex items-center gap-3 font-bold hover:underline"><UserAvatar username={comment.username} src={comment.avatar_url} size="small" /><span>@{comment.username}</span></Link><time className="text-xs text-zinc-500" dateTime={comment.created_at}>{commentDate.format(new Date(comment.created_at))}</time></div>
      <p className="mt-3 whitespace-pre-wrap break-words text-zinc-700">{comment.content}</p>
      <CommentActions albumId={albumId} commentId={comment.id} content={comment.content} likeCount={comment.likeCount}
        likedByViewer={comment.likedByViewer} isOwner={viewer?.id === comment.user_id} isSignedIn={Boolean(viewer)} returnPath={returnPath} />
    </article>
    {comment.children.length > 0 && <ol aria-label={`Odpowiedzi na komentarz użytkownika ${comment.username}`}>
      {comment.children.map(child => <CommentThreadItem key={child.id} comment={child} albumId={albumId} viewer={viewer} returnPath={returnPath} depth={depth + 1} />)}
    </ol>}
  </li>;
}

export function AlbumCommunitySection({
  albumId,
  community,
  viewer,
  viewerState,
  returnPath,
}: {
  albumId: number;
  community: AlbumCommunity;
  viewer: Viewer | null;
  viewerState: ViewerAlbumState;
  returnPath: string;
}) {
  return <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
    <div><p className="text-sm font-bold uppercase tracking-widest text-zinc-500">Społeczność</p><h2 className="mt-1 text-2xl font-black">Dyskusja o albumie</h2></div>
    <div className="mt-6">
      {viewer ? <CommunityControls albumId={albumId} initial={viewerState} /> : <div className="rounded-2xl bg-zinc-50 p-5"><p className="font-semibold">Zaloguj się, aby komentować i tworzyć listy.</p><Link href={`/login?next=${encodeURIComponent(returnPath)}`} className="mt-3 inline-block rounded-xl bg-zinc-950 px-5 py-3 font-bold text-white">Zaloguj się lub załóż konto</Link></div>}
    </div>
    <div className="mt-8 border-t border-zinc-200 pt-6">
      <h3 className="text-xl font-black">Dyskusje ({community.comments.length})</h3>
      {!community.comments.length && <p className="mt-4 rounded-2xl bg-zinc-50 p-5 text-zinc-600">Nikt jeszcze nie skomentował tego albumu.</p>}
      <ol className="mt-4 space-y-4">{community.comments.map(comment => <CommentThreadItem key={comment.id} comment={comment} albumId={albumId} viewer={viewer} returnPath={returnPath} />)}</ol>
    </div>
  </section>;
}
