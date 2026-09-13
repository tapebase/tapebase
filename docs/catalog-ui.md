# Katalog w aplikacji (2026-09-08)

Istniejący jasny układ stron korzysta z danych Supabase. Usunięto panel diagnostyczny,
statyczne albumy, przykładowe oceny i komentarze. Podłączenie widoków nie zmienia bazy.

## Trasy

| Adres | Zawartość |
| --- | --- |
| `/` | Ostatnio dodane albumy; wyszukiwanie tytułu albumu lub nazwy artysty przez `?q=` |
| `/album` | Albumy i EP, filtrowanie tytułu, paginacja `?page=` |
| `/album/[slug]` | Okładka, wykonawcy, data, pełna tracklista, czasy, oceny i jeden link do Spotify |
| `/artist` | Wykonawcy i współautorzy, wyszukiwanie nazwy i paginacja |
| `/artist/[slug]` | Profil, ocena artysty, osobna średnia albumów oraz albumy i utwory z udziałem; niezależne strony `?albums=` i `?tracks=` |
| `/rankingi` | TOP artystów i TOP albumów według ocen użytkowników |

Albumy są uporządkowane według dodania do TAPEBASE, z ID rozstrzygającym remisy.
Lista artystów jest alfabetyczna. Wyszukiwanie dopasowuje fragment tekstu bez
rozróżnienia wielkości liter; nie jest wyszukiwaniem rozmytym ani bez polskich znaków.
Listy mają po 20 wyników. Numer strony poza zakresem pokazuje pustą listę i link
powrotny, a nieistniejący album/artysta widok 404. Awaria odczytu ma komunikat
i ponowienie przez Next.js `unstable_retry`.

Zakładka „Rankingi” znajduje się w głównym menu po „Artyści”. Po najechaniu lub
ustawieniu fokusu pokazuje skróty do obu zestawień. Wybranie skrótu otwiera tylko
ranking artystów (`?typ=artysci`) albo tylko ranking albumów (`?typ=albumy`), natomiast
główna trasa pokazuje oba. Ranking sortuje najpierw po
średniej malejąco, następnie po liczbie ocen malejąco i stabilnie po ID. Wyświetlane
są wyłącznie pozycje, które otrzymały co najmniej jedną ocenę.

## Odczyt i źródło

`src/lib/supabase.ts` i `src/lib/catalog.ts` są modułami `server-only`. Używają
wyłącznie publicznego klucza i RLS, bez sekretów importera czy Spotify.
Zapytania wykonują się na serwerze przy żądaniu strony, z limitem 15 sekund
i bez trwałego cache. Strony nie pobierają ponownie danych ze Spotify.
Relacje pobierane są przez [zagnieżdżone zapytania Supabase](https://supabase.com/docs/guides/database/joins-and-nesting).

Wykonawcy utworów pochodzą z `spotify_track_artists`. Nie są interpretowani jako
potwierdzone featuringi ani producenci; redakcyjne `track_artists` pozostaje osobne.
Profil informuje o niepełnym zakresie dyskografii. Brak zdjęcia ma neutralne
zastępstwo, brak opisu nie tworzy wymyślonej biografii. Daty zachowują dokładność źródła.

Grafiki są wyświetlane z oryginalnych URL bez przycinania i zmian formatu.
Oficjalne logo i link do Spotify są widoczne raz, wyłącznie na stronie szczegółów
albumu. Karty, profile artystów i wiersze tracklisty nie powtarzają oznaczenia.
Pochodzenie logo opisano w `public/spotify-logo-source.md`.

## Weryfikacja

```powershell
npm run lint
npm run test:catalog
npm run build
npm run start -- --hostname 127.0.0.1
# W drugim terminalu, przy uruchomionej aplikacji:
npm run check:catalog
```

`check:catalog` wykonuje tylko odczyty HTTP. Wymaga wcześniej zaimportowanej paczki
Quebonafide i co najmniej dwóch stron wykonawców. Sprawdza aktualne albumy,
tracklisty, profile i współautorów, wyszukiwanie, rozłączne strony artystów,
puste wyniki, numer strony poza zakresem i 404. Opcjonalny argument określa adres,
np. `npm run check:catalog -- http://127.0.0.1:3001`.

Przeszły: kompilacja produkcyjna, TypeScript, ESLint, dwa testy dat/czasów oraz
kontrola HTTP pięciu prawdziwych albumów. W przeglądarce sprawdzono nawigację
strona główna → album → artysta, ładowanie okładek oraz układ o efektywnej
szerokości 375 px bez poziomego przepełnienia.
