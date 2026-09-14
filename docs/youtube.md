# Teledyski YouTube

TAPEBASE korzysta z YouTube Data API v3 wyłącznie po stronie serwera. W bazie
przechowuje identyfikatory filmów, metadane potrzebne do prezentacji i decyzje
moderacyjne. Nie pobiera ani nie hostuje obrazu lub dźwięku z filmów.

## Konfiguracja

Backend wymaga `YOUTUBE_API_KEY`. Klucz powinien być ograniczony w Google Cloud
wyłącznie do YouTube Data API v3. Endpoint okresowy wymaga osobnego
`YOUTUBE_SYNC_SECRET`; wielkość partii określa `YOUTUBE_SYNC_BATCH_SIZE` (1–20).

## Synchronizacja

Pełny profil artysty (`catalog_visible = true`) trafia automatycznie do tabeli
`artist_youtube_sync`. Worker wykonuje najwyżej jedno `search.list` na artystę,
pobiera szczegóły kandydatów zbiorczym `videos.list`, a kolejne wyszukiwanie
planuje po siedmiu dniach.

Wewnętrzny limit wynosi 50 wyszukiwań na dzień UTC. Rezerwacja limitu odbywa się
atomowo w bazie. Metadane już znanych filmów są odświeżane partiami co 24 godziny,
a publiczna funkcja nie pokazuje danych starszych niż 30 dni.

## Dopasowanie i moderacja

Kanał wskazany przez właściwość Wikidata P2397 zaakceptowanego rekordu artysty
jest zaufany automatycznie. Kanały znalezione wyłącznie przez wyszukiwanie czekają
na administratora, jeśli dopasowanie osiągnęło co najmniej 40% pewności. Wyjątkiem
jest kanał potwierdzony przez co najmniej trzy różne utwory i trzy tytuły zawierające
nazwę artysty albo kanał nazwany dokładnie jak artysta potwierdzony dwoma utworami.
Takie powtarzalne dopasowanie może zostać zweryfikowane automatycznie. Słabsze
dopasowanie filmu nadal pozostaje dostępne do niezależnej oceny. Film może zostać
opublikowany automatycznie tylko wtedy, gdy
pochodzi ze zweryfikowanego kanału, pasuje do utworu w katalogu i nie nosi cech
audio, lyric video, visualizera, koncertu, wywiadu, reakcji ani materiału fanowskiego.

Panel `/admin/teledyski` pozwala zatwierdzać kanały i filmy, opcjonalnie dopisać
powód odrzucenia oraz ręcznie dodać jednoznaczny Channel ID lub Video ID.
Zatwierdzenie kanału od razu publikuje zapisane klipy, które pasują do utworu i
mają nazwę artysty w tytule albo nazwie kanału; nie wymaga kolejnego
wywołania API.

## Wyświetlanie

Profil artysty pobiera maksymalnie pięć zaakceptowanych filmów z Supabase,
posortowanych według aktualnej liczby wyświetleń. Odtwarzacz YouTube IFrame Player
API jest ładowany dopiero po kliknięciu miniatury.
