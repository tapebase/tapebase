# TAPEBASE DECISIONS

## Core

- Album jest głównym bytem serwisu.
- Startujemy od polskiego rapu.
- Spotify API jest głównym źródłem danych.
- Importujemy albumy i EP.
- Single nie są częścią MVP.
- Mixtape traktujemy tymczasowo jako album.

## Oceny

- Skala ocen: 1–10.
- Krok ocen: 0.5.
- Ocena automatycznie oznacza album jako Posłuchane.
- Rankingi liczymy średnią ważoną w stylu Filmwebu.
- Mechanizm minimalnej liczby głosów pozostaje przygotowany w kodzie, ale w okresie
  testów ranking pokazuje pozycje już od jednej oceny i nie udostępnia tego filtra.
- Ranking albumów można filtrować po roku, rodzaju wydawnictwa i głównym gatunku.
- Lista lat w rankingu obejmuje zawsze co najmniej okres od bieżącego roku do 1970,
  również zanim katalog będzie miał wydawnictwa z każdego roku.

## Strona główna

- Nie robimy ręcznej sekcji Premiery w MVP.
- Zamiast tego robimy Ostatnio dodane.
- Ranking artystów dodamy później po podłączeniu bazy danych.
- Ranking aktywnych użytkowników pokazuje TOP 10 z ostatnich 30 dni. Zaimportowany
  album daje 5 punktów, recenzja albumu 3 punkty, a ocena albumu 1 punkt. Wyświetlamy
  również surowe liczniki, aby zasada kolejności była czytelna.

## Użytkownicy

- Role: user, admin, verified_artist, verified_producer.
- Zweryfikowani artyści i producenci będą mieć plakietki.
- Komentarze tworzą wielopoziomowe dyskusje. Odpowiedź zawsze należy do tego
  samego albumu co komentarz nadrzędny.

## Administracja

- Import Spotify jest dostępny w panelu tylko dla kont z rolą `admin`.
- Panel zawsze pokazuje zakres importu przed zapisem. Sekrety Spotify i Supabase
  pozostają na serwerze, a każda akcja ponownie sprawdza rolę użytkownika.
- EP oznaczone przez Spotify jako `single` nadal wymagają jawnego wskazania.
- Jedna kolejka panelu może zawierać 1–20 artystów. Administrator może przed
  zapisem odznaczyć całego artystę lub pojedyncze albumy. Każdy artysta jest
  zapisywany w osobnej transakcji, a panel pokazuje osobny wynik każdej pozycji.
- Podgląd kolejki jest przechowywany przez 20 minut po stronie serwera i przypisany
  do administratora. Pierwszy krok pobiera tylko artystę i listę wydań. Szczegóły
  albumów i tracklisty są pobierane dopiero dla pozycji wybranych do importu, bez
  ponownego odczytu całych dyskografii. Klient rozkłada wywołania Spotify w czasie
  i odróżnia limit szybkości od wyczerpania puli Development Mode.

## Featy i grupy

- Przewidujemy featuringi na poziomie tracków.
- Przewidujemy relacje grupa ↔ członkowie.
- Profil artysty ma w przyszłości pokazywać własne albumy i gościnne występy.

## UI

- Jasny motyw od początku.
- Ciemny motyw od początku.
- Projektujemy mobile-first.

## Spotify — przygotowanie importu (2026-09-08)

- Pierwszy etap to lokalny podgląd JSON bez zapisu do Supabase.
- Client Credentials i sekrety pozostają poza kodem przeglądarki.
- EP potwierdzamy jawnie; typ `single` ze Spotify nie kwalifikuje się automatycznie.
- Zachowujemy dokładność dat, numery płyt i wszystkich wykonawców.
- Albumy i artyści są dopasowywani po Spotify ID, pozycje tracklisty po albumie,
  numerze płyty i numerze utworu. Różne edycje albumu pozostają osobne.
- Przy reimporcie zachowujemy opisy redakcyjne i istniejące slugi.
- Migrację porównano z rzeczywistym schematem przez SQL Editor i sprawdzono na jego
  lokalnym odtworzeniu. Po zatwierdzeniu wdrożono ją przez SQL Editor 2026-09-08;
  pierwszy import i ponowienie na Supabase zakończyły się poprawnie.
- `track_artists` zachowuje redakcyjne role `main`/`feature`. Kolejność wykonawców
  ze Spotify trafia do osobnej tabeli `spotify_track_artists`; nie zgadujemy ról.
- Zapis całego wybranego planu wykonuje jedna transakcja RPC dostępna tylko dla backendu.
- Zniknięcie pozycji tracklisty lub zmiana jej tożsamości wymaga ręcznego uzgodnienia;
  importer nie usuwa utworów ani nie przenosi powiązań redakcyjnych na inne nagrania.
- Szczegóły: [spotify-import.md](spotify-import.md).

## Widoki katalogu (2026-09-08)

- Zachowujemy istniejący jasny układ i podłączamy go do publicznego odczytu Supabase.
- Szczegóły albumu i artysty mają osobne adresy ze slugiem; `/album` i `/artist` są listami.
- Statyczne oceny i komentarze zastępujemy informacją o planowanych funkcjach.
- Kolejność Spotify nie oznacza featuringów; profil pokazuje „Utwory z udziałem”.
- Daty zachowują dokładność źródła, a grafiki proporcje i odnośniki do Spotify.
- Szczegóły i weryfikacja: [catalog-ui.md](catalog-ui.md).

## Auth i społeczność (2026-09-08)

- Konta i sesje obsługuje Supabase Auth z potwierdzaniem adresu e-mail.
- `public.users.id` jest UUID powiązanym 1:1 z `auth.users.id`; e-mail pozostaje
  wyłącznie w prywatnym schemacie Auth.
- Publiczne są profile, oceny i komentarze. Listy „Posłuchane” i „Chcę posłuchać”
  może odczytać tylko ich właściciel.
- RLS sprawdza `auth.uid()` przy każdym zapisie. Użytkownik może zmieniać tylko
  własną nazwę i avatar, bez możliwości nadania sobie roli.
- Ocena automatycznie dodaje album do „Posłuchane”, a oznaczenie jako posłuchany
  usuwa go z listy „Chcę posłuchać”.
- Szczegóły i testy: [auth-community.md](auth-community.md).
## Zgłoszenia katalogowe od użytkowników

- Spotify pozostaje podstawowym źródłem metadanych dla polskiego rapu.
- Użytkownik zgłasza link do artysty lub albumu; oEmbed dostarcza lekki podgląd,
  a pełne Web API jest używane dopiero podczas importu zatwierdzonej pozycji.
- Jedna pozycja ma wielu zgłaszających. Kolejne zgłoszenie zwiększa priorytet zamiast
  tworzyć duplikat.
- Moderacja i import są rozdzielone, aby wyczerpanie puli Spotify nie blokowało
  przyjmowania nowych propozycji.
- Akceptacja tworzy trwałe zadanie w Supabase. Każdy album ma osobny checkpoint,
  więc błąd lub limit HTTP 429 nie cofa ukończonych pozycji.
- Zadanie jest przejmowane atomowo z pięciominutową dzierżawą. Jednocześnie działa
  najwyżej jeden import, a wygasła dzierżawa przywraca pracę przerwaną restartem.
- Po HTTP 429 zapisujemy termin kolejnej próby. Błędy są przechowywane przy
  konkretnych albumach wraz z liczbą i czasem prób.
- Przy imporcie artysty najpierw zapisujemy karty artysty i albumów, a kompletne
  tracklisty uzupełniamy partiami. Administrator wznawia tę samą kolejkę jednym
  przyciskiem po odnowieniu puli Spotify.
- Zgłaszający otrzymuje na stronie `/powiadomienia` powiadomienie o akceptacji,
  odrzuceniu oraz zakończeniu importu. Licznik nieprzeczytanych wpisów jest widoczny
  w menu, a odnośnik prowadzi do zgłoszenia lub gotowej pozycji katalogu.
- Moderator przed decyzją widzi dokładny duplikat i możliwe inne edycje albumu,
  wybiera typ album/EP, a przy odrzuceniu podaje obowiązkowy powód. Każda decyzja
  trafia do historii administracyjnej.
- Wykonawca utworzony wyłącznie jako credit albumu lub utworu jest profilem
  technicznym. Sam wpis w `artists` nie blokuje zgłoszenia jego pełnego profilu;
  blokadę włączamy dopiero po zakończonym imporcie zgłoszenia tego artysty.
- Profil techniczny zachowuje bezpośrednią stronę oraz linki z albumów i tracklist,
  ale nie pojawia się w wyszukiwarce, katalogu, rankingach ani synchronizacji
  koncertów. Pełny import artysty ustawia `catalog_visible` i publikuje go w tych
  miejscach; brak zdjęcia nie służy jako bieżące kryterium widoczności.

## Narzędzia zamkniętych testów (2026-09-10)

- Zalogowany tester może wysłać błąd lub pomysł wraz z adresem bieżącej strony;
  zgłoszenia trafiają do osobnej kolejki administratora.
- Użytkownik może zgłosić cudzy komentarz. Moderator ukrywa komentarz z powodem,
  przywraca go albo odrzuca raport bez usuwania treści z bazy.
- Odpowiedzi i polubienia tworzą prywatne powiadomienia prowadzące do konkretnego
  komentarza. Cofnięcie polubienia usuwa odpowiadające mu powiadomienie.
- Administrator zmienia role i zawiesza konta przez funkcję RPC. Zawieszenie blokuje
  logowanie i wszystkie zapisy chronione przez RLS, a administrator nie może zawiesić
  ani zdegradować własnego konta.
- Nowe konto po pierwszym uwierzytelnieniu przechodzi krótki ekran powitalny i dopiero
  potem wraca do pierwotnie wybranej strony.

## Koncerty i bilety (2026-09-11)

- Koncert i oferta biletowa są osobnymi bytami; jeden koncert może mieć wielu
  wykonawców oraz oferty wielu partnerów.
- Pierwszym źródłem jest Ticketmaster Discovery API ograniczone do wydarzeń
  muzycznych w Polsce. Klucz pozostaje wyłącznie na backendzie.
- Synchronizacja działa partiami, zapisuje kursor i historię przebiegów oraz blokuje
  drugi równoczesny proces. Profil artysty pokazuje najbliższe terminy i bezpośredni
  odnośnik do oficjalnej oferty.
- Nie udostępniamy na tym etapie społecznościowego dodawania koncertów.
- Szczegóły konfiguracji: [concerts.md](concerts.md).

## Statystyki administracyjne (2026-09-11)

- Przed testami mierzymy rejestracje, aktywność społeczności, wielkość katalogu,
  zgłoszenia i stan importów bez zapisywania dodatkowych danych śledzących.
- Aktywny użytkownik wykonał działanie społecznościowe: ocenę, komentarz,
  polubienie komentarza albo poparcie zgłoszenia.
- Odsłony, źródła ruchu i rodzaje urządzeń podłączymy przy wdrożeniu na hosting,
  aby ruch lokalny nie zanieczyszczał statystyk testerów.

## Pochodzenie artystów (2026-09-11)

- Spotify Web API nie udostępnia wiarygodnego kraju pochodzenia artysty, dlatego
  pochodzenie wybiera zgłaszający lub administrator i moderator może je poprawić.
- Katalog oraz rankingi można filtrować według Polski i zagranicy. Kod `ZZ` oznacza
  zagranicę bez wskazania dokładnego kraju i pozwala później przejść na pełne kody ISO.
- Widoki artystów i rankingów domyślnie otwierają kategorię Polska; użytkownik może
  przełączyć je na zagranicę albo pełny katalog.
- Wszystkie profile istniejące w chwili wdrożenia migracji otrzymują `PL`, zgodnie
  z obecnym zakresem katalogu. Nowe techniczne profile gości pozostają bez kraju do
  czasu pełnego importu albo decyzji moderatora.

## Główne gatunki albumów (2026-09-11)

- Album ma jeden główny gatunek TAPEBASE: Rap, Pop, Rock, Elektronika, R&B / Soul,
  Metal, Jazz, Reggae, Folk / Country, Muzyka klasyczna albo Inne.
- Zgłaszający wybiera gatunek, a administrator może go poprawić w moderacji.
- Masowy importer sugeruje gatunek z etykiet artysty zwróconych przez Spotify i
  pokazuje administratorowi etykiety źródłowe. Sugestia nigdy nie blokuje ręcznej zmiany.
- Gatunek artysty jest tylko wskazówką dla jego wydawnictw. Nie traktujemy typu
  `album`, `single` lub `compilation` ze Spotify jako gatunku muzycznego.
- Istniejący katalog otrzymuje Rap, zgodnie z dotychczasowym zakresem polskiego rapu.
