# StreamVault - Guía de Setup Completo

Esta guía te ayudará a configurar StreamVault para deploy automático en Cloudflare Pages usando GitHub Actions.

---

## 📋 Requisitos Previos

- [Node.js](https://nodejs.org/) 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/): `npm install -g wrangler`
- [Git](https://git-scm.com/download/win): Ya debería estar instalado
- Una cuenta de [Cloudflare](https://dash.cloudflare.com/sign-up) (gratis funciona)
- Una cuenta de [GitHub](https://github.com/join)

---

## 🔧 Paso 1: Obtener Cloudflare Account ID

1. Inicia sesión en tu [Cloudflare Dashboard](https://dash.cloudflare.com)
2. En la barra lateral derecha verás **"Account ID"**
3. Copia ese valor

```toml
# wrangler.toml
account_id = "tu-account-id-aqui"
```

---

## 🗄️ Paso 2: Crear D1 Database y obtener ID

```bash
# Ejecuta este comando
wrangler d1 create iptv-db
```

**Salida esperada:**
```
✅ Successfully created DB 'iptv-db' in region ENAM

[[d1_databases]]
binding = "DB"
database_name = "iptv-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Copia el `database_id` y pégalo en `wrangler.toml`:

```toml
[[d1_databases]]
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

---

## 🗃️ Paso 3: Crear KV Namespace y obtener ID

```bash
# Ejecuta este comando
wrangler kv:namespace create KV
```

**Salida esperada:**
```
✨ Success!
Add the following to your configuration file:
[[kv_namespaces]]
binding = "KV"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

Copia el `id` y pégalo en `wrangler.toml`:

```toml
[[kv_namespaces]]
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

---

## 🔐 Paso 4: Aplicar Schema a la Base de Datos

```bash
# Aplicar en producción
wrangler d1 execute iptv-db --file=schema.sql --remote

# O aplicar localmente para pruebas
wrangler d1 execute iptv-db --file=schema.sql --local
```

**Alternativa:** Usa el script automatizado:
```bash
setup-database.bat
```

---

## 🔑 Paso 5: Configurar Secrets del Worker

```bash
cd workers

# JWT Secret (genera uno nuevo)
openssl rand -hex 32
wrangler secret put JWT_SECRET

# VAPID Keys (para notificaciones push)
npx web-push generate-vapid-keys
wrangler secret put VAPID_PUBLIC_KEY
wrangler secret put VAPID_PRIVATE_KEY
wrangler secret put VAPID_SUBJECT
# VAPID_SUBJECT: mailto:tu-email@ejemplo.com
```

---

## 🚀 Paso 6: Deploy Inicial del Worker

```bash
cd workers
wrangler deploy
```

Anota la URL del Worker, se verá así:
```
https://iptv-api.tu-subdomain.workers.dev
```

---

## 📦 Paso 7: Crear GitHub Token (Classic)

1. Ve a: https://github.com/settings/tokens/new
2. Selecciona **"Generate new token (classic)"**
3. Configura:
   - **Note**: `StreamVault Deploy`
   - **Expiration**: 90 días (o según prefieras)
   - **Scopes**:
     - ✅ `repo` (Full control)
     - ✅ `workflow` (Update GitHub Actions)
     - ✅ `read:user` (Read user profile)
4. Click **"Generate token"**
5. **¡COPIA EL TOKEN AHORA!** (solo se muestra una vez)

---

## 📤 Paso 8: Subir Código a GitHub

### Opción A: Usar el script automatizado

```bash
setup-git.bat
```

Este script te guiará para:
- Configurar Git
- Autenticarte con GitHub (token o GitHub CLI)
- Crear el repositorio (si no existe)
- Subir el código

### Opción B: Manual

```bash
# Configurar Git
git config --global user.name "Tu Nombre"
git config --global user.email "tu@email.com"

# Inicializar repo
git init
git add .
git commit -m "Initial commit"

# Crear repo en GitHub (sin README)
# https://github.com/new

# Conectar y subir
git remote add origin https://github.com/TU_USER/streamvault.git
git push -u origin main
```

---

## 🔒 Paso 9: Configurar Secrets en GitHub

Ve a tu repositorio en GitHub:
```
https://github.com/TU_USER/streamvault/settings/secrets/actions
```

Agrega estos **Repository secrets**:

| Secret | Valor | Cómo obtenerlo |
|--------|-------|----------------|
| `CLOUDFLARE_API_TOKEN` | Token de API | Cloudflare → My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" template |
| `CLOUDFLARE_ACCOUNT_ID` | Tu Account ID | Cloudflare Dashboard → sidebar derecho |
| `VITE_API_URL` | URL del Worker | `https://iptv-api.tu-subdomain.workers.dev/api` |
| `VITE_WS_URL` | URL WebSocket | `wss://iptv-api.tu-subdomain.workers.dev` |

### Crear Cloudflare API Token:

1. Ve a: https://dash.cloudflare.com/profile/api-tokens
2. Click **"Create Token"**
3. Usa el template **"Edit Cloudflare Workers"**
4. En **Account Resources**: Include → Tu cuenta
5. En **Zone Resources**: Include → All zones (o tu zona específica)
6. Click **Continue**, luego **Create Token**
7. Copia el token y guárdalo

**Permisos necesarios:**
- ✅ Cloudflare Pages:Edit
- ✅ Cloudflare Workers Scripts:Edit
- ✅ D1:Edit
- ✅ Workers KV Storage:Edit

---

## ✅ Paso 10: Verificar Deploy Automático

1. Haz un cambio pequeño en cualquier archivo
2. Commitea y pushea:
```bash
git add .
git commit -m "Test deploy"
git push origin main
```

3. Ve a tu repo en GitHub → pestaña **"Actions"**
4. Deberías ver el workflow ejecutándose
5. Cuando termine (verde ✅), tu app estará en:
```
https://iptv-frontend.pages.dev
```

---

## 🔧 Troubleshooting

### Error: "database_id not found"
- Verifica que el `database_id` en `wrangler.toml` sea correcto
- Ejecuta: `wrangler d1 list` para ver tus bases de datos

### Error: "KV namespace not found"
- Verifica el `id` en `wrangler.toml`
- Ejecuta: `wrangler kv:namespace list` para ver tus namespaces

### Error: "Authentication error" en GitHub Actions
- Verifica que `CLOUDFLARE_API_TOKEN` esté correctamente configurado
- Asegúrate de que el token tenga los permisos necesarios

### Error: "No such file or directory" en build
- Asegúrate de que `frontend/dist` exista después del build
- Verifica que `VITE_API_URL` y `VITE_WS_URL` estén configurados en GitHub secrets

---

## 📁 Resumen de Archivos Modificados

Después de seguir esta guía, estos archivos deberían estar configurados:

```
wrangler.toml           # Con tus IDs de D1, KV y Account
frontend/.env.production # Con URLs del Worker (para build local)
git remote origin       # Apuntando a tu repo de GitHub
GitHub Secrets          # 4 secrets configurados
```

---

## 🎉 ¡Listo!

Cada vez que hagas `git push origin main`, tu app se deployará automáticamente a Cloudflare Pages.

**URLs importantes:**
- **Frontend**: `https://iptv-frontend.pages.dev`
- **API**: `https://iptv-api.tu-subdomain.workers.dev`
- **Admin Panel**: `https://iptv-frontend.pages.dev/admin`

**Credenciales por defecto:**
- Email: `admin@example.com`
- Password: La que configuraste al crear el seed
- TOTP: Escanea el QR que apareció al crear el admin
