import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminTabs } from "@/components/admin-tabs";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Statystyki" };

type ActivityDay = { date: string; newUsers: number; ratings: number; comments: number };
type TopUser = { username: string; ratings: number; comments: number; submissions: number; total: number };
type TopAlbum = { id: number; title: string; slug: string; ratings: number; comments: number; total: number };
type DashboardStats = {
  totals: { users: number; artists: number; albums: number; concerts: number; albumRatings: number; artistRatings: number; comments: number; pendingSubmissions: number };
  users: { new7d: number; new30d: number; active7d: number; active30d: number };
  averages: { albumRating: number | null; artistRating: number | null };
  imports: { total: number; queued: number; running: number; waiting: number; errors: number };
  activity: ActivityDay[];
  topUsers: TopUser[];
  topAlbums: TopAlbum[];
};

const number = new Intl.NumberFormat("pl-PL");
const shortDate = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short", timeZone: "UTC" });

function countLabel(value: number, one: string, few: string, many: string) {
  const last = value % 10, lastTwo = value % 100;
  const word = value === 1 ? one : last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? few : many;
  return `${value} ${word}`;
}

function Metric({ label, value, detail }: { label: string; value: number | string; detail?: string }) {
  return <article className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-zinc-500">{label}</p><strong className="mt-1 block text-3xl font-black">{typeof value === "number" ? number.format(value) : value}</strong>{detail && <p className="mt-2 text-xs text-zinc-500">{detail}</p>}</article>;
}

function ActivityChart({ days }: { days: ActivityDay[] }) {
  const maximum = Math.max(1, ...days.map(day => day.newUsers + day.ratings + day.comments));
  return <div>
    <div className="mt-6 flex h-48 items-end gap-1" aria-label="Aktywność dzienna przez ostatnie 30 dni">
      {days.map(day => {
        const total = day.newUsers + day.ratings + day.comments;
        return <div key={day.date} className="group relative flex h-full min-w-0 flex-1 items-end">
          <div className="w-full rounded-t bg-zinc-900 transition hover:bg-emerald-600" style={{ height: `${Math.max(total ? 5 : 1, total / maximum * 100)}%` }} />
          <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-44 -translate-x-1/2 rounded-lg bg-zinc-950 p-2 text-center text-xs text-white shadow-lg group-hover:block">{shortDate.format(new Date(`${day.date}T00:00:00Z`))}: {day.newUsers} kont, {day.ratings} ocen, {day.comments} komentarzy</span>
        </div>;
      })}
    </div>
    <div className="mt-2 flex justify-between text-xs text-zinc-500"><span>{days[0] ? shortDate.format(new Date(`${days[0].date}T00:00:00Z`)) : ""}</span><span>{days.at(-1) ? shortDate.format(new Date(`${days.at(-1)!.date}T00:00:00Z`)) : ""}</span></div>
  </div>;
}

export default async function AdminStatsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=%2Fadmin%2Fstatystyki");
  if (viewer.role !== "admin") notFound();
  const client = await createClient();
  const [{ data, error }, { count: visibleArtists, error: artistCountError }] = await Promise.all([
    client.rpc("admin_dashboard_stats"),
    client.from("artists").select("id", { count: "exact", head: true }).eq("catalog_visible", true),
  ]);
  if (error || !data || artistCountError) throw new Error("Nie udało się pobrać statystyk administratora.");
  const stats = data as DashboardStats;
  const publishedArtists = visibleArtists ?? 0;
  return <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-12">
    <header className="rounded-3xl bg-white p-6 shadow-sm sm:p-8"><p className="text-sm font-bold uppercase tracking-widest text-zinc-500">Panel administratora</p><h1 className="mt-2 text-4xl font-black">Statystyki TAPEBASE</h1><p className="mt-4 max-w-3xl text-zinc-600">Aktualny obraz użytkowników, katalogu i aktywności społeczności. Dane odświeżają się przy każdym otwarciu strony.</p><AdminTabs active="stats" /></header>

    <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Najważniejsze statystyki">
      <Metric label="Wszyscy użytkownicy" value={stats.totals.users} detail={`+${stats.users.new7d} przez ostatnie 7 dni`} />
      <Metric label="Aktywni przez 30 dni" value={stats.users.active30d} detail={`${stats.users.active7d} przez ostatnie 7 dni`} />
      <Metric label="Albumy w katalogu" value={stats.totals.albums} detail={`${publishedArtists} pełnych artystów · ${stats.totals.artists - publishedArtists} profili technicznych`} />
      <Metric label="Oczekujące zgłoszenia" value={stats.totals.pendingSubmissions} />
      <Metric label="Oceny albumów" value={stats.totals.albumRatings} detail={`Średnia: ${stats.averages.albumRating ?? "—"}`} />
      <Metric label="Oceny artystów" value={stats.totals.artistRatings} detail={`Średnia: ${stats.averages.artistRating ?? "—"}`} />
      <Metric label="Komentarze" value={stats.totals.comments} />
      <Metric label="Nadchodzące koncerty" value={stats.totals.concerts} />
    </section>

    <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Ostatnie 30 dni</p><h2 className="mt-1 text-2xl font-black">Aktywność społeczności</h2></div><p className="text-sm text-zinc-500">Nowe konta + oceny + komentarze</p></div><ActivityChart days={stats.activity} /></section>

    <section className="mt-6 grid gap-6 lg:grid-cols-2">
      <article className="rounded-3xl bg-white p-6 shadow-sm sm:p-8"><h2 className="text-2xl font-black">Najaktywniejsi użytkownicy</h2>{stats.topUsers.length ? <ol className="mt-5 divide-y divide-zinc-200">{stats.topUsers.map((user, index) => <li key={user.username} className="flex items-center justify-between gap-4 py-3"><div><Link href={`/u/${encodeURIComponent(user.username)}`} className="font-bold hover:underline">{index + 1}. @{user.username}</Link><p className="text-xs text-zinc-500">{countLabel(user.ratings, "ocena", "oceny", "ocen")} · {countLabel(user.comments, "komentarz", "komentarze", "komentarzy")} · {countLabel(user.submissions, "zgłoszenie", "zgłoszenia", "zgłoszeń")}</p></div><strong>{user.total}</strong></li>)}</ol> : <p className="mt-4 text-zinc-500">Brak aktywności użytkowników.</p>}</article>
      <article className="rounded-3xl bg-white p-6 shadow-sm sm:p-8"><h2 className="text-2xl font-black">Najbardziej angażujące albumy</h2>{stats.topAlbums.length ? <ol className="mt-5 divide-y divide-zinc-200">{stats.topAlbums.map((album, index) => <li key={album.id} className="flex items-center justify-between gap-4 py-3"><div><Link href={`/album/${encodeURIComponent(album.slug)}`} className="font-bold hover:underline">{index + 1}. {album.title}</Link><p className="text-xs text-zinc-500">{countLabel(album.ratings, "ocena", "oceny", "ocen")} · {countLabel(album.comments, "komentarz", "komentarze", "komentarzy")}</p></div><strong>{album.total}</strong></li>)}</ol> : <p className="mt-4 text-zinc-500">Brak aktywności przy albumach.</p>}</article>
    </section>

    <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8"><h2 className="text-2xl font-black">Importer katalogu</h2><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><Metric label="Wszystkie zadania" value={stats.imports.total} /><Metric label="W kolejce" value={stats.imports.queued} /><Metric label="W trakcie" value={stats.imports.running} /><Metric label="Czeka na limit" value={stats.imports.waiting} /><Metric label="Z błędami" value={stats.imports.errors} /></div></section>
  </main>;
}
