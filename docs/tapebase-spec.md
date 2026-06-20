# TAPEBASE SPEC

## Cel projektu

TAPEBASE to Filmweb dla muzyki.

Pierwsza wersja skupia się na polskim rapie.

Głównym bohaterem serwisu jest album.

## Źródło danych

Główne źródło danych: Spotify API.

Importujemy:
- artystów
- albumy
- EP
- okładki
- daty wydania
- tracklisty
- Spotify ID

Na start nie importujemy singli.

## Typy wydawnictw

- Album
- EP
- Mixtape traktowany tymczasowo jako Album

## Oceny

Skala ocen: 1–10.

Krok: 0.5.

Ocena albumu automatycznie oznacza album jako „Posłuchane”.

Rankingi liczone są średnią ważoną w stylu Filmwebu, a nie zwykłą średnią.

## Funkcje v1

- strona główna
- albumy
- artyści
- rankingi
- ostatnio dodane
- społeczność
- profil użytkownika
- komentarze pod albumami
- posłuchane
- chcę posłuchać
- panel admina
- import Spotify
- masowe akcje admina
- jasny i ciemny motyw

## Menu v1

- Albumy
- Rankingi
- Artyści
- Ostatnio dodane
- Społeczność

Sekcja „Premiery” nie jest częścią MVP, bo wymagałaby ręcznej pracy redakcyjnej.

## Role użytkowników

- użytkownik
- admin
- zweryfikowany artysta
- zweryfikowany producent

## Analityka

Od początku przewidujemy dashboard admina:

- liczba użytkowników
- liczba albumów
- liczba ocen
- liczba komentarzy
- odwiedziny
- aktywni użytkownicy 7/30 dni
- najpopularniejsze albumy
- najpopularniejsi artyści
- konwersja wejście na album → ocena

## Producenci

Spotify API nie daje pełnych danych producentów utworów.

Baza ma jednak od początku przewidywać producentów i producentów tracków, żeby można było dodawać ich ręcznie później.

## Status projektu

Projekt działa lokalnie na Next.js 16, TypeScript i Tailwind CSS.

Repozytorium GitHub: https://github.com/tapebase/tapebase