import { safeNextPath } from "@/lib/auth-validation";
import { SignInForm, SignUpForm } from "./auth-forms";

export const metadata = { title: "Logowanie", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string; blocked?: string }> }) {
  const query = await searchParams;
  const next = safeNextPath(query.next ?? null, "/");
  const submittingCatalog = next === "/zglos";
  return <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
    <div className="mb-8 max-w-2xl">
      <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">Konto TAPEBASE</p>
      <h1 className="mt-2 text-4xl font-black tracking-tight">Oceniaj albumy i zapisuj swoją listę</h1>
    </div>
    {submittingCatalog && <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5">
      <p className="font-bold">Zaloguj się, aby zgłosić album lub artystę.</p>
      <p className="mt-1 text-sm text-zinc-500">Po zalogowaniu lub utworzeniu konta wrócisz bezpośrednio do formularza zgłoszenia.</p>
      <div className="mt-4 flex flex-wrap gap-3 text-sm font-bold">
        <a href="#logowanie" className="rounded-xl bg-zinc-950 px-4 py-2 text-white">Zaloguj się</a>
        <a href="#rejestracja" className="rounded-xl border border-zinc-300 px-4 py-2">Utwórz konto</a>
      </div>
    </div>}
    {query.reset === "success" && <p className="mb-6 rounded-2xl bg-emerald-50 p-4 font-semibold text-emerald-800">Hasło zostało zmienione. Zaloguj się nowym hasłem.</p>}
    {query.blocked === "1" && <p className="mb-6 rounded-2xl bg-red-50 p-4 font-semibold text-red-700">To konto zostało czasowo zawieszone. Skontaktuj się z administratorem.</p>}
    <div className="grid gap-6 lg:grid-cols-2"><SignInForm next={next} /><SignUpForm next={next} /></div>
  </main>;
}
