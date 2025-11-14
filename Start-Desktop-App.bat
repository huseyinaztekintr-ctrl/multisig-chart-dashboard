@echo off
echo ====================================
echo   ORDER Multisig Dashboard
echo   Desktop Uygulamasi Baslatiliyor...
echo ====================================
echo.

cd /d "%~dp0"

if exist "dist-electron\win-unpacked\ORDER Multisig Dashboard.exe" (
    echo Desktop uygulamasi baslatiliyor...
    start "" "dist-electron\win-unpacked\ORDER Multisig Dashboard.exe"
    echo.
    echo Uygulama baslatildi! 
    echo Desktop uygulamasi acildi.
    echo.
) else if exist "electron.js" (
    echo Production build bulunamadi, Electron dev modunda baslatiliyor...
    echo.
    npm run electron:dev
) else (
    echo HATA: Uygulama dosyalari bulunamadi!
    echo Lutfen once "npm run electron:dist" komutunu calistirin.
    echo.
    pause
)

timeout /t 3 /nobreak >nul
exit