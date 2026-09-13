# Supabase Auth i funkcje społecznościowe

Stan wdrożenia: 2026-09-08. Kod aplikacji i migracja
`202609080002_auth_community.sql` są wdrożone i zweryfikowane na Supabase.

## Zakres

- rejestracja i logowanie e-mailem oraz hasłem przez Supabase Auth,
- odzyskiwanie hasła przez jednorazowy link wysyłany przez Supabase,
- sesja w cookies dla Next.js 16 przez `@supabase/ssr` i `proxy.ts`,
- publiczne profile bez ujawniania adresów e-mail,
- jedna ocena albumu oraz jedna ocena artysty na użytkownika, skala 1–10 i krok 0,5,
- automatyczne oznaczenie albumu jako „Posłuchane” po wystawieniu oceny,
- komentarze o długości 1–2000 znaków oraz edycja i usuwanie własnych komentarzy,
- jedno polubienie cudzego komentarza na użytkownika z możliwością cofnięcia,
- prywatne listy „Posłuchane” i „Chcę posłuchać”,
- strona profilu z osobnymi ocenami albumów i artystów, komentarzami, statystykami oraz obiema listami,
- publiczny profil pod `/u/[username]` i przejście do niego z autora komentarza,
- edycja nazwy oraz przesyłanie avatara JPG, PNG, WebP lub GIF do 2 MB.

Każda akcja serwerowa ponownie sprawdza podpisane claims użytkownika. Ograniczenia
zapisu są również egzekwowane w PostgreSQL przez RLS, więc przesłanie zmienionego
formularza nie pozwala zapisać danych innej osoby. Użytkownik nie może ustawić sobie
roli administracyjnej; z aplikacji może zmieniać tylko nazwę i avatar profilu.

Migracja `202609080003_comment_likes.sql` dodaje polubienia komentarzy oraz publiczny
widok zbiorczy ocen używany przez ranking Top 10 na stronie głównej. RLS blokuje
polubienie własnego komentarza i zmianę polubienia należącego do innego użytkownika.

Migracja `202609080004_artist_ratings.sql` dodaje oceny artystów oraz dwa publiczne
widoki zbiorcze. Pierwszy oblicza średnią bezpośrednich ocen artysty, a drugi średnią
z ocenionych albumów przypisanych do artysty. Obie wartości są prezentowane osobno
na profilu artysty. RLS pozwala użytkownikowi zapisywać wyłącznie własną ocenę.

## Zastany schemat

Migracja `202609090005_public_profiles.sql` udostępnia publiczny odczyt listy
„Posłuchane” i tworzy publiczny bucket `avatars`. Zapis, zmiana i usunięcie pliku
są ograniczone przez RLS do katalogu nazwanego UUID zalogowanego użytkownika.

Inspekcja SQL Editor wykazała puste tabele `users`, `ratings`, `comments`, `listened`
i `want_to_listen`. Wszystkie miały `bigint` w `user_id`, włączone RLS i zero polityk.
`auth.users` również było puste. Migracja ma bezpiecznik i przerwie się, jeśli któraś
z pięciu tabel społecznościowych przestanie być pusta przed wdrożeniem.

## Potwierdzanie e-maila

W projekcie Supabase rejestracja, dostawca Email i obowiązkowe potwierdzanie adresu
są włączone. `Site URL` ma wartość `http://localhost:3000`. Domyślny szablon maila
używa `{{ .ConfirmationURL }}`. Po kliknięciu linku użytkownik potwierdza adres,
wraca do aplikacji, a następnie loguje się hasłem. Własny callback `/auth/confirm`
jest przygotowany na późniejsze przejście do szablonu SSR z token hash.

## Resetowanie hasła

Formularz `/reset-hasla` wysyła wiadomość bez ujawniania, czy podany adres ma
konto. Link wraca przez `/auth/callback`, gdzie kod PKCE jest wymieniany na sesję
odzyskiwania, a `/ustaw-haslo` pozwala ustawić nowe hasło. Po zmianie hasła wszystkie
sesje użytkownika są wylogowywane i można zalogować się nowym hasłem.

W lokalnej konfiguracji Supabase są dozwolone oba adresy używane przez serwer
deweloperski:

- `http://localhost:3000/auth/callback?next=/ustaw-haslo`
- `http://127.0.0.1:3000/auth/callback?next=/ustaw-haslo`

Aplikacja wybiera adres zgodny z hostem bieżącej strony. Dla wdrożenia należy ustawić
`NEXT_PUBLIC_SITE_URL` i dodać odpowiadający mu callback do Redirect URLs w Supabase.

## Weryfikacja lokalna

`npm run test:community` wykonuje migrację w jednorazowej bazie PGlite i sprawdza
typy UUID, trigger profilu, RLS, oceny albumów i artystów, komentarze, obie listy oraz bezpiecznik przed
utratą danych. Produkcyjny build sprawdza też typy wszystkich Server Actions i tras.
