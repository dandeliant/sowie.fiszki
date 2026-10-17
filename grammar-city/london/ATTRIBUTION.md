# Mapa „Londyn — Westminster” — źródła danych i licencje

Plik `london.json` (mapa Grammar City, `?map=london`) powstał z eksportu
[topoexport.com](https://topoexport.com) (obszar ok. 1 × 1 km: Westminster — Big Ben, Pałac Westminsterski,
Tamiza, most Westminsterski, Westminster Abbey) skryptem `grammar-city/warsaw/tools/convert-dxf.js`
(`--name "Londyn — Westminster" --landmark at:302,-201`).
Dane zostały przekształcone (spłaszczenie terenu, uproszczenie geometrii, wyznaczenie miejsc misji i tras pieszych).

| Warstwa | Źródło | Licencja |
|---|---|---|
| Budynki 3D, kolej, wody, tereny zielone, drzewa | © Overture Maps Foundation — Buildings / Transportation / Base 2026 | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) |
| Drogi | Contains OS data © Crown copyright and database right 2024 — Ordnance Survey OpenMap | [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/) |
| Numeryczny model terenu (1 m) | © Environment Agency copyright and/or database right 2022 — LIDAR Composite | [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/) |
| Wysokości koron drzew | Meta i World Resources Institute — Global Canopy Height Maps v2 2026 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |

Baza danych pochodna (`london.json`) jest udostępniana na licencji **ODbL 1.0**.
W grze informacja o źródłach jest pokazywana na ekranie startowym i w pomocy, gdy wybrana jest ta mapa.
