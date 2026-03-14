@echo off
title StreamVault - Database Setup
chcp 65001 >nul
color 0A

echo ==========================================
echo   StreamVault - Database Setup
echo ==========================================
echo.

echo Este script te ayudara a:
echo   1. Crear la base de datos D1 (si no existe)
echo   2. Crear el namespace KV (si no existe)
echo   3. Aplicar el schema a la base de datos
echo.
pause
echo.

REM ============================================
REM VERIFICAR WRANGLER
REM ============================================
wrangler --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Wrangler CLI no esta instalado
    echo Instalalo con: npm install -g wrangler
    pause
    exit /b 1
)

echo [OK] Wrangler detectado:
wrangler --version
echo.

REM ============================================
REM CREAR D1 DATABASE
REM ============================================
echo --- D1 Database ---
echo.
echo Verificando si la base de datos 'iptv-db' existe...

wrangler d1 list | findstr "iptv-db" >nul 2>&1
if errorlevel 1 (
    echo La base de datos 'iptv-db' NO existe.
    echo.
    set /p CREATE_D1="¿Deseas crearla ahora? (s/n): "
    if /I "!CREATE_D1!"=="s" (
        echo.
        echo Creando base de datos 'iptv-db'...
        wrangler d1 create iptv-db
        
        if errorlevel 1 (
            echo [ERROR] No se pudo crear la base de datos
            pause
            exit /b 1
        )
        
        echo.
        echo [IMPORTANTE] Copia el 'database_id' de arriba y actualiza wrangler.toml
    )
) else (
    echo [OK] La base de datos 'iptv-db' ya existe
)

echo.

REM ============================================
REM CREAR KV NAMESPACE
REM ============================================
echo --- KV Namespace ---
echo.
echo Verificando si el namespace 'KV' existe...

wrangler kv:namespace list | findstr "KV" >nul 2>&1
if errorlevel 1 (
    echo El namespace 'KV' NO existe.
    echo.
    set /p CREATE_KV="¿Deseas crearlo ahora? (s/n): "
    if /I "!CREATE_KV!"=="s" (
        echo.
        echo Creando namespace 'KV'...
        wrangler kv:namespace create KV
        
        if errorlevel 1 (
            echo [ERROR] No se pudo crear el namespace
            pause
            exit /b 1
        )
        
        echo.
        echo [IMPORTANTE] Copia el 'id' de arriba y actualiza wrangler.toml
    )
) else (
    echo [OK] El namespace 'KV' ya existe
)

echo.

REM ============================================
REM APLICAR SCHEMA
REM ============================================
echo --- Aplicar Schema ---
echo.
echo Para aplicar el schema a la base de datos D1, ejecuta:
echo.
echo   wrangler d1 execute iptv-db --file=schema.sql --remote
echo.
echo [NOTA] La opcion --remote aplica en produccion.
echo        Sin --remote aplica en entorno local.
echo.

set /p APPLY_SCHEMA="¿Deseas aplicar el schema en PRODUCCION ahora? (s/n): "
if /I "!APPLY_SCHEMA!"=="s" (
    echo.
    echo Aplicando schema en produccion...
    echo.
    wrangler d1 execute iptv-db --file=schema.sql --remote
    
    if errorlevel 1 (
        echo.
        echo [ERROR] No se pudo aplicar el schema
        echo.
        echo Posibles causas:
        echo   - El database_id en wrangler.toml no es correcto
        echo   - No estas autenticado con wrangler (wrangler login)
        pause
        exit /b 1
    )
    
    echo.
    echo [OK] Schema aplicado exitosamente!
) else (
    set /p APPLY_LOCAL="¿Deseas aplicar el schema LOCALMENTE para pruebas? (s/n): "
    if /I "!APPLY_LOCAL!"=="s" (
        echo.
        echo Aplicando schema localmente...
        wrangler d1 execute iptv-db --file=schema.sql --local
        
        if errorlevel 1 (
            echo [ERROR] No se pudo aplicar el schema local
            pause
            exit /b 1
        )
        
        echo.
        echo [OK] Schema aplicado localmente!
    )
)

echo.
echo ==========================================
echo   SETUP DE BASE DE DATOS COMPLETADO
echo ==========================================
echo.
echo Recuerda:
echo   - Actualizar wrangler.toml con los IDs de D1 y KV
echo   - Ejecutar: cd workers ^&^& wrangler secret put JWT_SECRET
echo   - Ejecutar: wrangler deploy (para subir el Worker)
echo.
pause
