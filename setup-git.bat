@echo off
title StreamVault - Setup Git + GitHub Deploy
chcp 65001 >nul
color 0B
setlocal EnableDelayedExpansion

echo ==========================================
echo   StreamVault - Setup Git + GitHub Deploy
echo ==========================================
echo.
echo Este script te ayudara a:
echo   1. Configurar Git localmente
echo   2. Crear/conectar tu repositorio en GitHub
echo   3. Subir tu codigo
echo.
echo NOTA: Para crear la infraestructura (D1, KV) usaras GitHub Actions.
echo       Lee SETUP-NO-LOCAL-TOOLS.md para mas detalles.
echo.
pause
echo.

REM ============================================
REM VERIFICAR GIT
REM ============================================
git --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Git no esta instalado o no esta en el PATH
    echo Descargalo de: https://git-scm.com/download/win
    pause
    exit /b 1
)

echo [OK] Git detectado:
git --version
echo.

REM ============================================
REM CONFIGURACION DE GIT LOCAL
REM ============================================
echo --- Configuracion de Git Local ---
echo.

for /f "delims=" %%a in ('git config --global user.name 2^>nul') do set CURRENT_NAME=%%a
for /f "delims=" %%a in ('git config --global user.email 2^>nul') do set CURRENT_EMAIL=%%a

if not "!CURRENT_NAME!"=="" (
    echo Nombre actual: !CURRENT_NAME!
    set /p GIT_NAME="Nuevo nombre (Enter para mantener): "
    if "!GIT_NAME!"=="" set GIT_NAME=!CURRENT_NAME!
) else (
    set /p GIT_NAME="Tu nombre completo: "
)

if not "!CURRENT_EMAIL!"=="" (
    echo Email actual: !CURRENT_EMAIL!
    set /p GIT_EMAIL="Nuevo email (Enter para mantener): "
    if "!GIT_EMAIL!"=="" set GIT_EMAIL=!CURRENT_EMAIL!
) else (
    set /p GIT_EMAIL="Tu email: "
)

echo.
set /p GITHUB_USER="Tu usuario de GitHub: "
echo.

REM Configurar Git
git config --global user.name "!GIT_NAME!"
git config --global user.email "!GIT_EMAIL!"
echo [OK] Git configurado
echo.

REM ============================================
REM VERIFICAR/CREAR REPOSITORIO EN GITHUB
REM ============================================
echo --- Configuracion del Repositorio ---
echo.

for %%I in (.) do set REPO_NAME=%%~nxI
if "!REPO_NAME!"=="." set REPO_NAME=streamvault

set /p REPO_NAME="Nombre del repositorio [!REPO_NAME!]: "
if "!REPO_NAME!"=="" (
    for %%I in (.) do set REPO_NAME=%%~nxI
    if "!REPO_NAME!"=="." set REPO_NAME=streamvault
)

echo.
echo Repositorio objetivo: https://github.com/!GITHUB_USER!/!REPO_NAME!
echo.

REM ============================================
REM INICIALIZAR REPO LOCAL
REM ============================================
echo --- Inicializando Repositorio Local ---

if exist .git (
    echo [OK] El repositorio ya estaba inicializado
) else (
    git init
    echo [OK] Repositorio inicializado
)

REM Crear .gitignore si no existe
if not exist .gitignore (
    echo Creando .gitignore basico...
    (
        echo node_modules/
        echo dist/
        echo .env
        echo .env.local
        echo *.log
        echo .wrangler/
        echo .dev.vars
    ) > .gitignore
    echo [OK] .gitignore creado
)

git branch -M main 2>nul

REM ============================================
REM AGREGAR Y COMMITEAR ARCHIVOS
REM ============================================
echo.
echo --- Agregando archivos ---
git add .
echo [OK] Archivos agregados

echo.
echo --- Creando commit ---
git commit -m "Initial commit - StreamVault IPTV platform" >nul 2>&1
if errorlevel 1 (
    echo No hay cambios nuevos para commitear o ya existe un commit similar
) else (
    echo [OK] Commit creado
)

REM ============================================
REM CONECTAR CON GITHUB Y HACER PUSH
REM ============================================
echo.
echo --- Conectando con GitHub ---
echo.

REM Eliminar remote existente y crear nuevo
git remote remove origin 2>nul
git remote add origin https://github.com/!GITHUB_USER!/!REPO_NAME!.git
echo [OK] Remote configurado

echo.
echo IMPORTANTE: Si el repositorio no existe en GitHub todavia,
echo debes crearlo primero en: https://github.com/new
echo.
echo Configuracion recomendada:
echo   - Repository name: !REPO_NAME!
echo   - Description: StreamVault IPTV Platform
echo   - Public o Private: Como prefieras
echo   - UNCHECK: Add a README file
echo   - UNCHECK: Add .gitignore
echo   - UNCHECK: Choose a license
echo.
set /p REPO_CREATED="¿Ya creaste el repositorio en GitHub? (s/n): "

if /I not "!REPO_CREATED!"=="s" (
    echo.
    echo Por favor crea el repositorio primero:
    echo   https://github.com/new?name=!REPO_NAME!
    echo.
    echo Luego vuelve a ejecutar este script.
    pause
    exit /b 1
)

REM ============================================
REM AUTENTICACION Y PUSH
REM ============================================
echo.
echo --- Subiendo codigo a GitHub ---
echo.
echo Metodos de autenticacion:
echo   [1] Token de acceso personal (Classic) - RECOMENDADO
echo   [2] Autenticacion interactiva del navegador
echo.
set /p AUTH_METHOD="Elige metodo (1 o 2): "

if "!AUTH_METHOD!"=="1" (
    echo.
    echo Necesitas un Personal Access Token (Classic) de GitHub.
    echo.
    echo Para crear uno:
    echo   1. Ve a: https://github.com/settings/tokens/new
    echo   2. Selecciona "Generate new token (classic)"
    echo   3. Nota: StreamVault Deploy
    echo   4. Expiracion: 90 dias (o segun prefieras)
    echo   5. Scopes: [x] repo, [x] workflow
    echo   6. Click "Generate token"
    echo   7. COPIA EL TOKEN AHORA (solo se muestra una vez)
    echo.
    set /p GITHUB_TOKEN="Pega tu GitHub Token: "
    
    if "!GITHUB_TOKEN!"=="" (
        echo [ERROR] No ingresaste un token
        pause
        exit /b 1
    )
    
    echo.
    echo Subiendo con token...
    git push -u https://!GITHUB_TOKEN!@github.com/!GITHUB_USER!/!REPO_NAME!.git main
    
    if errorlevel 1 (
        echo.
        echo [ERROR] No se pudo subir el codigo
        echo.
        echo Posibles causas:
        echo   - El repositorio no existe
        echo   - El token es incorrecto o expiro
        echo   - El token no tiene permisos de 'repo'
        echo.
        pause
        exit /b 1
    )
    
) else (
    echo.
    echo Se abrira una ventana para autenticarte con GitHub.
    echo Despues de autenticarte, el push continuara.
    echo.
    pause
    
    git push -u origin main
    
    if errorlevel 1 (
        echo.
        echo [ERROR] No se pudo subir el codigo
        echo.
        echo Posibles causas:
        echo   - El repositorio no existe
        echo   - Problema de autenticacion
        echo.
        echo Intenta usar la opcion 1 (Token) en su lugar.
        pause
        exit /b 1
    )
)

REM ============================================
REM SUCCESS
REM ============================================
echo.
echo ==========================================
echo   ¡CODIGO SUBIDO EXITOSAMENTE!
echo ==========================================
echo.
echo Tu codigo esta en:
echo https://github.com/!GITHUB_USER!/!REPO_NAME!
echo.
echo ==========================================
echo   SIGUIENTES PASOS
echo ==========================================
echo.
echo 1. Abre tu repositorio en GitHub
echo    https://github.com/!GITHUB_USER!/!REPO_NAME!
echo.
echo 2. Ve a Settings ^> Secrets and variables ^> Actions
echo    Agrega estos secrets:
echo.
echo      CLOUDFLARE_API_TOKEN      (de Cloudflare Dashboard)
echo      CLOUDFLARE_ACCOUNT_ID     (de Cloudflare Dashboard)
echo      VITE_API_URL              (temporal: https://placeholder.workers.dev/api)
echo      VITE_WS_URL               (temporal: wss://placeholder.workers.dev)
echo.
echo 3. Lee SETUP-NO-LOCAL-TOOLS.md para continuar
echo.
echo 4. Los workflows de GitHub Actions haran el resto:
echo    - Crearan D1 y KV
echo    - Aplicaran el schema
echo    - Deployaran el Worker y Frontend
echo.

set /p OPEN_BROWSER="¿Deseas abrir tu repositorio en el navegador? (s/n): "
if /I "!OPEN_BROWSER!"=="s" (
    start https://github.com/!GITHUB_USER!/!REPO_NAME!
)

echo.
pause
