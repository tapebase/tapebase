const topAlbums = [
  { title: "Kinematografia", artist: "Paktofonika", rating: "9.4", year: "2000" },
  { title: "Tabasko", artist: "O.S.T.R.", rating: "9.2", year: "2002" },
  { title: "Ezoteryka", artist: "Quebonafide", rating: "9.1", year: "2015" },
  { title: "Marmur", artist: "Taco Hemingway", rating: "8.8", year: "2016" },
];

const recentAlbums = [
  { title: "Album testowy", artist: "Artysta testowy", year: "2026" },
  { title: "Nowa EP-ka", artist: "Raper X", year: "2026" },
  { title: "Mixtape jako album", artist: "Producent Y", year: "2025" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f6f4ef] text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="text-2xl font-black tracking-tight">TAPEBASE</div>

          <nav className="hidden items-center gap-8 text-sm font-medium text-zinc-700 md:flex">
            <a href="#">Albumy</a>
            <a href="#">Rankingi</a>
            <a href="#">Artyści</a>
            <a href="#">Ostatnio dodane</a>
            <a href="#">Społeczność</a>
          </nav>

          <button className="rounded-full bg-zinc-950 px-5 py-2 text-sm font-semibold text-white">
            Logowanie
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <p className="mb-3 text-sm font-bold uppercase tracking-widest text-zinc-500">
            Polska baza ocen albumów
          </p>

          <h1 className="max-w-3xl text-5xl font-black tracking-tight">
            Oceniaj albumy. Odkrywaj klasyki. Twórz ranking polskiego rapu.
          </h1>

          <p className="mt-5 max-w-2xl text-lg text-zinc-600">
            TAPEBASE to społecznościowa baza albumów inspirowana Filmwebem.
            Album jest głównym bohaterem.
          </p>

          <div className="mt-8 flex max-w-2xl gap-3">
            <input
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4 outline-none"
              placeholder="Szukaj albumu lub artysty..."
            />
            <button className="rounded-2xl bg-zinc-950 px-6 py-4 font-bold text-white">
              Szukaj
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-16 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-black">Top albumy</h2>
            <a href="#" className="text-sm font-semibold text-zinc-500">
              Zobacz ranking
            </a>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {topAlbums.map((album, index) => (
              <div
                key={album.title}
                className="flex gap-4 rounded-2xl border border-zinc-100 p-4"
              >
                <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-zinc-200 text-xl font-black">
                  {index + 1}
                </div>

                <div>
                  <h3 className="font-bold">{album.title}</h3>
                  <p className="text-sm text-zinc-500">
                    {album.artist} • {album.year}
                  </p>
                  <p className="mt-3 text-lg font-black">
                    {album.rating}
                    <span className="text-sm text-zinc-400"> / 10</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-2xl font-black">Ostatnio dodane</h2>

          <div className="space-y-4">
            {recentAlbums.map((album) => (
              <div key={album.title} className="border-b border-zinc-100 pb-4">
                <h3 className="font-bold">{album.title}</h3>
                <p className="text-sm text-zinc-500">
                  {album.artist} • {album.year}
                </p>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}