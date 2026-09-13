import Image from "next/image";
import Link from "next/link";
import { importApprovedAlbum } from "@/app/admin/zgloszenia/actions";

export type ApprovedSubmission = {
  id: number;
  spotify_type: "artist" | "album";
  spotify_url: string;
  title: string;
  thumbnail_url: string | null;
};

export function ApprovedSubmissionImports({ submissions }: { submissions: ApprovedSubmission[] }) {
  if (!submissions.length) return null;
  return <section className="mt-6 rounded-3xl border-2 border-emerald-200 bg-white p-6 shadow-sm sm:p-8">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Zaakceptowane zgłoszenia</p><h2 className="mt-1 text-2xl font-black">Do importu</h2></div>
      <span className="text-sm text-zinc-500">{submissions.length} pozycji</span>
    </div>
    <ul className="mt-5 space-y-3">{submissions.map(item => <li key={item.id} className="flex flex-col gap-4 rounded-2xl border border-zinc-200 p-4 sm:flex-row sm:items-center">
      {item.thumbnail_url ? <Image src={item.thumbnail_url} alt="" width={64} height={64} unoptimized className={`h-16 w-16 shrink-0 object-contain ${item.spotify_type === "artist" ? "rounded-full" : "rounded-lg"}`} /> : <div className="h-16 w-16 shrink-0 rounded-lg bg-zinc-100" />}
      <div className="min-w-0 flex-1"><a href={item.spotify_url} target="_blank" rel="noopener noreferrer" className="font-black hover:underline">{item.title}</a><p className="mt-1 text-sm text-zinc-500">{item.spotify_type === "artist" ? "Artysta" : "Album"}</p></div>
      {item.spotify_type === "artist" ? <Link href={`/admin/import?artists=${encodeURIComponent(item.spotify_url)}`} className="rounded-xl bg-zinc-950 px-4 py-3 text-center text-sm font-bold text-white">Otwórz w importerze</Link> : <form action={importApprovedAlbum} className="flex flex-wrap gap-2">
        <select name={`albumType-${item.id}`} aria-label={`Typ wydawnictwa ${item.title}`} className="rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm"><option value="album">Album</option><option value="ep">EP</option></select>
        <button name="importSubmissionId" value={item.id} className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white">Importuj</button>
      </form>}
    </li>)}</ul>
  </section>;
}
