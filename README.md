# CM Training API

Express API for the driving instructor training portal. The frontend calls this Render-hosted API; **Auth0** validates identity; **Neon Postgres** stores admin-provisioned users and approval status; this API enforces **permissions** from the JWT.

Public sign-up is disabled in Auth0. Users must be created in Neon by an admin and set to `status = 'active'` before they can use the app.

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

### Database

```bash
npm run db:migrate
```

### Auth0

1. Create an API and set `AUTH0_AUDIENCE` to its identifier.
2. Enable RBAC and **Add Permissions in the Access Token**.
3. Add permission `users:read` for the admin list endpoint.
4. Assign roles/permissions to users as needed.

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
| `GET` | `/api/auth/me` | Bearer token | Current user profile (active Neon user only) |
| `GET` | `/api/admin/users` | Bearer + `users:read` | List users (admin) |

### `GET /api/auth/me`

1. Validates Auth0 access token (`express-oauth2-jwt-bearer`).
2. Loads user by `auth0_user_id` = `sub`.
3. Returns `404` if not in Neon, `403` if not `active`.
4. Returns safe profile + token permissions.

### Errors

| Status | When |
|--------|------|
| `401` | Missing or invalid token |
| `403` | Inactive user or missing permission |
| `404` | No Neon profile for Auth0 user |
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
    auth.js          # JWT + app user approval
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
