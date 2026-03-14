# StreamVault - Setup sin Node.js ni Wrangler (Solo Git)

Esta guía te permite configurar StreamVault **sin instalar Node.js ni Wrangler CLI** en tu computadora. Solo necesitas Git.

---

## ✅ Requisitos Mínimos

- Git instalado (ya lo tienes ✓)
- Cuenta de [Cloudflare](https://dash.cloudflare.com/sign-up)
- Cuenta de [GitHub](https://github.com/join)

---

## 📋 Paso 1: Obtener Cloudflare Account ID

1. Ve a https://dash.cloudflare.com e inicia sesión
2. En la **barra lateral derecha** verás tu **Account ID**
3. Cópialo y guárdalo, lo necesitarás más adelante

---

## 🔐 Paso 2: Crear Cloudflare API Token

1. Ve a https://dash.cloudflare.com/profile/api-tokens
2. Click **"Create Token"**
3. Selecciona el template **"Edit Cloudflare Workers"**
4. Configura:
   - **Account Resources**: Include → Tu cuenta
   - **Zone Resources**: Include → All zones (o tu zona)
5. Click **Continue** → **Create Token**
6. **COPIA EL TOKEN** (solo se muestra una vez)

---

## 📤 Paso 3: Subir Código a GitHub

### 3.1 - Editar wrangler.toml con tu Account ID

Abre `wrangler.toml` en un editor de texto y reemplaza:

```toml
# DESCOMENTA ESTA LINEA Y PEGA TU ACCOUNT ID
account_id = "tu-account-id-aqui"
```

Por ejemplo:
```toml
account_id = "1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p"
```

### 3.2 - Subir a GitHub con el script

Ejecuta `setup-git.bat` (doble click):

```batch
setup-git.bat
```

Esto te pedirá:
- Tu nombre y email
- Tu usuario de GitHub
- Tu **GitHub Personal Access Token** (Classic)

### 3.3 - Crear GitHub Token Classic

Si no tienes uno:
1. Ve a https://github.com/settings/tokens/new
2. Selecciona **"Tokens (classic)"** → **"Generate new token (classic)"**
3. Nombre: `StreamVault Deploy`
4. Expiración: 90 días
5. Scopes: ✅ `repo`, ✅ `workflow`
6. **Generate token** y cópialo

### 3.4 - Completar el script

El script `setup-git.bat`:
- Configurará Git
- Creará el repositorio en GitHub (si no existe)
- Subirá tu código

---

## 🔒 Paso 4: Configurar Secrets en GitHub

Ve a tu repositorio recién creado:
```
https://github.com/TU_USUARIO/streamvault/settings/secrets/actions
```

Haz click en **"New repository secret"** y agrega estos 4:

| Nombre del Secret | Valor |
|-------------------|-------|
| `CLOUDFLARE_API_TOKEN` | El token que creaste en Paso 2 |
| `CLOUDFLARE_ACCOUNT_ID` | Tu Account ID del Paso 1 |
| `VITE_API_URL` | `https://iptv-api.tu-usuario.workers.dev/api` (temporal) |
| `VITE_WS_URL` | `wss://iptv-api.tu-usuario.workers.dev` (temporal) |

> Los valores de VITE_API_URL y VITE_WS_URL los actualizarás después de hacer el primer deploy del Worker.

---

## ⚙️ Paso 5: Crear Infraestructura (D1 + KV) vía GitHub Actions

### 5.1 - Ir a Actions

En tu repositorio de GitHub, ve a la pestaña **"Actions"**.

### 5.2 - Ejecutar Workflow de Setup

Verás un workflow llamado **"Setup Cloudflare Infrastructure"**. Haz click en:

1. **"Setup Cloudflare Infrastructure"**
2. Botón **"Run workflow"** (derecha)
3. Selecciona `setup-all`
4. Click **"Run workflow"**

Esto creará:
- ✅ La base de datos D1 llamada "iptv-db"
- ✅ El namespace KV llamado "KV"

### 5.3 - Obtener los IDs

En los logs del workflow, busca:

```
Listing databases:
┌──────────────────────────────────────┬───────────────┐
│ uuid                                 │ name          │
├──────────────────────────────────────┼───────────────┤
│ xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx │ iptv-db       │
└──────────────────────────────────────┴───────────────┘

Listing namespaces:
┌──────────────────────────────────────┬──────┐
│ id                                   │ title│
├──────────────────────────────────────┼──────┤
│ xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx     │ KV   │
└──────────────────────────────────────┴──────┘
```

Copia:
- El `uuid` de iptv-db → **D1 Database ID**
- El `id` de KV → **KV Namespace ID**

---

## 📝 Paso 6: Actualizar wrangler.toml con los IDs

Edita el archivo `wrangler.toml` en tu computadora y reemplaza:

```toml
[[d1_databases]]
database_id = "YOUR_D1_DATABASE_ID"  
# ↑ Reemplaza con: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

[[kv_namespaces]]
id = "YOUR_KV_NAMESPACE_ID"
# ↑ Reemplaza con: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

También en la sección `[env.production]` al final del archivo.

### Subir el cambio:

```bash
git add wrangler.toml
git commit -m "Update D1 and KV IDs"
git push origin main
```

O usa el script `setup-git.bat` de nuevo (el detectará cambios y hará commit).

---

## 🗄️ Paso 7: Aplicar Schema a la Base de Datos

### Opción A: Via GitHub Actions (Recomendado)

1. Ve a **Actions** → **"Setup Cloudflare Infrastructure"**
2. Click **"Run workflow"**
3. Selecciona `apply-schema`
4. Click **"Run workflow"**

### Opción B: Via Cloudflare Dashboard

1. Ve a https://dash.cloudflare.com
2. En el menú lateral: **"Workers & Pages"** → **"D1 SQL Database"**
3. Click en tu base de datos **"iptv-db"**
4. Ve a la pestaña **"Console"**
5. Copia y pega el contenido de `schema.sql`
6. Click **"Execute"**

---

## 🚀 Paso 8: Deploy del Worker

### 8.1 - Deploy inicial via GitHub Actions

1. Ve a **Actions** → **"Setup Cloudflare Infrastructure"**
2. Click **"Run workflow"**
3. Selecciona `deploy-worker`
4. Click **"Run workflow"**

Si todo está bien, verás:
```
Worker deployed successfully!
```

Anota la URL del Worker (aparece en los logs), se verá así:
```
https://iptv-api.tu-subdomain.workers.dev
```

### 8.2 - Actualizar URLs en GitHub Secrets

Ahora que tienes la URL del Worker, actualiza los secrets:

1. Ve a **Settings** → **Secrets and variables** → **Actions**
2. Edita estos secrets:
   - `VITE_API_URL`: `https://iptv-api.tu-subdomain.workers.dev/api`
   - `VITE_WS_URL`: `wss://iptv-api.tu-subdomain.workers.dev`

---

## 🔑 Paso 9: Configurar Secrets del Worker

Los secrets sensibles (JWT, VAPID) deben configurarse en el Worker. Como no tienes Wrangler local, hazlo via **Cloudflare Dashboard**:

1. Ve a https://dash.cloudflare.com
2. **Workers & Pages** → **"iptv-api"**
3. Pestaña **"Settings"** → **"Variables"**
4. Sección **"Worker Variables and Secrets"**
5. Click **"Add"** para cada secreto:

| Nombre | Valor | Cómo generar |
|--------|-------|--------------|
| `JWT_SECRET` | (valor aleatorio) | Usa https://www.random.org/strings/ o inventa uno largo |
| `VAPID_PUBLIC_KEY` | (clave pública) | https://web-push-codelab.glitch.me/ |
| `VAPID_PRIVATE_KEY` | (clave privada) | https://web-push-codelab.glitch.me/ |
| `VAPID_SUBJECT` | `mailto:tu@email.com` | Tu email |
| `FRONTEND_URL` | `https://iptv-frontend.pages.dev` | URL de tu frontend (después del primer deploy) |

> **Nota**: Las VAPID keys las puedes generar en https://web-push-codelab.glitch.me/ (click "Generate").

---

## 🌐 Paso 10: Deploy del Frontend a Cloudflare Pages

Cada vez que hagas push a `main`, el frontend se deployará automáticamente.

### Primera vez:

1. Haz un pequeño cambio en cualquier archivo (ej: espacio en README.md)
2. Súbelo:
   ```bash
   git add .
   git commit -m "Trigger first deploy"
   git push origin main
   ```
3. Ve a **Actions** en GitHub, verás el workflow "Deploy to Cloudflare" ejecutándose
4. Espera a que termine (≈ 2-3 minutos)

### Verificar deploy:

1. Ve a https://dash.cloudflare.com
2. **Workers & Pages** → Busca tu proyecto **"iptv-frontend"**
3. Click en él para ver la URL, ej: `https://iptv-frontend.pages.dev`

---

## ✨ ¡Listo!

Tu aplicación está deployada:

- **Frontend**: `https://iptv-frontend.pages.dev`
- **API**: `https://iptv-api.tu-subdomain.workers.dev`

### Cada push a `main` hará deploy automático de todo.

---

## 🛠️ Troubleshooting

### "database_id not found" en el workflow
- Verifica que actualizaste `wrangler.toml` con el ID correcto
- Asegúrate de haber hecho commit y push del archivo actualizado

### "KV namespace not found"
- Similar al anterior, verifica el ID en `wrangler.toml`

### El Worker no funciona (500 errors)
- Ve al dashboard de Cloudflare → Workers → iptv-api → "Logs"
- Verifica que configuraste todos los secrets (JWT_SECRET, VAPID_*)

### El frontend no conecta con la API
- Verifica que `VITE_API_URL` y `VITE_WS_URL` estén correctos en GitHub Secrets
- Asegúrate de que el Worker esté deployado y funcionando

---

## 🔄 Resumen de Workflows de GitHub Actions

| Workflow | Cuándo usar |
|----------|-------------|
| **"Setup Cloudflare Infrastructure"** | Solo la primera vez para crear recursos |
| **"Deploy to Cloudflare"** | Automático en cada push a `main` |

Para ejecutar manualmente cualquiera:
1. Ve a **Actions** en tu repo
2. Selecciona el workflow
3. Click **"Run workflow"**
