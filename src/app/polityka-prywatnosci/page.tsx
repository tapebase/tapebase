import { InfoPage } from "@/components/info-page";
import { publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata("Polityka prywatności", "Zasady przetwarzania danych i korzystania z usług zewnętrznych w TAPEBASE.", "/polityka-prywatnosci");

export default function PrivacyPage() {
  return <InfoPage eyebrow="Informacje" title="Polityka prywatności" intro="Opis danych używanych przez testową wersję TAPEBASE. Ostatnia aktualizacja: 17 września 2026 r.">
    <section><h2 className="text-2xl font-black text-zinc-950">Jakie dane zapisujemy?</h2><p className="mt-3">Przechowujemy dane potrzebne do prowadzenia konta: adres e-mail, nazwę użytkownika, opcjonalny avatar oraz informacje techniczne uwierzytelniania. Zapisujemy również działania wykonane w serwisie, między innymi oceny, listy odsłuchu, komentarze, polubienia i zgłoszenia katalogowe.</p></section>
    <section><h2 className="text-2xl font-black text-zinc-950">W jakim celu?</h2><p className="mt-3">Dane służą do logowania, prowadzenia publicznego profilu, działania funkcji społecznościowych, moderacji, ochrony przed nadużyciami i poprawiania serwisu.</p></section>
    <section><h2 className="text-2xl font-black text-zinc-950">Usługi zewnętrzne</h2><p className="mt-3">Konta i baza danych działają w Supabase. Transakcyjne wiadomości e-mail, w tym powiadomienia o nowych obserwujących, mogą być dostarczane przez Resend. Dane katalogowe pobieramy ze Spotify, a informacje o koncertach i ofertach biletowych mogą pochodzić z Ticketmaster. Otwarcie odnośnika do zewnętrznego serwisu podlega zasadom tego serwisu.</p></section>
    <section><h2 className="text-2xl font-black text-zinc-950">YouTube</h2><p className="mt-3">TAPEBASE korzysta z YouTube API Services oraz oficjalnego odtwarzacza YouTube. Po uruchomieniu filmu przeglądarka łączy się z YouTube, a przetwarzanie danych podlega również <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="font-semibold underline">Polityce prywatności Google</a>. Dostęp przyznany aplikacjom Google można sprawdzić w <a href="https://security.google.com/settings/security/permissions" target="_blank" rel="noreferrer" className="font-semibold underline">ustawieniach bezpieczeństwa Google</a>.</p></section>
    <section><h2 className="text-2xl font-black text-zinc-950">Widoczność</h2><p className="mt-3">Nazwa użytkownika, avatar, oceny, komentarze i podstawowe statystyki profilu mogą być publiczne. Adres e-mail nie jest wyświetlany na profilu publicznym.</p></section>
    <section><h2 className="text-2xl font-black text-zinc-950">Pytania i zgłoszenia</h2><p className="mt-3">Prośby związane z danymi oraz prywatnością można przesłać przez stronę Kontakt. Przed publicznym uruchomieniem uzupełnimy dokument o dane administratora serwisu i właściwy adres kontaktowy.</p></section>
  </InfoPage>;
}
