@echo off
echo ORDER Multisig Dashboard baslatiliyor...
echo.
echo Tarayici otomatik acilmazsa asagidaki adrese gidin:
echo http://localhost:8080
echo.
echo Uygulamayi kapatmak icin Ctrl+C tuslayin
echo.
start http://localhost:8080
npm run dev
pause