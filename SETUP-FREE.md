# StreamVault - Setup 100% Gratuito (Sin Durable Objects)

Esta guía configura StreamVault usando **solo servicios gratuitos** de Cloudflare.

---

## ✅ Stack Gratuito

| Servicio | Límite Gratuito |
|----------|-----------------|
| **Cloudflare Workers** | 100,000 requests/día |
| **Cloudflare Pages** | Ilimitado (builds + bandwidth) |
| **Cloudflare D1** | 5M queries/mes |
| **Cloudflare KV** | 1GB storage, 10M reads/mes |

### ⚠️ Diferencias con la versión original

La versión original usaba **Durable Objects** (requiere plan pago $5+/mes). Esta versión usa:

- ✅ **Polling HTTP** en lugar de WebSockets
- ✅ **D1 Database** para chat y presencia
- ✅ Todo el resto de funcionalidades igual

**Cambios visibles:**
- Chat: Mensajes se actualizan cada 3 segundos (en lugar de instantáneo)
- Presencia: Conteo de usuarios se actualiza cada 10-30 segundos
- Ligeramente más uso de la base de datos (pero dentro de límites gratuitos)

---

## 📋 Requisitos

- Git instalado
- Cuenta de [Cloudflare](https://dash.cloudflare.com/sign-up) (gratis)
- Cuenta de [GitHub](https://github.com/join) (gratis)

---

## 🚀 Pasos de Instalación

### 1. Obtener Cloudflare Account ID

1. Ve a https://dash.cloudflare.com
2. Inicia sesión
3. Copia el **Account ID** de la barra lateral derecha
4. Edita `wrangler.toml` y reemplaza `YOUR_ACCOUNT_ID`

### 2. Crear API Token

1. Ve a https://dash.cloudflare.com/profile/api-tokens
2. Click **"Create Token"**
3. Usa el template **"Edit Cloudflare Workers"**
4. Configura:
   - Account Resources: Include → Tu cuenta
   - Zone Resources: Include → All zones
5. Click **Continue** → **Create Token**
6. **Copia el token** (solo se muestra una vez)

### 3. Subir Código a GitHub

Ejecuta `setup-git.bat` (doble click):

```batch
setup-git.bat
```

Te pedirá:
- Tu nombre y email
- Tu usuario de GitHub
- Tu **GitHub Personal Access Token (Classic)**

Para crear el token:
1. https://github.com/settings/tokens/new
2. Selecciona **"Generate new token (classic)"**
3. Nombre: `StreamVault Deploy`
4. Scopes: ✅ `repo`, ✅ `workflow`
5. **Generate token** y cópialo

### 4. Configurar GitHub Secrets

Ve a tu repo en GitHub:
```
https://github.com/TU_USUARIO/streamvault/settings/secrets/actions
```

Agrega estos secrets:

| Secret | Valor |
|--------|-------|
| `CLOUDFLARE_API_TOKEN` | El token que creaste en paso 2 |
| `CLOUDFLARE_ACCOUNT_ID` | Tu Account ID del paso 1 |
| `VITE_API_URL` | `https://placeholder.workers.dev/api` (temporal) |

**Nota:** `VITE_WS_URL` **no es necesario** en esta versión (usamos polling HTTP).

### 5. Crear Infraestructura vía GitHub Actions

1. Ve a tu repo en GitHub → pestaña **"Actions"**
2. Selecciona **"Setup Cloudflare Infrastructure"**
3. Click **"Run workflow"** → Selecciona `setup-all` → **"Run"**

Esto creará:
- ✅ Base de datos D1 "iptv-db"
- ✅ Namespace KV "KV"

### 6. Actualizar IDs en wrangler.toml

En los logs del workflow anterior, busca:

```
┌──────────────────────────────────────┬───────────────┐
│ uuid                                 │ name          │
├──────────────────────────────────────┼───────────────┤
│ xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx │ iptv-db       │
└──────────────────────────────────────┴───────────────┘

┌──────────────────────────────────────┬──────┐
│ id                                   │ title│
├──────────────────────────────────────┼──────┤
│ xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx     │ KV   │
└──────────────────────────────────────┴──────┘
```

Copia estos IDs y edita `wrangler.toml`:
- Reemplaza `YOUR_D1_DATABASE_ID` con el uuid
- Reemplaza `YOUR_KV_NAMESPACE_ID` con el id

Súbelo:
```bash
git add wrangler.toml
git commit -m "Add D1 and KV IDs"
git push origin main
```

### 7. Aplicar Schema a la Base de Datos

1. Ve a **Actions** → **"Setup Cloudflare Infrastructure"**
2. Click **"Run workflow"** → Selecciona `apply-schema` → **"Run"**

Esto creará todas las tablas:
- `users`, `invite_links`, `events`, etc.
- `user_sessions` (presencia vía polling)
- `chat_messages` (chat vía polling)

### 8. Deploy del Worker

1. Ve a **Actions** → **"Setup Cloudflare Infrastructure"**
2. Click **"Run workflow"** → Selecciona `deploy-worker` → **"Run"**
3. En los logs, busca la URL del Worker:
   ```
   https://iptv-api.tu-subdomain.workers.dev
   ```

4. Actualiza el secret `VITE_API_URL` en GitHub:
   ```
   https://iptv-api.tu-subdomain.workers.dev/api
   ```

### 9. Configurar Secrets del Worker

1. Ve a https://dash.cloudflare.com
2. **Workers & Pages** → **"iptv-api"**
3. Pestaña **"Settings"** → **"Variables"**
4. Sección **"Worker Variables and Secrets"**
5. Click **"Add"** para cada secreto (selecciona **"Encrypt"**):

| Nombre | Valor | Cómo obtener |
|--------|-------|--------------|
| `JWT_SECRET` | String largo aleatorio | https://www.random.org/strings/ |
| `VAPID_PUBLIC_KEY` | Clave pública | https://web-push-codelab.glitch.me/ |
| `VAPID_PRIVATE_KEY` | Clave privada | Del generador anterior |
| `VAPID_SUBJECT` | `mailto:tu@email.com` | Tu email |

### 10. Deploy del Frontend

Cada push a `main` deploya el frontend automáticamente.

Haz un cambio pequeño y súbelo:
```bash
git add .
git commit -m "Trigger deploy"
git push origin main
```

Ve a **Actions** para ver el progreso. Cuando termine:

1. Ve a https://dash.cloudflare.com
2. **Workers & Pages** → Busca **"iptv-frontend"**
3. Tu app está en la URL que aparece allí

---

## 🎉 ¡Listo!

Tu aplicación está deployada **100% gratis**:

- **Frontend**: `https://iptv-frontend.pages.dev`
- **API**: `https://iptv-api.tu-subdomain.workers.dev`

### Cada push a `main` actualiza automáticamente todo.

---

## 📊 Límites y Uso Estimado

Para una app con **100 usuarios activos**:

| Recurso | Uso estimado/mes | Límite gratuito |
|---------|------------------|-----------------|
| Workers requests | ~300,000 | 3,000,000 |
| D1 queries | ~500,000 | 5,000,000 |
| KV reads | ~1,000,000 | 10,000,000 |
| KV storage | <10 MB | 1 GB |

✅ **Todo dentro del plan gratuito**

---

## 🔄 Diferencias con WebSockets

| Característica | WebSockets (pago) | Polling (gratis) |
|----------------|-------------------|------------------|
| Chat en tiempo real | Instantáneo | ~3 segundos delay |
| Presencia | Instantánea | ~10-30 segundos delay |
| Costo | $5+/mes | $0 |
| Setup | Complejo | Simple |

---

## 🛠️ Troubleshooting

### "database_id not found"
- Verifica que actualizaste `wrangler.toml` con el ID correcto
- Asegúrate de haber hecho commit y push

### "KV namespace not found"
- Similar al anterior, verifica el ID en `wrangler.toml`

### Chat no funciona
- Verifica que aplicaste el schema (`apply-schema` workflow)
- Revisa los logs del Worker en Cloudflare Dashboard

### Worker secrets no funcionan
- Asegúrate de marcarlos como **"Encrypted"** en el Dashboard
- Los secrets no se aplican hasta el próximo deploy

---

## 📚 Archivos Modificados para Versión Gratuita

| Archivo | Cambio |
|---------|--------|
| `wrangler.toml` | Removidos Durable Objects |
| `schema.sql` | Agregadas tablas `user_sessions` y `chat_messages` |
| `workers/src/index.ts` | Removidos endpoints WebSocket |
| `workers/src/routes/chat.ts` | **Nuevo** - Endpoints de polling para chat |
| `workers/src/routes/presence.ts` | **Nuevo** - Endpoints de polling para presencia |
| `workers/src/types.ts` | Removidos tipos de Durable Objects |
| `frontend/src/lib/polling.ts` | **Nuevo** - Cliente de polling HTTP |
| `frontend/src/lib/websocket.ts` | Ya no se usa (opcional mantener) |
| `frontend/src/components/ChatPanel.tsx` | Actualizado para usar polling |
| `frontend/src/components/PlayerModal.tsx` | Actualizado para usar polling |
| `frontend/src/components/NavBar.tsx` | Actualizado para usar polling |

---

**¿Preguntas?** Revisa `SETUP-NO-LOCAL-TOOLS.md` para una guía más detallada (aunque esa guía asumía Durable Objects, los pasos son similares).
