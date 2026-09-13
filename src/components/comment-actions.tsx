"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  addReply,
  deleteComment,
  editComment,
  reportComment,
  toggleCommentLike,
} from "@/app/actions/community";
import type { CommunityActionState } from "@/app/actions/community";
import type { CommentTargetType } from "@/app/actions/community";

const initialState: CommunityActionState = {};

export function CommentActions({
  targetType,
  targetId,
  commentId,
  content,
  likeCount,
  likedByViewer,
  isOwner,
  isSignedIn,
  returnPath,
}: {
  targetType: CommentTargetType;
  targetId: number;
  commentId: number;
  content: string;
  likeCount: number;
  likedByViewer: boolean;
  isOwner: boolean;
  isSignedIn: boolean;
  returnPath: string;
}) {
  const [editing, setEditing] = useState(false);
  const [replying, setReplying] = useState(false);
  const [editState, editAction, editPending] = useActionState(
    editComment.bind(null, targetType, targetId, commentId),
    initialState,
  );
  const [likeState, likeAction, likePending] = useActionState(
    toggleCommentLike.bind(null, targetType, targetId, commentId, !likedByViewer),
    initialState,
  );
  const [replyState, replyAction, replyPending] = useActionState(
    addReply.bind(null, targetType, targetId, commentId),
    initialState,
  );
  const [reportState, reportAction, reportPending] = useActionState(
    reportComment.bind(null, commentId),
    initialState,
  );

  return <>
    {editing ? <form action={editAction} className="mt-4 rounded-xl bg-zinc-50 p-4">
      <label htmlFor={`edit-comment-${commentId}`} className="text-sm font-bold">Edytuj komentarz</label>
      <textarea
        id={`edit-comment-${commentId}`}
        name="content"
        defaultValue={content}
        rows={4}
        required
        maxLength={2000}
        className="mt-2 w-full rounded-xl border border-zinc-300 bg-white p-3"
      />
      <div className="mt-3 flex flex-wrap gap-3">
        <button disabled={editPending} className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{editPending ? "Zapisywanie…" : "Zapisz zmiany"}</button>
        <button type="button" onClick={() => setEditing(false)} className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-bold">Anuluj</button>
      </div>
      {editState.message && <p aria-live="polite" className={`mt-2 text-sm ${editState.success ? "text-emerald-700" : "text-red-700"}`}>{editState.message}</p>}
    </form> : <div className="mt-4 flex flex-wrap items-center gap-4">
      {isOwner ? <span className="text-sm font-semibold text-zinc-500" aria-label={`${likeCount} polubień`}>♥ {likeCount}</span>
        : isSignedIn ? <form action={likeAction}>
          <button
            disabled={likePending}
            aria-pressed={likedByViewer}
            className={`rounded-full border px-3 py-1.5 text-sm font-bold transition-colors disabled:opacity-60 ${likedByViewer ? "border-red-200 bg-red-50 text-red-700" : "border-zinc-300 bg-white text-zinc-700 hover:border-red-300 hover:text-red-700"}`}
          >{likedByViewer ? "♥" : "♡"} {likeCount}</button>
        </form> : <Link href={`/login?next=${encodeURIComponent(returnPath)}`} className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-bold text-zinc-700">♡ {likeCount}</Link>}

      {isOwner && <>
        <button type="button" onClick={() => setEditing(true)} className="text-sm font-semibold hover:underline">Edytuj</button>
        <form action={deleteComment.bind(null, targetType, targetId, commentId)}><button className="text-sm font-semibold text-red-700 hover:underline">Usuń</button></form>
      </>}
      {isSignedIn ? <button type="button" onClick={() => setReplying(value => !value)} className="text-sm font-semibold hover:underline">Odpowiedz</button>
        : <Link href={`/login?next=${encodeURIComponent(returnPath)}`} className="text-sm font-semibold hover:underline">Odpowiedz</Link>}
      {isSignedIn && !isOwner && <details className="basis-full rounded-xl bg-zinc-50 p-3">
        <summary className="cursor-pointer text-sm font-semibold">Zgłoś komentarz</summary>
        <form action={reportAction} className="mt-3 space-y-3">
          <label className="block text-sm font-bold">Powód
            <select name="category" className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-normal">
              <option value="spam">Spam</option><option value="abuse">Obraźliwa treść</option><option value="spoiler">Spoiler</option><option value="other">Inny</option>
            </select>
          </label>
          <label className="block text-sm font-bold">Dodatkowy opis (opcjonalnie)
            <textarea name="details" maxLength={1000} rows={2} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-2 font-normal" />
          </label>
          <button disabled={reportPending} className="rounded-lg bg-red-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-60">{reportPending ? "Wysyłanie…" : "Wyślij zgłoszenie"}</button>
        </form>
        {reportState.message && <p aria-live="polite" className={`mt-2 text-sm ${reportState.success ? "text-emerald-700" : "text-red-700"}`}>{reportState.message}</p>}
      </details>}
      {likeState.message && <p aria-live="polite" className="basis-full text-sm text-red-700">{likeState.message}</p>}
      {editState.success && <p aria-live="polite" className="basis-full text-sm text-emerald-700">{editState.message}</p>}
    </div>}
    {replying && <form action={replyAction} className="mt-4 rounded-xl bg-zinc-50 p-4">
      <label htmlFor={`reply-comment-${commentId}`} className="text-sm font-bold">Twoja odpowiedź</label>
      <textarea id={`reply-comment-${commentId}`} name="content" rows={3} required maxLength={2000}
        className="mt-2 w-full rounded-xl border border-zinc-300 bg-white p-3" />
      <div className="mt-3 flex flex-wrap gap-3">
        <button disabled={replyPending} className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{replyPending ? "Dodawanie…" : "Dodaj odpowiedź"}</button>
        <button type="button" onClick={() => setReplying(false)} className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-bold">Anuluj</button>
      </div>
      {replyState.message && <p aria-live="polite" className={`mt-2 text-sm ${replyState.success ? "text-emerald-700" : "text-red-700"}`}>{replyState.message}</p>}
    </form>}
  </>;
}
