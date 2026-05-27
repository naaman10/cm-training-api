# CM Training API

Express API for the driving instructor training portal. The frontend calls this Render-hosted API; **Auth0** validates identity; **Neon Postgres** stores users, approval status, and **last login**; this API enforces **permissions** from the JWT.

On each **`GET /api/auth/me`**, the API **upserts** the user from the access token and sets **`last_login_at`** (stored as UTC in Neon; responses include **`lastLoginAtUk`** formatted for Europe/London). New users are created with **`status = active`** by default. **`403`** on this route means the account was explicitly marked **`suspended`** or **`blocked`** in Neon — not “pending approval.”

Public sign-up is disabled in Auth0; the API does not accept passwords or registration posts.

## Setup

```bash
npm install
cp .env.example .env.local
```

Configure `.env.local`:

| Variable | Description |
|----------|-------------|
| `AUTH0_DOMAIN` | Auth0 tenant domain |
| `AUTH0_AUDIENCE` | Auth0 API identifier |
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `FRONTEND_ORIGIN` | Allowed CORS origin (frontend URL) |
| `PORT` | Server port (default `3001`) |
| `DEFAULT_NEW_USER_ROLE` | Optional. Role for first-time synced users (default `learner`) |
| `AUTH0_EMAIL_CLAIM` | Optional. Custom access-token claim key for email if not using `email` |

### Auth0 access token (first login)

`GET /api/auth/me` needs an **email** on the access token for **brand-new** users (so Neon can satisfy `email NOT NULL UNIQUE`). Add an **Auth0 Action** on login that copies `event.user.email` into `api.accessToken.setCustomClaim('email', ...)` or ensure the standard **`email`** claim is on the access token for your API audience.

Optional: set `AUTH0_EMAIL_CLAIM` to a custom claim name if you use a namespaced key.

```bash
npm run db:migrate
```

### Auth0

1. Create an API and set `AUTH0_AUDIENCE` to its identifier.
2. Add an Action (or Rule) so the **access token** includes **`email`** for that API (required for first-time user row creation).
3. Enable RBAC and **Add Permissions in the Access Token**.
4. Add permission `users:read` for the admin list endpoint.
5. Assign roles/permissions to users as needed.

### Run

```bash
npm run dev
```

With `NODE_ENV` not equal to `production`, **Swagger UI** is at [http://localhost:3001/api-docs](http://localhost:3001/api-docs).

### Swagger (development only)

- UI: `GET /api-docs` — enabled when **`NODE_ENV` is not `production`** (omit or set `development` locally).
- New routes live under `src/routes/`; document each endpoint with an **`@openapi`** JSDoc block (YAML path). All files matching `src/routes/**/*.js` are scanned.
- **Production:** Render sets `NODE_ENV=production`; docs are disabled.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | None | Liveness |
| `GET` | `/api/auth/me` | Bearer token | Upsert user + `last_login_at`; **`403` only if suspended/blocked** |
| `GET` | `/api/admin/users` | Bearer + `users:read` | List users (admin) |

### `GET /api/auth/me`

1. Validates Auth0 access token (`express-oauth2-jwt-bearer`).
2. Upserts Neon row from token (`auth0_user_id` = `sub`), sets **`last_login_at`**, syncs name/email when present. New rows use `status = active` and `DEFAULT_NEW_USER_ROLE` (default `learner`).
3. Returns **`403`** only if `status` is **`suspended`** or **`blocked`**; **`400`** if first visit and access token has no email claim; **`409`** if email collides with another user.
4. Returns safe profile (`lastLoginAt` UTC ISO + `lastLoginAtUk` for display).

### Errors

| Status | When |
|--------|------|
| `401` | Missing or invalid token |
| `400` | First login without email on access token |
| `403` | **`GET /api/auth/me`:** account suspended or blocked. **Admin routes:** missing permission or suspended/blocked |
| `404` | No Neon profile (rare after sync; e.g. race) |
| `409` | Email already linked to another Auth0 user |
| `500` | Server error |

## Project layout

```
src/
  server.js
  db.js
  loadEnv.js
  swagger/
    swagger.js   # swagger-jsdoc spec + Swagger UI mount (non-production only)
  middleware/
    auth.js          # JWT + load user; 403 only suspended/blocked
    syncUserOnLogin.js  # upsert + last_login_at (GET /api/auth/me only)
    permissions.js   # requirePermission()
  routes/
    health.js      # GET /health
    auth.js
    adminUsers.js
migrations/
  001_create_users_table.sql
```

## Deploy on Render

Render may default to Node 26+, which `express-oauth2-jwt-bearer` does not support yet. This repo pins **Node 22.12.0** via `.node-version`, `package.json` `engines`, and `NODE_VERSION` in `render.yaml`.

### Required environment variables (Render Dashboard)

These **must** have values in **Render → your service → Environment**. The app exits on startup if any are missing.

| Variable | Example | Purpose |
|----------|---------|---------|
| `AUTH0_DOMAIN` | `dev-xxxx.us.auth0.com` | Auth0 tenant |
| `AUTH0_AUDIENCE` | `https://api.cm-training.app` | Auth0 API **Identifier** (not the SPA client ID) |
| `DATABASE_URL` | `postgresql://...?sslmode=verify-full` | Neon connection string |
| `FRONTEND_ORIGIN` | `https://your-app.vercel.app` | Production frontend URL for CORS (no trailing slash) |

Optional:

| Variable | Notes |
|----------|--------|
| `PORT` | Render usually sets this automatically; default `3001` if unset |
| `NODE_ENV` | `production` (often set in `render.yaml`) |
| `APP_BASE_URL` | **Not used** by this API — safe to omit |

`AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, and `AUTH0_SECRET` are for the **frontend** login app, not this API.

### Build / start commands

- **Build:** `npm ci`
- **Start:** `npm start` (not `yarn start`, unless you maintain a `yarn.lock`)

If the build still uses Yarn, change the start command in the Render dashboard to `npm start`.
