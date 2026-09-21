import { InfoPage } from "@/components/info-page";
import { publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata("Regulamin", "Zasady korzystania z TAPEBASE, publikowania ocen, komentarzy i zgłoszeń katalogowych.", "/regulamin");

export default function TermsPage() {
  return <InfoPage eyebrow="Informacje" title="Regulamin" intro="Podstawowe zasady korzystania z testowej wersji TAPEBASE. Ostatnia aktualizacja: 11 września 2026 r.">
    <section><h2 className="text-2xl font-black text-zinc-950">Konto użytkownika</h2><p className="mt-3">Podawaj prawdziwy adres e-mail, chroń swoje hasło i nie udostępniaj konta innym osobom. Jedna osoba nie powinna tworzyć wielu kont w celu wpływania na oceny lub rankingi.</p></section>
    <section><h2 className="text-2xl font-black text-zinc-950">Oceny i dyskusje</h2><p className="mt-3">Publikuj własne opinie i szanuj innych użytkowników. Niedozwolony jest spam, podszywanie się, groźby, bezprawne treści oraz celowe zakłócanie ocen. Moderator może ukryć treść lub ograniczyć konto naruszające te zasady.</p></section>
    <section><h2 className="text-2xl font-black text-zinc-950">Zgłoszenia katalogowe</h2><p className="mt-3">Zgłaszaj właściwe odnośniki Spotify i wybieraj poprawne pochodzenie artysty. Administrator może poprawić, odrzucić albo połączyć zgłoszenie z istniejącą pozycją.</p></section>
    <section><h2 className="text-2xl font-black text-zinc-950">Materiały YouTube</h2><p className="mt-3">Teledyski są odtwarzane przez usługę YouTube i pozostają na serwerach YouTube. Korzystając z funkcji odtwarzania, użytkownik zgadza się przestrzegać <a href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer" className="font-semibold underline">Warunków korzystania z YouTube</a>.</p></section>
    <section><h2 className="text-2xl font-black text-zinc-950">Wersja testowa</h2><p className="mt-3">TAPEBASE jest obecnie rozwijany. Serwis może być czasowo niedostępny, a funkcje i zasady mogą się zmieniać. O istotnych zmianach poinformujemy użytkowników w serwisie.</p></section>
  </InfoPage>;
}
