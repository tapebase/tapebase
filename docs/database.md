# TAPEBASE DATABASE V1

## users

Przechowuje konta użytkowników.

Pola:

* id
* username
* email
* password_hash
* avatar_url
* role
* created_at
* updated_at

Role:

* user
* admin
* verified_artist
* verified_producer

---

## artists

Artyści muzyczni.

Pola:

* id
* spotify_id
* name
* slug
* image_url
* description
* created_at
* updated_at

---

## albums

Główny byt systemu.

Pola:

* id
* spotify_id
* artist_id
* title
* slug
* cover_url
* release_date
* album_type
* description
* created_at
* updated_at

album_type:

* album
* ep

Mixtape w MVP zapisujemy jako album.

---

## tracks

Tracklista albumów.

Pola:

* id
* album_id
* title
* track_number
* duration_ms
* spotify_id

---

## ratings

Oceny użytkowników.

Pola:

* id
* user_id
* album_id
* rating
* created_at
* updated_at

Zakres:

1.0 - 10.0

Krok:

0.5

Jeden użytkownik może mieć jedną aktywną ocenę albumu.

---

## comments

Komentarze pod albumami.

Pola:

* id
* user_id
* album_id
* content
* created_at
* updated_at

---

## listened

Albumy oznaczone jako przesłuchane.

Pola:

* id
* user_id
* album_id
* created_at

Ocena albumu automatycznie dodaje wpis tutaj.

---

## want_to_listen

Lista „Chcę posłuchać”.

Pola:

* id
* user_id
* album_id
* created_at

---

## producers

Producenci muzyczni.

Pola:

* id
* name
* slug
* description

---

## track_producers

Relacja producent → track.

Pola:

* id
* producer_id
* track_id

---

## przyszłość

Planowane tabele:

* notifications
* likes
* comment_replies
* artist_followers
* user_followers
* reports
* moderation_logs
