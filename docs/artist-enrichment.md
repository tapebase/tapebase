# Dane artystów z publicznych źródeł

Po imporcie Spotify backend próbuje uzupełnić dane głównego artysty. Operacja jest
niezależna od powodzenia importu albumów: błąd publicznego API zapisuje stan `failed`,
ale nie cofa katalogu.

Kolejność dopasowania:

1. Wikidata: dokładne `Spotify artist ID` (`P1902`) — zapis automatyczny.
2. MusicBrainz: dokładna relacja URL do profilu Spotify — zapis automatyczny.
3. Wikidata Search: nazwa i aliasy — wyłącznie kandydat do ręcznej weryfikacji.

Panel `/admin/artysci` pokazuje liczbę profili w każdym stanie, uruchamia partie od
1 do 10 artystów oraz pozwala zatwierdzić albo odrzucić kandydatów. Zatwierdzenie
uzupełnia nadal tylko puste pola.

Pola źródłowe obejmują prawdziwe imię, datę i miejsce urodzenia, kod kraju i krótki
opis. Data ma zachowaną dokładność `day`, `month` albo `year`. Źródło i identyfikator
są zapisane przy artyście, a mapa `enrichment_field_sources` dokumentuje pochodzenie
każdego automatycznie ustawionego pola.

Istniejący katalog można przetwarzać wielokrotnie małymi partiami. Stany `enriched`,
`review` oraz `not_found` są pomijane, dopóki administrator nie wymusi ponownego
sprawdzenia konkretnego profilu w kodzie lub bazie.
