@echo off
title StreamVault Git Setup
color 0B

echo ==========================================
echo   StreamVault - Setup Git + GitHub Deploy
echo ==========================================
echo.

git --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Git no esta instalado
    pause
    exit /b 1
)

echo.
echo --- Configuracion Git ---
set /p GIT_NAME="Tu nombre: "
set /p GIT_EMAIL="Tu email: "
set /p GITHUB_USER="Usuario GitHub: "

git config --global user.name "%GIT_NAME%"
git config --global user.email "%GIT_EMAIL%"
echo [OK] Git configurado
echo.

set REPO_NAME=streamvault
set /p REPO_NAME_INPUT="Nombre repo [%REPO_NAME%]: "
if not "%REPO_NAME_INPUT%"=="" set REPO_NAME=%REPO_NAME_INPUT%

echo.
echo Repositorio: https://github.com/%GITHUB_USER%/%REPO_NAME%
echo.
echo Crea el repo en GitHub si no existe:
echo   https://github.com/new?name=%REPO_NAME%
echo   NO inicializar con README
echo.
pause

git init 2>nul
git branch -M main 2>nul
git add .
git commit -m "Initial commit" 2>nul

git remote remove origin 2>nul
git remote add origin https://github.com/%GITHUB_USER%/%REPO_NAME%.git

echo.
echo ==========================================
echo   SUBIR A GITHUB
echo ==========================================
echo.
echo Opcion 1: Con Token (recomendado)
echo   1. Crea token: https://github.com/settings/tokens/new
echo   2. Scopes: repo, workflow
echo   3. Ejecuta:
echo.
echo      git push -u https://TOKEN@github.com/%GITHUB_USER%/%REPO_NAME%.git main
echo.
echo Opcion 2: Interactivo
echo      git push -u origin main
echo.
pause
