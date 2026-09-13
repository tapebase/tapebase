# TAPEBASE ROADMAP

## PHASE 1 - Frontend Foundation

* [x] Next.js setup
* [x] GitHub repository
* [x] First homepage
* [ ] Homepage redesign
* [x] Dark mode wybierany w opcjach profilu i zapamiętywany na urządzeniu
* [x] Album page (dane katalogu, tracklista i wykonawcy)
* [x] Artist page (wydawnictwa i utwory z udziałem)
* [x] Rankings page (TOP artyści i TOP albumy)
* [x] User profile page (edycja, avatar, aktywność i profil publiczny)
* [x] Biografie artystów zgłaszane przez użytkowników, moderowane i podpisane nickiem autora

---

## PHASE 2 - Backend

* [x] Supabase setup
* [x] PostgreSQL database
* [x] User authentication
* [x] Database schema

---

## PHASE 3 - Spotify

Stan 2026-09-08: przygotowano klienta API, lokalny podgląd importu oraz testy
bez sieci. Odczyt z prawdziwymi kluczami potwierdzono dla Quebonafide
(9 albumów, 120 utworów). Migrację wdrożono; importy Quebonafide, Deysa, Białasa,
Maty, Bedoesa 2115 i Kaz Bałagane zapisały łącznie 279 wykonawców, 62 albumy i 1036
utworów bez duplikatów. Potwierdzono publiczny odczyt
oraz ograniczenie importu do backendu. Widoki korzystają z Supabase: strona główna,
listy i szczegóły albumów/artystów, wyszukiwanie i paginacja.
Szczegóły: [catalog-ui.md](catalog-ui.md).
Instrukcja: [spotify-import.md](spotify-import.md).

* [x] Client Credentials, paginacja i obsługa błędów
* [x] Lokalny podgląd artysty, albumów, potwierdzonych EP i tracklist
* [x] Mapowanie dat, płyt, wykonawców i plan kluczy reimportu
* [x] Weryfikacja odczytu Spotify z prawdziwymi kluczami
* [x] Walidacja podglądu i lokalne polecenie zapisu przez RPC
* [x] Projekt migracji i transakcyjny import, sprawdzone lokalnie w PostgreSQL/PGlite
* [x] Potwierdzenie zdalnego schematu Supabase i przygotowanie migracji
* [x] Próba całej paczki 5 albumów w lokalnym PostgreSQL i reimport bez duplikatów
* [x] Wdrożenie migracji na Supabase i pierwszy import prawdziwych danych
* [x] Weryfikacja reimportu oraz publicznego odczytu na zdalnej bazie

* [x] Spotify API integration
* [x] Artist import
* [x] Album import
* [x] Track import
* [x] Cover import (adresy oryginalnych grafik)
* [x] Wyświetlanie zaimportowanego katalogu na stronach aplikacji
* [x] Pozostałe 4 zakwalifikowane albumy Quebonafide
* [ ] Ręczna kwalifikacja EP oznaczonych przez Spotify jako `single`

---

## PHASE 4 - Community

* [x] Ratings
* [x] Oceny artystów i osobna średnia ocen albumów na profilu artysty
* [x] Comments
* [x] Edycja komentarzy i polubienia cudzych komentarzy
* [x] Odpowiedzi i wielopoziomowe wątki dyskusji
* [x] Powiadomienia o odpowiedziach i polubieniach komentarzy
* [x] Zgłaszanie komentarzy do moderacji
* [x] Ranking Top 10 albumów według ocen
* [x] Listened
* [x] Want to listen

---

## PHASE 5 - Rankings

* [x] Album rankings
* [x] Artist rankings
* [x] Year rankings
* [x] EP rankings
* [x] Filtrowanie rankingu albumów według głównego gatunku i lata od 1970
* [ ] Włączenie minimalnego progu głosów po zebraniu większej społeczności
* [x] Ranking najczęściej ocenianych albumów z ostatnich 7 dni na stronie głównej
* [x] Ostatnie komentarze społeczności z oceną i linkiem do dyskusji na stronie głównej
* [x] Ranking TOP 10 aktywnych użytkowników z ostatnich 30 dni na stronie głównej
* [x] Podział katalogu i rankingów na artystów z Polski i z zagranicy
* [x] Ukrywanie technicznych profili współwykonawców do czasu pełnego importu artysty
* [x] Globalna stopka oraz podstawowe strony informacyjne przed testami

---

## PHASE 6 - Admin

* [x] Panel kolejkowego importu do 20 artystów ze Spotify z wyborem albumów
* [x] Zgłoszenia albumów i artystów od użytkowników z moderacją
* [x] Trwała kolejka importu, checkpoint każdego albumu i wznowienie po HTTP 429
* [x] Podstawowe dane albumów zapisywane przed pobieraniem kompletnych tracklist
* [x] Powiadomienia o akceptacji, odrzuceniu i zakończonym imporcie
* [x] Trwałe dzierżawy importu, limit równoległości i odzyskiwanie po restarcie
* [x] Terminy ponowień po HTTP 429 i błędy przypisane do konkretnych albumów
* [x] Wykrywanie duplikatów i możliwych innych edycji w moderacji
* [x] Oznaczanie EP, obowiązkowy powód odrzucenia i historia administratorów
* [x] Osobna strona powiadomień, bezpośrednie odnośniki i licznik w menu
* [ ] Automatyczne okresowe uruchamianie kolejki bez otwierania panelu
* [x] Zarządzanie rolami i zawieszanie kont użytkowników
* [x] Wybór pochodzenia artysty w zgłoszeniu, moderacji i importerze administratora
* [x] Główny gatunek albumu i sugestia importera na podstawie etykiet artysty ze Spotify
* [x] Moderacja zgłoszonych komentarzy
* [x] Panel zgłoszeń błędów i pomysłów testerów
* [x] Automatyczne uzupełnianie danych artystów z Wikidata i dokładnych relacji MusicBrainz
* [x] Ręczna kolejka weryfikacji niepewnych dopasowań artystów
* [x] Enrichment istniejącego katalogu uruchamiany partiami przez administratora

---

## PHASE 7 - Launch

* [ ] Production deployment
* [ ] SEO
* [ ] Analytics
* [ ] Public beta
* [x] Jednorazowe wdrożenie użytkownika po pierwszej rejestracji
* [x] Administracyjny pulpit użytkowników, aktywności, katalogu i importów
* [ ] Analityka odsłon i źródeł ruchu skonfigurowana na hostingu

---

## PHASE 8 - Koncerty i bilety

* [x] Model koncertów, wielu wykonawców i ofert biletowych
* [x] Synchronizacja Ticketmaster partiami z zapisanym postępem i historią
* [x] Najbliższe koncerty oraz odnośniki do biletów na profilu artysty
* [x] Panel administratora i zabezpieczony endpoint do okresowej synchronizacji
* [ ] Konfiguracja harmonogramu po wyborze hostingu produkcyjnego
* [ ] Kolejni oficjalni partnerzy biletowi
* [ ] Zgłoszenia koncertów przez społeczność (odłożone)
