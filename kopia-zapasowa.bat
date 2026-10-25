@echo off
rem Sowie Fiszki - kopia zapasowa bazy Supabase (recznie: dwuklik; co tydzien: zaplanuj-kopie.bat).
rem Kopie i log: Dokumenty\SowieFiszki-kopie (backup.log). Argument "auto" = bez pauzy (Harmonogram zadan),
rem "files" = pobierz tez pliki ze Storage (nagrania, zdjecia).
cd /d "%~dp0"
set "LOGDIR=%USERPROFILE%\Documents\SowieFiszki-kopie"
if not exist "%LOGDIR%" mkdir "%LOGDIR%"
set "EXTRA="
if /i "%~1"=="files" set "EXTRA=--files"
if /i "%~2"=="files" set "EXTRA=--files"
echo ===== %DATE% %TIME% =====>> "%LOGDIR%\backup.log"
node backup-supabase.js %EXTRA% >> "%LOGDIR%\backup.log" 2>&1
if /i "%~1"=="auto" exit /b %ERRORLEVEL%
echo.
echo Gotowe. Szczegoly: %LOGDIR%\backup.log
pause
