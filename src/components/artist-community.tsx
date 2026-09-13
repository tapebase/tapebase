"use client";

import Link from "next/link";
import { useActionState } from "react";
import { addArtistComment, type CommunityActionState } from "@/app/actions/community";
import { CommentActions } from "@/components/comment-actions";
import { UserAvatar } from "@/components/user-avatar";
import type { Viewer } from "@/lib/auth";
import type { CommunityComment } from "@/lib/community";

const initialState: CommunityActionState = {};
const commentDate = new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" });

function CommentThreadItem({ comment, artistId, viewer, returnPath, depth = 0 }: {
  comment: CommunityComment;
  artistId: number;
  viewer: Viewer | null;
  returnPath: string;
  depth?: number;
}) {
  return <li className={depth ? "mt-3 border-l-2 border-zinc-200 pl-3 sm:pl-5" : ""}>
    <article id={`comment-${comment.id}`} className="scroll-mt-6 rounded-2xl border border-zinc-200 p-4 target:ring-2 target:ring-amber-400 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/u/${encodeURIComponent(comment.username)}`} className="flex items-center gap-3 font-bold hover:underline">
          <UserAvatar username={comment.username} src={comment.avatar_url} size="small" /><span>@{comment.username}</span>
        </Link>
        <time className="text-xs text-zinc-500" dateTime={comment.created_at}>{commentDate.format(new Date(comment.created_at))}</time>
      </div>
      <p className="mt-3 whitespace-pre-wrap break-words text-zinc-700">{comment.content}</p>
      <CommentActions targetType="artist" targetId={artistId} commentId={comment.id} content={comment.content}
        likeCount={comment.likeCount} likedByViewer={comment.likedByViewer} isOwner={viewer?.id === comment.user_id}
        isSignedIn={Boolean(viewer)} returnPath={returnPath} />
    </article>
    {comment.children.length > 0 && <ol aria-label={`Odpowiedzi na komentarz użytkownika ${comment.username}`}>
      {comment.children.map(child => <CommentThreadItem key={child.id} comment={child} artistId={artistId} viewer={viewer} returnPath={returnPath} depth={depth + 1} />)}
    </ol>}
  </li>;
}

function ArtistCommentForm({ artistId }: { artistId: number }) {
  const [state, action, pending] = useActionState(addArtistComment.bind(null, artistId), initialState);
  return <form action={action}>
    <label htmlFor="artist-comment" className="font-bold">Dodaj komentarz</label>
    <textarea id="artist-comment" name="content" rows={4} required maxLength={2000}
      className="mt-3 w-full rounded-xl border border-zinc-300 bg-white p-4" placeholder="Co sądzisz o tym artyście?" />
    <button disabled={pending} className="mt-3 rounded-xl bg-zinc-950 px-5 py-3 font-bold text-white disabled:opacity-60">
      {pending ? "Dodawanie…" : "Dodaj komentarz"}
    </button>
    {state.message && <p aria-live="polite" className={`mt-3 text-sm ${state.success ? "text-emerald-700" : "text-red-700"}`}>{state.message}</p>}
  </form>;
}

export function ArtistCommunitySection({ artistId, comments, viewer, returnPath }: {
  artistId: number;
  comments: CommunityComment[];
  viewer: Viewer | null;
  returnPath: string;
}) {
  return <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
    <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">Społeczność</p>
    <h2 className="mt-1 text-2xl font-black">Dyskusja o artyście</h2>
    <div className="mt-6">
      {viewer ? <ArtistCommentForm artistId={artistId} /> : <div className="rounded-2xl bg-zinc-50 p-5">
        <p className="font-semibold">Zaloguj się, aby komentować.</p>
        <Link href={`/login?next=${encodeURIComponent(returnPath)}`} className="mt-3 inline-block rounded-xl bg-zinc-950 px-5 py-3 font-bold text-white">Zaloguj się lub załóż konto</Link>
      </div>}
    </div>
    <div className="mt-8 border-t border-zinc-200 pt-6">
      <h3 className="text-xl font-black">Dyskusje ({comments.length})</h3>
      {!comments.length && <p className="mt-4 rounded-2xl bg-zinc-50 p-5 text-zinc-600">Nikt jeszcze nie skomentował tego artysty.</p>}
      <ol className="mt-4 space-y-4">{comments.map(comment => <CommentThreadItem key={comment.id} comment={comment} artistId={artistId} viewer={viewer} returnPath={returnPath} />)}</ol>
    </div>
  </section>;
}
