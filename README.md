# StreamVault — Private IPTV Streaming Platform

A private, invite-only IPTV streaming web app built on the Cloudflare stack.

---

## 🚀 Opciones de Instalación

### ✅ Opción Recomendada: 100% Gratuito (Sin Durable Objects)
Esta versión usa **polling HTTP** en lugar de WebSockets, permitiendo usar el **plan gratuito** de Cloudflare:

- Workers: 100,000 requests/día
- Pages: Ilimitado
- D1: 5M queries/mes
- KV: 1GB storage

**👉 Sigue: [SETUP-FREE.md](SETUP-FREE.md)**

### Alternativa: Con Durable Objects (requiere plan pago $5+/mes)
Si necesitas chat en tiempo real con WebSockets:

- **[SETUP-NO-LOCAL-TOOLS.md](SETUP-NO-LOCAL-TOOLS.md)** - Sin instalar nada localmente
- **[SETUP.md](SETUP.md)** - Con Node.js + Wrangler CLI

---

## GitHub → Cloudflare Pages (CI/CD)

El repositorio incluye GitHub Actions workflows que automatizan el deploy:

| Workflow | Descripción | Cuándo corre |
|----------|-------------|--------------|
| `deploy.yml` | Deploy Worker + Frontend | Automático en cada push a `main` |
| `setup-infrastructure.yml` | Crear D1, KV, aplicar schema | Manual (primera vez) |

### Secrets Requeridos en GitHub

Ve a tu repo → **Settings → Secrets and variables → Actions** y agrega:

| Secret | Cómo obtenerlo | Requerido en versión |
|--------|---------------|---------------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare Dashboard → My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" template | Ambas |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Dashboard → sidebar derecho | Ambas |
| `VITE_API_URL` | URL de tu Worker + `/api` | Ambas |
| `VITE_WS_URL` | URL WebSocket (ej: `wss://...`) | Solo con Durable Objects |

> El API token necesita permisos: **Workers:Edit**, **Pages:Edit**, **D1:Edit**, **KV:Edit**

### Secrets del Worker (sensibles)

Configura en **Cloudflare Dashboard** → Workers & Pages → iptv-api → Settings → Variables:

| Secret | Descripción |
|--------|-------------|
| `JWT_SECRET` | String aleatorio para firmar tokens (genera en random.org) |
| `VAPID_PUBLIC_KEY` | Para Web Push (genera en web-push-codelab.glitch.me) |
| `VAPID_PRIVATE_KEY` | Par de la clave pública |
| `VAPID_SUBJECT` | `mailto:tu-email@ejemplo.com` |
| `FRONTEND_URL` | `https://iptv-frontend.pages.dev` |

**Nota:** Estos secrets también pueden configurarse vía Wrangler CLI si lo tienes instalado:
```bash
cd workers
wrangler secret put JWT_SECRET
wrangler secret put VAPID_PUBLIC_KEY
# ... etc
```

---

## Stack

| Layer | Technology (Versión Gratuita) |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Hosting | Cloudflare Pages |
| Backend | Cloudflare Workers (Hono router) |
| Database | Cloudflare D1 (SQLite) |
| Cache | Cloudflare KV |
| Real-time | **Polling HTTP** (alternativa gratuita a WebSockets) |
| Cron | Workers Cron Triggers |
| Push | Web Push API + VAPID + Service Worker |

> **Nota:** La versión gratuita usa polling HTTP cada 3s para chat y cada 10-30s para presencia, en lugar de WebSockets (que requieren Durable Objects de pago).

---

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/): `npm install -g wrangler`
- A Cloudflare account (free tier works)

---

## Step 1 — Clone & install dependencies

```bash
# Install Workers dependencies
cd workers
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

---

## Step 2 — Create Cloudflare resources

### D1 Database

```bash
wrangler d1 create iptv-db
```

Copy the `database_id` from the output and paste it into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "iptv-db"
database_id = "YOUR_D1_DATABASE_ID"   # <-- paste here
```

Run the schema migration:

```bash
wrangler d1 execute iptv-db --file=schema.sql
```

### KV Namespace

```bash
wrangler kv:namespace create KV
```

Copy the `id` from the output into `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "KV"
id = "YOUR_KV_NAMESPACE_ID"   # <-- paste here
```

---

## Step 3 — Generate secrets

### JWT Secret

Generate a random 64-character string:

```bash
openssl rand -hex 32
```

Set it as a Worker secret:

```bash
wrangler secret put JWT_SECRET
```

### VAPID Keys (for push notifications)

```bash
npx web-push generate-vapid-keys
```

This outputs a public and private key. Set them:

```bash
wrangler secret put VAPID_PUBLIC_KEY
wrangler secret put VAPID_PRIVATE_KEY
wrangler secret put VAPID_SUBJECT
# VAPID_SUBJECT is typically "mailto:admin@yourdomain.com"
```

Also set `VAPID_PUBLIC_KEY` as a frontend environment variable (see Step 5).

---

## Step 4 — Deploy the Worker

```bash
cd workers
wrangler deploy
```

Note the Worker URL — it will look like `https://iptv-api.YOUR-SUBDOMAIN.workers.dev`.

---

## Step 5 — Seed the admin account

After deploying, create the initial admin user by calling the seed endpoint:

```bash
curl -X POST https://iptv-api.YOUR-SUBDOMAIN.workers.dev/api/admin/seed \
  -H "Content-Type: application/json" \
  -d '{"secret":"YOUR_JWT_SECRET","email":"admin@example.com","password":"your-strong-password"}'
```

The response includes a `totp_uri` — scan the QR code with your authenticator app, then confirm the code at `POST /api/invite/confirm-totp`.

Alternatively you can use:

```bash
wrangler d1 execute iptv-db --command "INSERT INTO users (id, email, password_hash, totp_secret, totp_confirmed, role, active) VALUES ('admin-seed', 'admin@example.com', '<hashed>', NULL, 0, 'admin', 1);"
```

But the seed endpoint is easier since it handles hashing automatically.

---

## Step 6 — Build and deploy the frontend

### Configure environment variables

Create `frontend/.env.production`:

```env
VITE_API_URL=https://iptv-api.YOUR-SUBDOMAIN.workers.dev/api
VITE_WS_URL=wss://iptv-api.YOUR-SUBDOMAIN.workers.dev
```

For local development create `frontend/.env.local`:

```env
VITE_API_URL=/api
VITE_WS_URL=
```

### Build

```bash
cd frontend
npm run build
```

### Deploy to Cloudflare Pages

Option A — using Wrangler:

```bash
wrangler pages deploy dist --project-name iptv-frontend
```

Option B — connect your GitHub repository to Cloudflare Pages dashboard and set:

- Build command: `cd frontend && npm install && npm run build`
- Build output directory: `frontend/dist`
- Environment variables:
  - `VITE_API_URL` = your Worker URL + `/api`
  - `VITE_WS_URL` = `wss://iptv-api.YOUR-SUBDOMAIN.workers.dev`

---

## Step 7 — Configure CORS

In `wrangler.toml` (or Worker secrets), set `FRONTEND_URL` to your Pages URL:

```bash
wrangler secret put FRONTEND_URL
# Enter: https://YOUR-PROJECT.pages.dev
```

---

## Step 8 — Trigger the first KV cache refresh

The KV refresh cron runs every 6 hours. To populate it immediately:

```bash
wrangler dev  # start local Worker
# Then trigger the cron:
curl "http://localhost:8787/__scheduled?cron=0+%2F6+*+*+*"
```

Or in production, wait up to 6 hours, or trigger via Cloudflare dashboard → Workers → Triggers → Run Cron.

---

## Local Development

### Worker (backend)

```bash
cd workers
wrangler dev
# Runs at http://localhost:8787
```

### Frontend

```bash
cd frontend
npm run dev
# Runs at http://localhost:5173
# Proxies /api to :8787 via vite.config.ts
```

---

## Architecture Overview

```
Browser
  ├── GET /api/*           → Cloudflare Workers (Hono router)
  │     ├── D1             → Users, invites, events, streams, push subs
  │     ├── KV             → Channel/stream/EPG cache (from iptv-org)
  │     └── Durable Obj.   → ChannelRoom (WS + presence + chat)
  │                           SitePresence (site-wide viewer count)
  ├── WebSocket /api/ws/:channelId → ChannelRoom Durable Object
  └── Push notifications  → Service Worker ← Worker VAPID push
```

### Cron triggers

| Cron | Purpose |
|------|---------|
| `0 */6 * * *` | Refresh iptv-org data into KV |
| `* * * * *` | Send push notifications for upcoming events |

---

## Environment Variables Reference

| Variable | Where | Description |
|----------|-------|-------------|
| `JWT_SECRET` | Worker secret | Signs/verifies JWT session tokens |
| `TOTP_ISSUER_NAME` | `wrangler.toml` | Shown in authenticator app (e.g. "StreamVault") |
| `VAPID_PUBLIC_KEY` | Worker secret + frontend env | VAPID public key for Web Push |
| `VAPID_PRIVATE_KEY` | Worker secret | VAPID private key |
| `VAPID_SUBJECT` | Worker secret | `mailto:admin@yourdomain.com` |
| `FRONTEND_URL` | Worker secret | Frontend Pages URL (for CORS) |
| `VITE_API_URL` | Frontend env | Worker API base URL |
| `VITE_WS_URL` | Frontend env | Worker WebSocket base URL |

---

## Features

- **Invite-only registration** — admin generates single-use invite links
- **TOTP 2FA** — mandatory authenticator app for all users
- **Channel grid + TV Guide** — two views with live EPG data
- **HLS streaming** — hls.js player with automatic fallback streams
- **Real-time presence & chat** — per-channel via Durable Objects WebSockets
- **Featured events** — schedule highlighted events with countdown timers
- **Push notifications** — Web Push for event reminders (5/15/30 min lead time)
- **NSFW filtering** — hidden by default, admin-controlled per user
- **iptv-org blocklist** — blocked channels are never shown
- **Admin panel** — user management, invite links, event scheduling, stream moderation

---

## Notes & Limitations

- **Stream CORS**: Some HLS streams will fail in-browser due to CORS policies from the stream origin. The player automatically tries the next available stream. If all streams fail, a "Stream unavailable in browser" message is shown.
- **Referrer/User-Agent headers**: Cannot be set on cross-origin requests from the browser. The `http_referrer` and `user_agent` fields from iptv-org are noted but can only partially be applied via hls.js `xhrSetup`.
- **EPG data**: Channel EPG is fetched from `GET /api/channels/:id/epg`, which reads from KV keys `epg:<channelId>`. The cron job populates these from the iptv-org EPG guides when available.
- **Durable Objects**: Require a paid Cloudflare Workers plan.
