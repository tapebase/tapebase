import { YouTubePlayer } from "@/components/youtube-player";
import type { ArtistVideo } from "@/lib/artist-videos";

const published = new Intl.DateTimeFormat("pl-PL", { year: "numeric", month: "short", day: "numeric" });
const views = new Intl.NumberFormat("pl-PL", { notation: "compact", maximumFractionDigits: 1 });

export function ArtistVideos({ videos }: { videos: ArtistVideo[] }) {
  if (!videos.length) return null;
  return <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8" aria-labelledby="artist-videos-heading">
    <div className="mb-6">
      <h2 id="artist-videos-heading" className="text-2xl font-black">Najpopularniejsze teledyski</h2>
      <p className="mt-2 text-sm text-zinc-500">Oficjalne klipy dostępne w YouTube, uporządkowane według liczby wyświetleń.</p>
    </div>
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {videos.map(video => <article key={video.youtube_video_id} className="min-w-0">
        <YouTubePlayer videoId={video.youtube_video_id} title={video.title} thumbnailUrl={video.thumbnail_url} />
        <h3 className="mt-3 line-clamp-2 font-black">{video.title}</h3>
        <p className="mt-1 text-sm text-zinc-500">{video.channel_title}</p>
        <p className="mt-1 text-xs text-zinc-500">
          {views.format(Number(video.view_count))} wyświetleń
          {video.published_at ? ` · ${published.format(new Date(video.published_at))}` : ""}
        </p>
        <a href={`https://www.youtube.com/watch?v=${video.youtube_video_id}`} target="_blank" rel="noreferrer"
          className="mt-2 inline-block text-sm font-bold underline">Otwórz w YouTube</a>
      </article>)}
    </div>
  </section>;
}
