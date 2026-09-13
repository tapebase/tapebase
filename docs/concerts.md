# Koncerty i bilety

TAPEBASE pobiera nadchodzące wydarzenia muzyczne w Polsce z Ticketmaster Discovery
API. Koncert jest osobnym bytem od oferty biletowej: jeden koncert może należeć do
wielu artystów i mieć wiele ofert od różnych sprzedawców. Pierwsza integracja zapisuje
ofertę Ticketmaster; model danych pozwala później dodać kolejnych partnerów bez
duplikowania wydarzeń.

## Konfiguracja

Backend wymaga `TICKETMASTER_API_KEY`. Klucz nie jest wysyłany do przeglądarki.
Administrator uruchamia kolejną partię z `/admin/koncerty`. Jedna partia sprawdza
domyślnie 20 artystów, zapisuje kursor w Supabase i przy następnym uruchomieniu
kontynuuje od kolejnego profilu.

Okresową synchronizację można wywoływać żądaniem `GET /api/cron/concerts` z nagłówkiem
`Authorization: Bearer <CONCERT_SYNC_SECRET>`. Wielkość partii ustala opcjonalne
`CONCERT_SYNC_BATCH_SIZE` w zakresie 1–50. Harmonogram należy skonfigurować dopiero
na wybranym hostingu.

Jednocześnie działa jeden przebieg. Niedokończony przebieg starszy niż 15 minut jest
oznaczany jako przerwany, dzięki czemu synchronizacja może ruszyć po restarcie.
Wyszukiwanie po nazwie akceptuje wyłącznie dokładnie znormalizowane dopasowanie
atrakcji Ticketmaster. Po pierwszym trafieniu zapisywany jest identyfikator atrakcji,
który jest używany w kolejnych przebiegach.

Nie ma formularza społecznościowego do dodawania koncertów. Dane trafiają do serwisu
wyłącznie przez kontrolowaną synchronizację administratora lub endpoint okresowy.
