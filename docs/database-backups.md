# Kopie zapasowe bazy TAPEBASE

## Zakres

Workflow `.github/workflows/database-backup.yml` wykonuje logiczny eksport Supabase:

- ról bazy (`roles.sql`),
- schematu, funkcji, polityk RLS i wyzwalaczy (`schema.sql`),
- danych, w tym rekordów użytkowników Auth (`data.sql`).

Pliki są pakowane, szyfrowane AES-256-CBC z PBKDF2 i przechowywane jako artefakt GitHub Actions przez 30 dni. Repozytorium jest publiczne, dlatego jawne pliki SQL nigdy nie są przesyłane do GitHub.

Harmonogram:

- codziennie o 02:15 UTC: eksport, szyfrowanie i kontrola sum SHA-256,
- w niedzielę o 02:45 UTC: dodatkowo pełna próba odtworzenia w odizolowanym lokalnym Supabase,
- ręczne uruchomienie: eksport oraz pełna próba odtworzenia.

Próba lokalna odtwarza schemat i dane aplikacji. Plik `roles.sql` jest objęty sumą kontrolną i pozostaje w kopii, ale nie jest odtwarzany lokalnie, ponieważ lokalny Supabase ma już własne chronione role systemowe (między innymi `supabase_admin`).

## Wymagane sekrety GitHub

W ustawieniach repozytorium `Settings → Secrets and variables → Actions` należy dodać:

- `SUPABASE_DB_URL` — adres **Session pooler** skopiowany z `Supabase → Connect`, z aktualnym hasłem bazy; całe hasło w URL musi być zakodowane procentowo,
- `BACKUP_ENCRYPTION_KEY` — losowy sekret o długości co najmniej 32 znaków, używany wyłącznie do kopii.

Sekretów nie wolno dopisywać do `.env.local`, dokumentacji ani historii Git.

## Kontrola działania

Po konfiguracji uruchom workflow ręcznie. Poprawny przebieg musi zakończyć wszystkie kroki, w tym `Restore drill in an isolated Supabase`, i utworzyć artefakt `tapebase-database-<run_id>` zawierający wyłącznie:

- `database-backup.tar.gz.enc`,
- `database-backup.tar.gz.enc.sha256`.

Nie należy uznawać samego powstania pliku za udaną kopię. Ostatnie ręczne lub niedzielne uruchomienie próby odtworzenia również musi mieć status zielony.

## Ręczne odzyskiwanie

1. Wstrzymaj zapisy do produkcji i ustal moment kopii sprzed awarii.
2. Pobierz właściwy artefakt z GitHub Actions i sprawdź jego SHA-256.
3. Odtwórz kopię najpierw do nowego, pustego projektu Supabase. Nie testuj na produkcji.
4. Odszyfruj pakiet tym samym `BACKUP_ENCRYPTION_KEY`:

   ```bash
   openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
     -in database-backup.tar.gz.enc -out database-backup.tar.gz \
     -pass env:BACKUP_ENCRYPTION_KEY
   mkdir restored && tar -C restored -xzf database-backup.tar.gz
   cd restored && sha256sum -c SHA256SUMS
   ```

5. W nowym projekcie wykonaj oficjalną kolejność Supabase:

   ```bash
   psql --single-transaction --variable ON_ERROR_STOP=1 \
     --file roles.sql --file schema.sql \
     --command "SET session_replication_role = replica" \
     --file data.sql --dbname "$NEW_SUPABASE_DB_URL"
   ```

6. Sprawdź logowanie, liczbę użytkowników, artystów, albumów, ocen, komentarzy i playlist.
7. Dopiero po tej kontroli przełącz aplikację na odzyskany projekt albo zaplanuj kontrolowane odtworzenie produkcji.

## Ograniczenie

Kopia bazy zawiera metadane Supabase Storage, ale nie same pliki z bucketów, na przykład avatarów i okładek playlist. Pliki Storage wymagają osobnej kopii obiektowej.
