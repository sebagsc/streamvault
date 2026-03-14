@echo off
title StreamVault - Setup Git
color 0B

echo ==========================================
echo   StreamVault - Setup Git
echo ==========================================
echo.

REM Verificar si git esta instalado
git --version >/dev/null 2>&1
if errorlevel 1 (
    echo ERROR: Git no esta instalado o no esta en el PATH
    echo Descargalo de: https://git-scm.com/download/win
    pause
    exit /b 1
)

echo Git detectado:
git --version
echo.

REM Preguntar datos
echo --- Configuracion de Git ---
set /p GIT_NAME=Tu nombre completo: 
set /p GIT_EMAIL=Tu email: 
set /p GITHUB_USER=Tu usuario de GitHub: 

echo.
echo Configurando Git...
git config --global user.name "%GIT_NAME%"
git config --global user.email "%GIT_EMAIL%"
echo OK: Git configurado
echo.

REM Inicializar repositorio
echo --- Inicializando repositorio ---
if exist .git (
    echo El repositorio ya estaba inicializado
) else (
    git init
    echo OK: Repositorio inicializado
)
echo.

REM Agregar archivos
echo --- Agregando archivos ---
git add .
echo OK: Archivos agregados
echo.

REM Crear commit
echo --- Creando commit ---
git commit -m "Initial commit - StreamVault IPTV platform"
if errorlevel 1 (
    echo No hay cambios nuevos para commitear
) else (
    echo OK: Commit creado
)
echo.

REM Conectar con GitHub
echo --- Conectando con GitHub ---
git remote remove origin 2>nul
git remote add origin https://github.com/%GITHUB_USER%/streamvault.git
echo OK: Conectado a: https://github.com/%GITHUB_USER%/streamvault
echo.

git branch -M main

REM Push a GitHub
echo --- Subiendo a GitHub ---
echo AVISO: Si te pide contrasena, usa un Personal Access Token de GitHub
echo        (GitHub ^> Settings ^> Developer settings ^> Personal access tokens)
echo.
git push -u origin main

if errorlevel 1 (
    echo.
    echo ERROR: No se pudo subir a GitHub
    echo.
    echo Posibles causas:
    echo   1. No creaste el repositorio en GitHub todavia
    echo   2. El nombre del repo no es streamvault
    echo   3. Problema de autenticacion (Personal Access Token)
    echo.
    echo Solucion:
    echo   - Anda a https://github.com/new
    echo   - Crea un repo llamado streamvault (sin inicializar con README)
    echo   - Volvé a ejecutar este script
    pause
    exit /b 1
)

echo.
echo ==========================================
echo   TODO LISTO!
echo ==========================================
echo.
echo Tu codigo esta en:
echo https://github.com/%GITHUB_USER%/streamvault
echo.
echo Proximos pasos:
echo   1. Verifica que los archivos esten en GitHub
echo   2. Sigue el README.md para configurar Cloudflare
echo.
pause
