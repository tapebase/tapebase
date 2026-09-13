/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminTabs } from "@/components/admin-tabs";
import { YouTubeSyncPanel } from "@/components/youtube-sync-panel";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addManualChannel, addManualVideo, reviewYouTubeChannel, reviewYouTubeVideo } from "./actions";

export const metadata = { title: "Teledyski" };
const date = new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" });
const compact = new Intl.NumberFormat("pl-PL", { notation: "compact", maximumFractionDigits: 1 });

type VideoCandidate = {
  artist_id: number;
  youtube_video_id: string;
  confidence_score: number;
  match_evidence: Record<string, unknown>;
  artist: { id: number; name: string; slug: string | null } | null;
  video: {
    title: string; thumbnail_url: string | null; channel_title: string;
    view_count: number; published_at: string | null;
  } | null;
};
type ChannelCandidate = {
  artist_id: number;
  youtube_channel_id: string;
  confidence_score: number;
  match_method: string;
  artist: { id: number; name: string; slug: string | null } | null;
  channel: { title: string; channel_type: string; thumbnail_url: string | null } | null;
};

function evidenceList(evidence: Record<string, unknown>) {
  const items = [
    evidence.matchedTrackTitle ? `utwór: ${String(evidence.matchedTrackTitle)}` : null,
    evidence.verifiedChannel ? "zweryfikowany kanał" : null,
    evidence.artistInTitle ? "nazwa artysty w tytule" : null,
    evidence.officialMarker ? "oznaczenie official video" : null,
  ].filter(Boolean);
  return items.length ? items.join(" · ") : "Brak mocnych dowodów dopasowania";
}

const pageSize = 25;

function pageNumber(value: string | string[] | undefined) {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function Pagination({ page, count, parameter, otherPage }: { page: number; count: number; parameter: "videosPage" | "channelsPage"; otherPage: number }) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (pages <= 1) return null;
  const otherParameter = parameter === "videosPage" ? "channelsPage" : "videosPage";
  const href = (target: number) => `/admin/teledyski?${parameter}=${target}&${otherParameter}=${otherPage}`;
  return <nav aria-label="Stronicowanie" className="mt-6 flex items-center justify-between gap-4 border-t border-zinc-200 pt-5">
    {page > 1 ? <Link href={href(page - 1)} className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-bold">Poprzednia</Link> : <span />}
    <span className="text-sm text-zinc-500">Strona {page} z {pages} · {count} pozycji</span>
    {page < pages ? <Link href={href(page + 1)} className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-bold">Następna</Link> : <span />}
  </nav>;
}

export default async function AdminVideosPage({ searchParams }: { searchParams: Promise<{ videosPage?: string | string[]; channelsPage?: string | string[] }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=%2Fadmin%2Fteledyski");
  if (viewer.role !== "admin") notFound();
  const params = await searchParams;
  const videosPage = pageNumber(params.videosPage);
  const channelsPage = pageNumber(params.channelsPage);
  const client = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [pendingVideos, pendingChannels, approvedCount, syncCount, usage, runs, artists] = await Promise.all([
    client.from("artist_videos").select("artist_id,youtube_video_id,confidence_score,match_evidence,artist:artists!artist_videos_artist_id_fkey(id,name,slug),video:youtube_videos!artist_videos_youtube_video_id_fkey(title,thumbnail_url,channel_title,view_count,published_at)", { count: "exact" })
      .eq("status", "pending").order("created_at").range((videosPage - 1) * pageSize, videosPage * pageSize - 1).returns<VideoCandidate[]>(),
    client.from("artist_youtube_channels").select("artist_id,youtube_channel_id,confidence_score,match_method,artist:artists!artist_youtube_channels_artist_id_fkey(id,name,slug),channel:youtube_channels!artist_youtube_channels_youtube_channel_id_fkey(title,channel_type,thumbnail_url)", { count: "exact" })
      .eq("status", "candidate").order("created_at").range((channelsPage - 1) * pageSize, channelsPage * pageSize - 1).returns<ChannelCandidate[]>(),
    client.from("artist_videos").select("id", { count: "exact", head: true }).eq("status", "approved"),
    client.from("artist_youtube_sync").select("artist_id", { count: "exact", head: true }).in("status", ["pending", "failed"]),
    client.from("youtube_sync_daily_usage").select("search_calls").eq("usage_date", today).maybeSingle(),
    client.from("youtube_sync_runs").select("id,status,artists_checked,search_calls,videos_found,videos_saved,videos_auto_approved,error_message,started_at,finished_at")
      .order("started_at", { ascending: false }).limit(10),
    client.from("artists").select("id,name").eq("catalog_visible", true).order("name"),
  ]);
  if (pendingVideos.error || pendingChannels.error || approvedCount.error || syncCount.error || usage.error || runs.error || artists.error) {
    throw new Error("Nie udało się pobrać panelu teledysków.");
  }

  return <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
    <header className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">Panel administratora</p>
      <h1 className="mt-2 text-4xl font-black">Teledyski YouTube</h1>
      <p className="mt-4 max-w-3xl text-zinc-600">Wyszukuj oficjalne klipy artystów, sprawdzaj niepewne dopasowania i publikuj pięć najpopularniejszych filmów na profilu.</p>
      <AdminTabs active="videos" />
    </header>

    <section className="my-6 grid gap-4 sm:grid-cols-4">
      <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-zinc-500">Zaakceptowane</p><strong className="mt-1 block text-3xl">{approvedCount.count ?? 0}</strong></div>
      <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-zinc-500">Filmy do decyzji</p><strong className="mt-1 block text-3xl">{pendingVideos.count ?? 0}</strong></div>
      <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-zinc-500">Artyści w kolejce</p><strong className="mt-1 block text-3xl">{syncCount.count ?? 0}</strong></div>
      <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-zinc-500">Wyszukiwania dzisiaj</p><strong className="mt-1 block text-3xl">{usage.data?.search_calls ?? 0} / 50</strong></div>
    </section>

    <YouTubeSyncPanel configured={Boolean(process.env.YOUTUBE_API_KEY)} />

    <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-2xl font-black">Dodaj ręcznie</h2>
      <p className="mt-2 text-sm text-zinc-500">Wybierz pełny profil katalogowy. Film dodany ręcznie zostanie od razu zaakceptowany.</p>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <form action={addManualChannel} className="rounded-2xl border border-zinc-200 p-5">
          <h3 className="font-black">Zweryfikowany kanał</h3>
          <label className="mt-4 block text-sm font-semibold">Artysta<select required name="artistId" className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2"><option value="">Wybierz artystę</option>{artists.data?.map(artist => <option key={artist.id} value={artist.id}>{artist.name}</option>)}</select></label>
          <label className="mt-3 block text-sm font-semibold">Channel ID lub adres `/channel/UC…`<input required name="channel" className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2" /></label>
          <button className="mt-4 rounded-xl bg-zinc-950 px-4 py-2 text-sm font-bold text-white">Dodaj kanał</button>
        </form>
        <form action={addManualVideo} className="rounded-2xl border border-zinc-200 p-5">
          <h3 className="font-black">Pojedynczy teledysk</h3>
          <label className="mt-4 block text-sm font-semibold">Artysta<select required name="artistId" className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2"><option value="">Wybierz artystę</option>{artists.data?.map(artist => <option key={artist.id} value={artist.id}>{artist.name}</option>)}</select></label>
          <label className="mt-3 block text-sm font-semibold">Adres lub Video ID<input required name="video" className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2" /></label>
          <button className="mt-4 rounded-xl bg-zinc-950 px-4 py-2 text-sm font-bold text-white">Dodaj film</button>
        </form>
      </div>
    </section>

    <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-2xl font-black">Kanały do weryfikacji</h2>
      {pendingChannels.data?.length ? <><div className="mt-5 space-y-4">{pendingChannels.data.map(item => <article key={`${item.artist_id}-${item.youtube_channel_id}`} className="rounded-2xl border border-zinc-200 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><h3 className="text-xl font-black">{item.channel?.title ?? item.youtube_channel_id}</h3><p className="mt-1 text-sm text-zinc-500">Dla: {item.artist?.name ?? `artysta ${item.artist_id}`} · {item.match_method} · pewność {Math.round(item.confidence_score * 100)}%</p></div>
          <a href={`https://www.youtube.com/channel/${item.youtube_channel_id}`} target="_blank" rel="noreferrer" className="text-sm font-bold underline">Otwórz kanał</a>
        </div>
        <div className="mt-4 flex gap-3">
          <form action={reviewYouTubeChannel}><input type="hidden" name="artistId" value={item.artist_id} /><input type="hidden" name="channelId" value={item.youtube_channel_id} /><button name="decision" value="verify" className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Zweryfikuj</button></form>
          <form action={reviewYouTubeChannel}><input type="hidden" name="artistId" value={item.artist_id} /><input type="hidden" name="channelId" value={item.youtube_channel_id} /><button name="decision" value="reject" className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700">Odrzuć</button></form>
        </div>
      </article>)}</div><Pagination page={channelsPage} count={pendingChannels.count ?? 0} parameter="channelsPage" otherPage={videosPage} /></> : <p className="mt-5 rounded-2xl bg-[#f6f4ef] p-5 text-zinc-600">Brak kanałów oczekujących na decyzję.</p>}
    </section>

    <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-2xl font-black">Teledyski do weryfikacji</h2>
      {pendingVideos.data?.length ? <><div className="mt-5 space-y-5">{pendingVideos.data.map(item => <article key={`${item.artist_id}-${item.youtube_video_id}`} className="grid gap-5 rounded-2xl border border-zinc-200 p-5 md:grid-cols-[240px_1fr]">
        <a href={`https://www.youtube.com/watch?v=${item.youtube_video_id}`} target="_blank" rel="noreferrer" className="block aspect-video overflow-hidden rounded-xl bg-zinc-900">
          {item.video?.thumbnail_url && <img src={item.video.thumbnail_url} alt="" className="h-full w-full object-cover" />}
        </a>
        <div className="min-w-0"><h3 className="text-xl font-black">{item.video?.title ?? item.youtube_video_id}</h3>
          <p className="mt-1 text-sm text-zinc-500">{item.artist?.name ?? `artysta ${item.artist_id}`} · {item.video?.channel_title} · {compact.format(Number(item.video?.view_count ?? 0))} wyświetleń</p>
          <p className="mt-2 text-sm text-zinc-600">Pewność {Math.round(item.confidence_score * 100)}% · {evidenceList(item.match_evidence)}</p>
          <div className="mt-4 flex flex-col gap-3">
            <form action={reviewYouTubeVideo} className="flex flex-wrap items-center gap-3"><input type="hidden" name="artistId" value={item.artist_id} /><input type="hidden" name="videoId" value={item.youtube_video_id} />
              <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="official" value="true" /> Oficjalny klip</label>
              <button name="decision" value="approve" className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Zatwierdź</button>
            </form>
            <form action={reviewYouTubeVideo} className="flex flex-wrap gap-3"><input type="hidden" name="artistId" value={item.artist_id} /><input type="hidden" name="videoId" value={item.youtube_video_id} /><input name="reason" maxLength={1000} placeholder="Powód odrzucenia (opcjonalnie)" className="min-w-0 flex-1 rounded-xl border border-zinc-300 px-3 py-2 text-sm" /><button name="decision" value="reject" className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700">Odrzuć</button></form>
          </div>
        </div>
      </article>)}</div><Pagination page={videosPage} count={pendingVideos.count ?? 0} parameter="videosPage" otherPage={channelsPage} /></> : <p className="mt-5 rounded-2xl bg-[#f6f4ef] p-5 text-zinc-600">Brak teledysków oczekujących na decyzję.</p>}
    </section>

    <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-2xl font-black">Historia synchronizacji</h2>
      {runs.data?.length ? <ol className="mt-5 space-y-3">{runs.data.map(run => <li key={run.id} className="rounded-2xl border border-zinc-200 p-4">
        <div className="flex flex-wrap justify-between gap-2"><strong>{run.status === "completed" ? "Ukończono" : run.status === "running" ? "W trakcie" : "Błąd"}</strong><time className="text-sm text-zinc-500">{date.format(new Date(run.started_at))}</time></div>
        <p className="mt-2 text-sm text-zinc-600">Artyści: {run.artists_checked} · wyszukiwania: {run.search_calls} · znalezione: {run.videos_found} · zapisane: {run.videos_saved} · autoakceptacja: {run.videos_auto_approved}</p>
        {run.error_message && <p className="mt-2 text-sm text-red-700">{run.error_message}</p>}
      </li>)}</ol> : <p className="mt-5 text-zinc-500">Brak wykonanych synchronizacji.</p>}
      <p className="mt-5 text-xs text-zinc-500">Dane i odtwarzacz pochodzą z YouTube. Korzystanie z nich podlega <Link href="https://www.youtube.com/t/terms" target="_blank" className="underline">Warunkom korzystania z YouTube</Link>.</p>
    </section>
  </main>;
}
