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
  middleware/
    auth.js          # JWT + app user approval
    permissions.js   # requirePermission()
  routes/
    auth.js
    adminUsers.js
migrations/
  001_create_users_table.sql
```

## Deploy on Render

Render may default to Node 26+, which `express-oauth2-jwt-bearer` does not support yet. This repo pins **Node 22.12.0** via `.node-version`, `package.json` `engines`, and `NODE_VERSION` in `render.yaml`.

If the dashboard build still uses Yarn and fails, set **Build Command** to `npm ci` (or ensure `package-lock.json` is committed and no `yarn.lock` is present).
