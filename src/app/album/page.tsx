const tracks = [
  "Ja to ja",
  "Chwile ulotne",
  "Priorytety",
  "Gdyby",
  "Jestem Bogiem",
  "Nowiny",
  "W moich kręgach",
  "2 kilo",
];

const comments = [
  {
    user: "raphead92",
    text: "Jedna z najważniejszych płyt w historii polskiego rapu.",
  },
  {
    user: "bladi",
    text: "Klasyk. Album, do którego wraca się po latach.",
  },
];

export default function AlbumPage() {
  return (
    <main className="min-h-screen bg-[#f6f4ef] text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <a href="/" className="text-2xl font-black tracking-tight">
            TAPEBASE
          </a>

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

      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-[320px_1fr]">
        <aside>
          <div className="aspect-square rounded-3xl bg-zinc-300 shadow-sm" />

          <button className="mt-5 w-full rounded-2xl bg-zinc-950 px-5 py-4 font-bold text-white">
            Oceń album
          </button>

          <button className="mt-3 w-full rounded-2xl border border-zinc-300 bg-white px-5 py-4 font-bold">
            Chcę posłuchać
          </button>
        </aside>

        <div>
          <div className="rounded-3xl bg-white p-8 shadow-sm">
            <p className="mb-3 text-sm font-bold uppercase tracking-widest text-zinc-500">
              Album • 2000
            </p>

            <h1 className="text-5xl font-black tracking-tight">
              Kinematografia
            </h1>

            <p className="mt-3 text-xl font-semibold text-zinc-700">
              Paktofonika
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <div className="rounded-2xl bg-[#f6f4ef] px-6 py-4">
                <p className="text-sm font-semibold text-zinc-500">
                  Ocena społeczności
                </p>
                <p className="text-4xl font-black">
                  9.4 <span className="text-lg text-zinc-400">/ 10</span>
                </p>
              </div>

              <div className="rounded-2xl bg-[#f6f4ef] px-6 py-4">
                <p className="text-sm font-semibold text-zinc-500">
                  Liczba ocen
                </p>
                <p className="text-4xl font-black">12 458</p>
              </div>

              <div className="rounded-2xl bg-[#f6f4ef] px-6 py-4">
                <p className="text-sm font-semibold text-zinc-500">
                  Twoja ocena
                </p>
                <p className="text-4xl font-black">—</p>
              </div>
            </div>

            <p className="mt-8 max-w-3xl text-zinc-600">
              Debiutancki album Paktofoniki, uznawany za jeden z najważniejszych
              albumów w historii polskiego hip-hopu.
            </p>
          </div>

          <div className="mt-6 rounded-3xl bg-white p-8 shadow-sm">
            <h2 className="mb-6 text-2xl font-black">Tracklista</h2>

            <div className="space-y-3">
              {tracks.map((track, index) => (
                <div
                  key={track}
                  className="flex items-center gap-4 border-b border-zinc-100 pb-3"
                >
                  <span className="w-8 text-sm font-bold text-zinc-400">
                    {index + 1}
                  </span>
                  <span className="font-semibold">{track}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-3xl bg-white p-8 shadow-sm">
            <h2 className="mb-6 text-2xl font-black">Komentarze</h2>

            <div className="space-y-5">
              {comments.map((comment) => (
                <div key={comment.user} className="border-b border-zinc-100 pb-5">
                  <p className="font-bold">{comment.user}</p>
                  <p className="mt-2 text-zinc-600">{comment.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}