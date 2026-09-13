import Link from "next/link";

export const metadata = { title: "Błąd potwierdzenia" };

export default function AuthErrorPage() {
  return <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
    <div className="rounded-3xl bg-white p-8 shadow-sm">
      <h1 className="text-3xl font-black">Nie udało się potwierdzić konta</h1>
      <p className="mt-4 text-zinc-600">Link mógł wygasnąć albo został już użyty. Spróbuj zalogować się lub utworzyć konto ponownie.</p>
      <Link className="mt-6 inline-block rounded-xl bg-zinc-950 px-5 py-3 font-bold text-white" href="/login">Przejdź do logowania</Link>
    </div>
  </main>;
}
