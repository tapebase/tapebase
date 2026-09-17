"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { removeUserListCover, updateUserListCover } from "@/app/actions/user-lists";

const outputSize = 640;
const targetBytes = 185 * 1024;

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(
    blob => blob ? resolve(blob) : reject(new Error("Nie udało się przygotować grafiki.")),
    "image/jpeg",
    quality,
  ));
}

async function prepareCover(file: File) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sourceX = Math.round((bitmap.width - side) / 2);
  const sourceY = Math.round((bitmap.height - side) / 2);
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Przeglądarka nie może przygotować grafiki.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, outputSize, outputSize);
  context.drawImage(bitmap, sourceX, sourceY, side, side, 0, 0, outputSize, outputSize);
  bitmap.close();

  let quality = 0.9;
  let blob = await canvasBlob(canvas, quality);
  while (blob.size > targetBytes && quality > 0.45) {
    quality -= 0.08;
    blob = await canvasBlob(canvas, quality);
  }
  if (blob.size > targetBytes) throw new Error("Nie udało się dostatecznie zmniejszyć grafiki.");
  return new File([blob], "cover.jpg", { type: "image/jpeg" });
}

export function PlaylistCoverEditor({ listId, name, coverUrl }: { listId: number; name: string; coverUrl: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(coverUrl);
  const [message, setMessage] = useState<string>();
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function upload() {
    const selected = input.current?.files?.[0];
    if (!selected) return;
    if (!selected.type.startsWith("image/") || selected.size > 12 * 1024 * 1024) {
      setSuccess(false);
      setMessage("Wybierz grafikę JPG, PNG lub WebP o rozmiarze do 12 MB.");
      return;
    }
    startTransition(async () => {
      try {
        const file = await prepareCover(selected);
        const formData = new FormData();
        formData.set("cover", file);
        const result = await updateUserListCover(listId, formData);
        setSuccess(Boolean(result.success));
        setMessage(result.message);
        if (result.success) setPreview(URL.createObjectURL(file));
      } catch (error) {
        setSuccess(false);
        setMessage(error instanceof Error ? error.message : "Nie udało się przygotować grafiki.");
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await removeUserListCover(listId);
      setSuccess(Boolean(result.success));
      setMessage(result.message);
      if (result.success) {
        if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
        setPreview(null);
        if (input.current) input.current.value = "";
      }
    });
  }

  return <div className="rounded-3xl border border-zinc-200 p-5">
    <h2 className="text-xl font-black">Okładka</h2>
    <p className="mt-1 text-sm text-zinc-500">Grafika zostanie przycięta do kwadratu i przygotowana także do wysłania do Spotify.</p>
    <div className="mt-4 grid gap-4 sm:grid-cols-[128px_1fr] sm:items-start">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-zinc-100">
        {preview ? <Image src={preview} alt={`Okładka playlisty ${name}`} fill unoptimized className="object-cover" sizes="128px" />
          : <div className="flex h-full items-center justify-center p-3 text-center text-xs font-semibold text-zinc-500">Brak własnej okładki</div>}
      </div>
      <div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" disabled={pending}
          className="block w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm" />
        <p className="mt-2 text-xs text-zinc-500">JPG, PNG lub WebP, maksymalnie 12 MB. Środkowa część grafiki zostanie przycięta do kwadratu.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={upload} disabled={pending} className="rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {pending ? "Zapisywanie…" : preview ? "Zmień okładkę" : "Dodaj okładkę"}
          </button>
          {coverUrl && <button type="button" onClick={remove} disabled={pending} className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700 disabled:opacity-60">Usuń okładkę</button>}
        </div>
        {message && <p aria-live="polite" className={`mt-3 text-sm font-semibold ${success ? "text-emerald-700" : "text-red-700"}`}>{message}</p>}
      </div>
    </div>
  </div>;
}
