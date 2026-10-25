@echo off
rem Sowie Fiszki - zaplanuj kopie bazy co tydzien (niedziela 20:00) w Harmonogramie zadan Windows.
rem Usuniecie zadania: schtasks /delete /tn "SowieFiszki kopia bazy" /f
schtasks /create /tn "SowieFiszki kopia bazy" /tr "\"%~dp0kopia-zapasowa.bat\" auto" /sc weekly /d SUN /st 20:00 /f
if errorlevel 1 (
  echo Nie udalo sie utworzyc zadania.
) else (
  echo Zaplanowano: co niedziele o 20:00. Komputer musi byc wtedy wlaczony.
)
pause
