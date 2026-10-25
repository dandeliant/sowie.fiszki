# Mapa „Paryż — wieża Eiffla” — źródła danych i licencje

Plik `paris.json` (mapa Grammar City, `?map=paris`) powstał z eksportu
[topoexport.com](https://topoexport.com) (obszar ok. 1 × 1 km: wieża Eiffla, Pola Marsowe, Sekwana, Trocadéro)
skryptem `grammar-city/warsaw/tools/convert-dxf.js` (`--name "Paryż — wieża Eiffla" --landmark tallest`).
Dane zostały przekształcone (spłaszczenie terenu, uproszczenie geometrii, wyznaczenie miejsc misji i tras pieszych).
Wieża Eiffla jest w grze rysowana proceduralnie (kratownica) w miejscu i orientacji brył z danych.

| Warstwa | Źródło | Licencja |
|---|---|---|
| Budynki 3D, drogi, kolej, wody | © IGN — Institut national de l'information géographique et forestière, BD TOPO® 2025 / BD TOPO® EXPRESS 2026 | [Licence Ouverte / Etalab 2.0](https://www.etalab.gouv.fr/licence-ouverte-open-licence/) |
| Numeryczny model terenu (1 m) | © IGN — RGE Alti® 2024 | [Licence Ouverte / Etalab 2.0](https://www.etalab.gouv.fr/licence-ouverte-open-licence/) |
| Tereny zielone, drzewa | © Overture Maps Foundation — Base 2026 | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) |
| Wysokości koron drzew | Meta i World Resources Institute — Global Canopy Height Maps v2 2026 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |

Baza danych pochodna (`paris.json`) jest udostępniana na licencji **ODbL 1.0**.
W grze informacja o źródłach jest pokazywana na ekranie startowym i w pomocy, gdy wybrana jest ta mapa.
