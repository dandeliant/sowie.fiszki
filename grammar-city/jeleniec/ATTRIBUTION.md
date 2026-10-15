# Mapa „Jeleniec" — źródła danych i licencje

Plik `jeleniec.json` (mapa Grammar City, `?map=jeleniec`) powstał z eksportu
[topoexport.com](https://topoexport.com) (obszar ok. 970 × 964 m) skryptem
`grammar-city/warsaw/tools/convert-dxf.js` (`--name "Jeleniec" --landmark center`).
Dane zostały przekształcone (spłaszczenie terenu, uproszczenie geometrii, wyznaczenie
miejsc misji i tras pieszych). Dachy dwuspadowe domów dodaje gra — nie pochodzą z danych.

| Warstwa | Źródło | Licencja |
|---|---|---|
| Budynki, drogi, wody, tereny zielone, drzewa | © Overture Maps Foundation — Buildings / Transportation / Base 2026 | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) |
| Numeryczny model terenu (1 m) | Główny Urząd Geodezji i Kartografii — NMT (EVRF2007) 2024 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Wysokości koron drzew | Meta i World Resources Institute — Global Canopy Height Maps v2 2026 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |

Baza danych pochodna (`jeleniec.json`) jest udostępniana na licencji **ODbL 1.0**.
W grze informacja o źródłach jest pokazywana na ekranie startowym i w pomocy, gdy wybrana jest ta mapa.
