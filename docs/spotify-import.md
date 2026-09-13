# Spotify: podgląd i import

## Aktualny zakres

Lokalne narzędzie `spotify:preview` pobiera katalog Spotify i przygotowuje JSON do przeglądu.
Osobne `spotify:import` sprawdza plik, a z jawną opcją `--write` zapisuje go do Supabase.
Podgląd i walidacja bez `--write` nie zapisują danych. Nie pobieramy plików graficznych;
zwracamy adresy okładek i zdjęć. Nie udostępniamy publicznego endpointu importu.
Kod znajduje się w `scripts/spotify/`, poza kodem przeglądarki w `src/`.

## Konfiguracja i uruchomienie

Wymagany Node.js 24 (lokalnie sprawdzono 24.17.0) i zależności z `npm ci`.

1. Utwórz aplikację w [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Dopisz do istniejącego `.env.local` wartości `SPOTIFY_CLIENT_ID` i `SPOTIFY_CLIENT_SECRET`.
   Wzór nazw jest w `.env.example`. Zachowaj obecną konfigurację Supabase.
   Nie dodawaj prefiksu `NEXT_PUBLIC_` i nie commituj sekretów.
3. Uruchom podgląd, zastępując `LINK_ARTYSTY` prawdziwym linkiem:

```powershell
npm run spotify:preview -- "LINK_ARTYSTY"
npm run spotify:preview -- "LINK_ARTYSTY" --max-albums 20 --market PL
npm run spotify:preview -- "LINK_ARTYSTY" --ep "ID_LUB_LINK_EP"
npm run spotify:preview -- --help
```

Akceptowane wejścia: Spotify ID, `spotify:artist:ID` i link profilu
`https://open.spotify.com/artist/ID` (również z segmentem `intl-pl` i parametrami).
Linki skrócone nie są rozwijane. `--ep` można podać wielokrotnie, także dla
wydawnictwa zwracanego jako `album`, jeśli redakcja potwierdzi, że jest EP.

Domyślny rynek to PL. To filtr dostępności, a nie narodowości ani gatunku:
polski rap wybieramy przez wskazanie właściwego artysty.
Narzędzie pobiera wszystkie strony jego albumów i singli, ale szczegóły maksymalnie
5 zakwalifikowanych wydawnictw. `--max-albums` przyjmuje 1–100.
Kolejność wyboru jest stabilna według Spotify ID; to nie sortowanie premier.

Wynik trafia na stdout, a błędy na stderr z kodem wyjścia 1. Aby zapisać czysty JSON
w lokalnym pliku, użyj `npm run --silent spotify:preview -- "LINK_ARTYSTY" > preview.json`.
Podglądy operatora przechowuj w ignorowanym katalogu `.local/spotify/`.
Program wypisuje wynik dopiero po ukończeniu całego
wybranego zakresu; błąd nie daje pozornie kompletnego planu.

## Autoryzacja i ograniczenia API

Używamy [Client Credentials](https://developer.spotify.com/documentation/web-api/tutorials/client-credentials-flow)
do odczytu katalogu bez logowania użytkownika TAPEBASE do Spotify.
Token jest przechowywany w pamięci procesu i odnawiany przed wygaśnięciem.
Po 401 transport ponawia autoryzację raz. 5xx oraz 429 z krótkim `Retry-After`
mają maksymalnie dwa ponowienia. Długi limit lub 429 bez czasu ponowienia kończy podgląd.
Każde żądanie ma limit 15 sekund. Tokeny nie trafiają do wyniku ani logów błędów.

W [Development Mode](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
właściciel aplikacji musi mieć Spotify Premium; dostęp podlega ograniczeniom quota.
Prawidłowe klucze i dostęp aplikacji trzeba potwierdzić rzeczywistym odczytem.

## Albumy, EP i kompletność

[Spotify nie ma osobnego typu EP](https://developer.spotify.com/documentation/web-api/reference/get-an-artists-albums).
Pobieramy grupy `album,single`. `album` kwalifikuje się domyślnie, `single` trafia
do `review`; dopiero jawne `--ep` kwalifikuje je jako EP. Nie zgadujemy po tytule,
liczbie utworów ani czasie trwania. Nie kwalifikujemy kompilacji i samych gościnnych udziałów.

`summary.complete_for_eligible_albums` dotyczy tylko albumów i potwierdzonych EP,
nie wszystkich pozycji `review`. `remaining_album_ids` pokazuje albumy pominięte
przez limit. Nieznany ID EP powoduje błąd. Różne edycje z różnymi Spotify ID pozostają
osobnymi wydawnictwami; powtarzające się ID w paginacji są scalane.

Tracklisty są pobierane do końca i porównywane z `total_tracks`. Brak identyfikatora,
niepełna lista lub powtórzona pozycja na tej samej płycie przerywa podgląd.
Zachowujemy wszystkich wykonawców w kolejności Spotify; nie interpretujemy tej
kolejności jako informacji o producencie ani potwierdzonej roli featuring.

## Kontrakt planu do zapisu

`schema_version: 1` oznacza format podglądu, nie wersję wdrożonej bazy.
`plan` zawiera logiczne referencje Spotify, które zapis rozwiązuje na liczbowe ID (`bigint`):

| Kolekcja | Klucz dopasowania / zasada |
| --- | --- |
| `artists` | `spotify_id`; `slug` tylko przy tworzeniu, zachowanie istniejącego sluga |
| `albums` | `spotify_id`; `primary_artist_spotify_id` wskazuje pierwszego artystę Spotify |
| `album_artists` | album + artysta; zachowanie kolejności w `position` |
| `tracks` | album + `disc_number` + `track_number`; Spotify ID utworu nie jest globalnym kluczem w tej tabeli |
| `track_artists` (kolekcja planu) | pozycja utworu w albumie + artysta; zapis do `spotify_track_artists`, kolejność w `position` |

Istniejąca tabela `track_artists` zawiera role redakcyjne `main`/`feature`.
Importer nie zmienia jej rekordów ani ograniczeń. Spotify nie dostarcza tego
podziału, dlatego jego uporządkowane referencje trafiają do `spotify_track_artists`.

Plan nie zawiera opisów redakcyjnych, ocen, komentarzy, dat utworzenia ani lokalnych ID.
Nie wolno nadpisywać tych pól reimportem. Dane zdjęcia są dostępne dla wskazanego
artysty; współautorzy mają tylko metadane z referencji. Brak `image_url` u współautora
oznacza brak pobrania zdjęcia, a nie polecenie jego usunięcia.

Spotify zwraca [daty z dokładnością roku, miesiąca lub dnia oraz numery płyt](https://developer.spotify.com/documentation/web-api/reference/get-an-album).
`release_date` jest pełną datą tylko dla dokładności `day`, w pozostałych przypadkach
ma wartość null. `release_date_raw` i `release_date_precision` zachowują oryginał.
Nie tworzymy fikcyjnych dat 1 stycznia. `disc_number` zachowuje poprawną numerację
tracklist wielopłytowych. Ten sam Spotify ID utworu może wystąpić na różnych albumach.

Rzeczywisty schemat sprawdzono przez SQL Editor 2026-09-08. Przygotowana migracja
[`202609080001_spotify_catalog.sql`](../supabase/migrations/202609080001_spotify_catalog.sql)
tworzy brakujące tabele katalogu, dodaje dokładność dat i numer płyty, relacje wykonawców,
indeksy oraz funkcje RPC. Nie zawiera żadnych danych początkowych. Zatrzymuje się przy
niezgodnych typach istniejących kolumn, zamiast konwertować lub zastępować dane.
Istniejące dodatkowe ograniczenia, np. globalne UNIQUE na `tracks.spotify_id` lub
UNIQUE na `(album_id, track_number)`, trzeba sprawdzić i osobno dostosować przed wdrożeniem.
Migracja nie usuwa ich automatycznie. Podgląd nie jest argumentem `supabase.upsert()`;
`prepareImport()` waliduje i mapuje go na wersjonowany kontrakt RPC.

Cały wybrany plan (artyści, albumy, tracklisty i relacje) jest zapisywany w jednej
transakcji `import_spotify_catalog`. Błąd dowolnej pozycji wycofuje całość. Importy
korzystają ze wspólnej blokady transakcyjnej, aby równoległe uruchomienia nie kolidowały.
Ponowienie zachowuje ID, istniejące slugi, opisy i zdjęcia współautorów, których nie pobrano.
Aktualizuje dane źródłowe i relacje wykonawców. Nie usuwa utworów: zniknięcie pozycji
lub zmiana Spotify ID utworu na istniejącej pozycji wymagają ręcznego uzgodnienia,
żeby nie przenieść opisów lub powiązań producentów na inny utwór.

Funkcje RPC są `security invoker` i dostępne tylko dla `service_role`.
Migracja włącza RLS i publiczny odczyt tabel katalogu. Nie otwiera publicznego zapisu;
przed wdrożeniem należy również przejrzeć istniejące polityki i granty tych tabel.

## Uruchomienie zapisu

1. Schemat projektu TAPEBASE porównano z migracją i odtworzono w testach.
   Dla innego projektu wykonaj nową inspekcję. Na TAPEBASE wdrożono ją 2026-09-08.
2. Wykonaj sprawdzoną migrację w Supabase SQL Editor. Plik jest objęty transakcją.
3. Dopisz `SUPABASE_SECRET_KEY` do `.env.local` (klucz backendu `sb_secret_…` z API Keys).
   Obsługiwany jest też starszy `SUPABASE_SERVICE_ROLE_KEY`. Nie używaj prefiksu
   `NEXT_PUBLIC_`; nie zastępuj publicznego klucza używanego przez aplikację.
4. Zweryfikuj wybrany plik, a następnie uruchom zapis:

```powershell
npm run spotify:import -- .local/spotify/quebonafide-preview.json
npm run spotify:import -- .local/spotify/quebonafide-preview.json --write
```

Pierwsze polecenie nie wykonuje żadnych połączeń sieciowych. Drugie sprawdza
`spotify_import_status()` i przesyła plan do transakcyjnej funkcji RPC.
Wynik `mode: written` zawiera liczbę przetworzonych artystów, albumów i utworów
(zarówno nowych, jak i już istniejących). Nie oznacza liczby nowych rekordów.
Po błędzie transportu wynik transakcji może być nieznany — sprawdź bazę przed ponowieniem.
Program nie ponawia automatycznie zapisu. Walidacja odrzuca niepełne tracklisty,
osierocone relacje, duplikaty i niepotwierdzone single.

Przy wyświetlaniu danych należy zachować odnośniki do Spotify, oznaczenie źródła
i oryginalną formę grafik, zgodnie z [wymaganiami Spotify](https://developer.spotify.com/documentation/web-api/reference/get-an-artists-albums).

## Weryfikacja Supabase i testy

```powershell
npm run supabase:inspect
npm run test:spotify
npx tsc --noEmit --incremental false
```

`supabase:inspect` odczytuje wyłącznie OpenAPI, bez rekordów. Preferuje skonfigurowany
klucz backendu; bez niego korzysta z publicznego klucza. Publiczny dostęp do metadanych
może zostać odrzucony niezależnie od działającego odczytu tabel.
Brak tabeli w wyniku nie rozstrzyga, czy tabela nie istnieje, czy jest niewidoczna.
Ten odczyt nie potwierdza polityk RLS ani wszystkich ograniczeń i indeksów.
Pełniejszy odczyt można wykonać w Supabase SQL Editor za pomocą
[`database-inspection.sql`](database-inspection.sql) — zawiera tylko zapytania SELECT.

Początkowy odczyt OpenAPI nie powiódł się z powodu błędu DNS `ENOTFOUND`.
Po wznowieniu projektu potwierdzono HTTP 200 dla odczytu `artists` z limitem 0.
OpenAPI z kluczem anon zwraca HTTP 401; z kluczem backendu działa. Potwierdzono liczbowe
ID (`bigint`), pola `is_verified` oraz istniejącą tabelę `track_artists` z polem `role`.
Raport z SQL Editor potwierdził ograniczenia, indeksy, polityki i role `main`/`feature`.
Migrację dostosowano: zachowuje tabelę ról, dodaje osobne `spotify_track_artists`
i wykorzystuje istniejący indeks unikalności albumów. Odtworzenie zastanego schematu
znajduje się w `scripts/spotify/fixtures/existing-catalog.sql`.
Po zatwierdzeniu wykonano migrację przez SQL Editor oraz zapis do Supabase 2026-09-08.
Nie używano `supabase db push`; przy przyszłym wprowadzeniu CLI należy uzgodnić jego
historię migracji z już wykonanym plikiem.
Po uzupełnieniu kluczy wykonano rzeczywisty podgląd dla Quebonafide
(`1fxbULcd6ryMNc1usHoP0R`, rynek PL): 60 wydawnictw, 9 zakwalifikowanych albumów,
5 albumów ze szczegółami i 73 utwory. Pozostałe 4 albumy pominięto zgodnie z limitem.
Pierwotny podgląd zakończył się kodem 0 bez zapisu. Zatwierdzoną paczkę następnie
zaimportowano do Supabase: **65 artystów, 5 albumów, 73 utwory**, 5 relacji albumów
i 156 relacji wykonawców utworów. Albumy: Ezoteryka, Eklektyka, ROMANTIC PSYCHO,
PÓŁNOC / POŁUDNIE, Dla fanek euforii. Wszystkie mają adresy okładek.
Ponowne uruchomienie `spotify:import --write` zakończyło się poprawnie. Porównanie
skrótów wszystkich rekordów pięciu tabel (poza `updated_at`) potwierdziło zachowanie
danych i ID. Odczyt SQL jako `anon` zwrócił cały katalog; anon i authenticated nie
mają uprawnienia wykonania importera, service_role je ma.
Pozycje typu `single`, w tym „Demówka EP”, pozostały na liście do ręcznego rozstrzygnięcia.
Testy transportu używają odpowiedzi HTTP w pamięci. Testy SQL uruchamiają PostgreSQL
w pamięci przez PGlite, bez połączenia z Supabase. Wykorzystują utrwalony wycinek
prawdziwego podglądu „Dla fanek euforii”; nie wstawiają danych testowych do projektu Supabase.
Sprawdzają uprawnienia, ponowny import, zachowanie ID i opisów, wycofanie całości
po późnym błędzie, częściowe daty oraz albumy wielopłytowe.
29 testów przeszło na pustym i odtworzonym istniejącym schemacie, w tym zachowanie
redakcyjnych ról i `is_verified`. TypeScript i lint skryptów przeszły poprawnie.
Całą lokalną paczkę 5 albumów sprawdzono dodatkowo w PGlite: 65 artystów,
73 utwory i 156 relacji wykonawców utworów. Ponowny import zachował wszystkie
rekordy i identyfikatory. Ta próba nie łączyła się z Supabase.

Kolejny zatwierdzony import wykonano 2026-09-08 z pełnym limitem albumów dla sześciu
profili. Quebonafide ma 9 albumów, Deys 11, Białas 21, Mata 4, Bedoes 2115 5,
a Kaz Bałagane 12. Wszystkie sześć podglądów było kompletne dla wydań Spotify typu
`album` i przeszło walidację przed zapisem. Baza po imporcie zawiera 279 artystów,
62 albumy i 1036 utworów. Wieloutworowe wydania typu `single` pozostały w review
do osobnej kwalifikacji EP.
