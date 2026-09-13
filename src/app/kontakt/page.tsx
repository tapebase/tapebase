import Link from "next/link";
import { InfoPage } from "@/components/info-page";

export const metadata = { title: "Kontakt" };

export default function ContactPage() {
  return <InfoPage title="Kontakt" intro="Uwagi użytkowników pomagają nam poprawiać katalog i przygotować TAPEBASE do szerszych testów.">
    <section><h2 className="text-2xl font-black text-zinc-950">Błąd lub pomysł</h2><p className="mt-3">Po zalogowaniu skorzystaj z formularza zgłoszeń. Do wiadomości automatycznie możemy dołączyć adres strony, której dotyczy uwaga.</p><Link href="/feedback" className="mt-4 inline-flex rounded-xl bg-zinc-950 px-5 py-3 font-bold text-white">Otwórz formularz kontaktowy</Link></section>
    <section><h2 className="text-2xl font-black text-zinc-950">Brakujący album lub artysta</h2><p className="mt-3">Pozycje katalogowe ze Spotify przesyłaj przez osobny formularz. Zgłoszenie trafi do kolejki moderatora.</p><Link href="/zglos" className="mt-4 inline-flex font-bold underline underline-offset-4">Zgłoś album / artystę →</Link></section>
  </InfoPage>;
}
