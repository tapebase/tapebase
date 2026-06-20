export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* NAVBAR */}
      <nav className="border-b border-gray-200">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="text-2xl font-bold tracking-tight">
            TAPEBASE
          </div>

          <div className="hidden gap-8 md:flex">
            <a href="#">Albumy</a>
            <a href="#">Rankingi</a>
            <a href="#">Artyści</a>
            <a href="#">Premiery</a>
            <a href="#">Społeczność</a>
          </div>

          <button className="rounded-lg bg-black px-4 py-2 text-white">
            Logowanie
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <h1 className="mb-4 text-5xl font-bold">
          Filmweb dla muzyki.
        </h1>

        <p className="mb-8 max-w-2xl text-lg text-gray-600">
          Oceniaj albumy, odkrywaj klasyki i twórz największy ranking
          polskiego rapu.
        </p>

        <input
          type="text"
          placeholder="Szukaj albumu lub artysty..."
          className="w-full max-w-xl rounded-xl border border-gray-300 p-4"
        />
      </section>

      {/* SEKCJE */}
      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-xl border p-6">
            <h2 className="mb-4 text-xl font-semibold">
              Top Albumy
            </h2>

            <p className="text-gray-600">
              Najwyżej oceniane albumy społeczności.
            </p>
          </div>

          <div className="rounded-xl border p-6">
            <h2 className="mb-4 text-xl font-semibold">
              Premiery
            </h2>

            <p className="text-gray-600">
              Najnowsze wydawnictwa rapowe.
            </p>
          </div>

          <div className="rounded-xl border p-6">
            <h2 className="mb-4 text-xl font-semibold">
              Społeczność
            </h2>

            <p className="text-gray-600">
              Ostatnie komentarze i aktywność użytkowników.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}