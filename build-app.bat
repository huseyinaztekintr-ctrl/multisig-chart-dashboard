@echo off
echo ORDER Multisig Dashboard derleniyor...
call npm run build
echo.
echo Uygulama derlendi! dist klasorundeeki dosyalari bir web server ile calistirabiliriniz.
echo.
echo Hemen test etmek icin:
call npm run preview
pause