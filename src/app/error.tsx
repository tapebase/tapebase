"use client";
export default function CatalogError({ unstable_retry }: { unstable_retry: () => void }) {
  return <main className="mx-auto w-full max-w-7xl px-6 py-12"><div role="alert" className="rounded-3xl bg-white p-8">
    <h1 className="text-3xl font-black">Katalog jest chwilowo niedostępny</h1>
    <p className="mt-4 text-zinc-600">Nie udało się pobrać danych. Spróbuj ponownie za chwilę.</p>
    <button onClick={() => unstable_retry()} className="mt-6 rounded-2xl bg-zinc-950 px-6 py-3 font-semibold text-white">Spróbuj ponownie</button>
  </div></main>;
}
