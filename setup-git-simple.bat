@echo off
title StreamVault Git Setup
color 0B

echo ==========================================
echo   StreamVault - Setup Git + GitHub
echo ==========================================
echo.

REM Verificar Git
git --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Git no esta instalado
    pause
    exit /b 1
)

REM Configurar Git
echo.
set /p GIT_NAME="Tu nombre: "
set /p GIT_EMAIL="Tu email: "
set /p GITHUB_USER="Tu usuario de GitHub: "

git config --global user.name "%GIT_NAME%"
git config --global user.email "%GIT_EMAIL%"
echo.
echo Git configurado.
echo.

REM Nombre del repo
set /p REPO_NAME="Nombre del repo [streamvault]: "
if "%REPO_NAME%"=="" set REPO_NAME=streamvault

echo.
echo Repositorio: https://github.com/%GITHUB_USER%/%REPO_NAME%
echo.
echo IMPORTANTE: Crea el repo primero en GitHub si no existe.
echo   URL: https://github.com/new?name=%REPO_NAME%
echo   NO inicializar con README.
echo.
pause

REM Inicializar y commit
git init 2>nul
git branch -M main 2>nul
git add .
git commit -m "Initial commit" 2>nul

REM Configurar remote
git remote remove origin 2>nul
git remote add origin https://github.com/%GITHUB_USER%/%REPO_NAME%.git

echo.
echo ==========================================
echo   COMO SUBIR EL CODIGO
echo ==========================================
echo.
echo Opcion A - Con Token (Recomendado):
echo 1. Crea un token en: https://github.com/settings/tokens/new
echo 2. Selecciona: Generate new token (classic)
echo 3. Scopes: [x] repo, [x] workflow
echo 4. Ejecuta este comando:
echo.
echo    git push -u https://TU_TOKEN@github.com/%GITHUB_USER%/%REPO_NAME%.git main
echo.
echo Opcion B - Interactivo:
echo    git push -u origin main
echo.
pause
