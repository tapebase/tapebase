import Link from "next/link";
export default function NotFound() {
  return <main className="mx-auto w-full max-w-7xl px-6 py-12"><div className="rounded-3xl bg-white p-8">
    <h1 className="text-3xl font-black">Nie znaleziono strony</h1>
    <p className="mt-4 text-zinc-600">Ten album lub artysta nie znajduje się w katalogu.</p>
    <Link href="/" className="mt-6 inline-block font-semibold underline">Wróć do katalogu</Link>
  </div></main>;
}
