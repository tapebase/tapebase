"use client";

import { useEffect, useId, useRef, useState } from "react";

declare global {
  interface Window {
    YT?: {
      Player: new (element: string, options: Record<string, unknown>) => { destroy(): void };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    if (existing) {
      existing.addEventListener("error", () => reject(new Error("Nie udało się załadować odtwarzacza.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.addEventListener("error", () => reject(new Error("Nie udało się załadować odtwarzacza.")), { once: true });
    document.head.appendChild(script);
  });
  return apiPromise;
}

export function YouTubePlayer({ videoId, title, thumbnailUrl }: {
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
}) {
  const reactId = useId(), elementId = `youtube-${reactId.replace(/:/g, "")}`;
  const [active, setActive] = useState(false), [error, setError] = useState("");
  const player = useRef<{ destroy(): void } | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    loadYouTubeApi().then(() => {
      if (cancelled || !window.YT?.Player) return;
      player.current = new window.YT.Player(elementId, {
        videoId,
        width: "100%",
        height: "100%",
        host: "https://www.youtube-nocookie.com",
        playerVars: { autoplay: 1, rel: 0 },
      });
    }).catch(() => setError("Nie udało się uruchomić odtwarzacza. Otwórz film w YouTube."));
    return () => {
      cancelled = true;
      player.current?.destroy();
      player.current = null;
    };
  }, [active, elementId, videoId]);

  if (active) return <div className="aspect-video overflow-hidden rounded-2xl bg-black">
    <div id={elementId} className="h-full w-full" />
    {error && <p className="p-4 text-sm text-white">{error}</p>}
  </div>;

  return <button type="button" onClick={() => setActive(true)}
    className="group relative block aspect-video w-full overflow-hidden rounded-2xl bg-zinc-900 text-left"
    aria-label={`Odtwórz teledysk: ${title}`}>
    {thumbnailUrl
      ? <>{/* YouTube supplies dynamic external thumbnail hosts; the player facade is intentionally not transformed. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /></>
      : <span className="flex h-full items-center justify-center text-sm font-bold text-white">YouTube</span>}
    <span className="absolute inset-0 bg-black/15 transition group-hover:bg-black/25" />
    <span aria-hidden="true" className="absolute left-1/2 top-1/2 flex h-14 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl bg-red-600 text-2xl text-white shadow-lg">▶</span>
  </button>;
}
