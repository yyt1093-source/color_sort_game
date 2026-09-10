@echo off
title Color Sort Server
cd /d "%~dp0"
echo ================================================
echo  Color Sort Telegram Mini App Server
echo ================================================
echo Запуск сервера и туннеля...
node server.js
pause
