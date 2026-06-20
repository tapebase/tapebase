const albums = [
  {
    title: "Ezoteryka",
    year: "2015",
    rating: "9.1",
  },
  {
    title: "Egzotyka",
    year: "2017",
    rating: "8.5",
  },
  {
    title: "Romantic Psycho",
    year: "2020",
    rating: "8.2",
  },
];

const features = [
  "Taco Hemingway - Art-B",
  "PRO8L3M - Flary",
  "Bedoes - Numer specjalny",
];

export default function ArtistPage() {
  return (
    <main className="min-h-screen bg-[#f6f4ef] text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <a href="/" className="text-2xl font-black">
            TAPEBASE
          </a>

          <button className="rounded-full bg-zinc-950 px-5 py-2 text-white">
            Logowanie
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-8 lg:flex-row">
            <div className="h-56 w-56 rounded-3xl bg-zinc-300" />

            <div>
              <h1 className="text-5xl font-black">
                Quebonafide
              </h1>

              <div className="mt-6 flex flex-wrap gap-4">
                <div className="rounded-2xl bg-[#f6f4ef] px-6 py-4">
                  <p className="text-sm text-zinc-500">
                    Ocena artysty
                  </p>
                  <p className="text-4xl font-black">
                    8.71
                  </p>
                </div>

                <div className="rounded-2xl bg-[#f6f4ef] px-6 py-4">
                  <p className="text-sm text-zinc-500">
                    Liczba ocen
                  </p>
                  <p className="text-4xl font-black">
                    34 128
                  </p>
                </div>
              </div>

              <p className="mt-6 max-w-3xl text-zinc-600">
                Polski raper, autor licznych albumów solowych,
                projektów koncepcyjnych i współprac.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-3xl bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-2xl font-black">
            Albumy
          </h2>

          <div className="grid gap-4 md:grid-cols-3">
            {albums.map((album) => (
              <div
                key={album.title}
                className="rounded-2xl border border-zinc-100 p-4"
              >
                <div className="mb-4 aspect-square rounded-xl bg-zinc-200" />

                <h3 className="font-bold">
                  {album.title}
                </h3>

                <p className="text-sm text-zinc-500">
                  {album.year}
                </p>

                <p className="mt-3 font-black">
                  {album.rating}/10
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-3xl bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-2xl font-black">
            Gościnne występy
          </h2>

          <div className="space-y-3">
            {features.map((feature) => (
              <div
                key={feature}
                className="border-b border-zinc-100 pb-3"
              >
                {feature}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}