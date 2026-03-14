@echo off
title Actualizar credenciales GitHub

echo Borrando credenciales viejas de GitHub...
cmdkey /delete:git:https://github.com >/dev/null 2>&1
cmdkey /delete:https://github.com >/dev/null 2>&1
echo OK: Credenciales borradas
echo.
echo Ahora volvé a correr setup-git.bat
echo Cuando te pida contrasena, pega tu nuevo Personal Access Token
echo.
pause
