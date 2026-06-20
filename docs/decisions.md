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

## Strona główna

- Nie robimy ręcznej sekcji Premiery w MVP.
- Zamiast tego robimy Ostatnio dodane.
- Ranking artystów dodamy później po podłączeniu bazy danych.

## Użytkownicy

- Role: user, admin, verified_artist, verified_producer.
- Zweryfikowani artyści i producenci będą mieć plakietki.

## Featy i grupy

- Przewidujemy featuringi na poziomie tracków.
- Przewidujemy relacje grupa ↔ członkowie.
- Profil artysty ma w przyszłości pokazywać własne albumy i gościnne występy.

## UI

- Jasny motyw od początku.
- Ciemny motyw od początku.
- Projektujemy mobile-first.