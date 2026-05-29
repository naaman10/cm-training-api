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
| `AUTH0_M2M_CLIENT_ID` | Auth0 M2M app client ID (Management API + DB password reset trigger) |
| `AUTH0_M2M_CLIENT_SECRET` | Auth0 M2M app client secret |
| `AUTH0_DB_CONNECTION` | Auth0 database connection name (for create user + password reset) |
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `FRONTEND_ORIGIN` | Allowed CORS origin (frontend URL) |
| `PORT` | Server port (default `3001`) |
| `DEFAULT_NEW_USER_ROLE` | Optional. Used when JWT has **no roles claim** (`AUTH0_ROLES_CLAIM`), on **insert only** |
| `AUTH0_EMAIL_CLAIM` | Optional. Custom access-token claim key for email if not using `email` |
| `AUTH0_ROLES_CLAIM` | Optional but **recommended** — claim name Auth0 Actions use to put RBAC roles on the **access token** |
| `CONTENTFUL_SPACE_ID` | Contentful space ID (required when using Contentful routes) |
| `CONTENTFUL_ACCESS_TOKEN` | Content Delivery API access token (published content) |
| `CONTENTFUL_ENVIRONMENT` | Optional. Contentful environment id (default `master`) |
| `CONTENTFUL_PREVIEW_ACCESS_TOKEN` | Optional. Preview API token for draft content |

### Contentful

Install is included (`contentful` npm package). Configure delivery credentials in `.env.local`:

- **`CONTENTFUL_SPACE_ID`** — Settings → General settings in Contentful
- **`CONTENTFUL_ACCESS_TOKEN`** — Settings → API keys → Content delivery / preview → Delivery API token
- **`CONTENTFUL_ENVIRONMENT`** — optional (default `master`)
- **`CONTENTFUL_PREVIEW_ACCESS_TOKEN`** — optional; use with `getContentfulPreviewClient()` for draft content

Client helpers live in `src/contentful/client.js` (`getContentfulDeliveryClient`, `getContentfulPreviewClient`). Contentful env vars are **not** required at server startup until you add routes that use them.

### Auth0 access token (first login)

`GET /api/auth/me` needs an **email** on the access token for **brand-new** users (so Neon can satisfy `email NOT NULL UNIQUE`). Add an **Auth0 Action** on login that copies `event.user.email` into `api.accessToken.setCustomClaim('email', ...)` or ensure the standard **`email`** claim is on the access token for your API audience.

**Roles:** Auth0 RBAC roles are **not** on API access tokens by default. Trigger a Login / Credentials Action for your SPA (and target your API identifier) so the token includes roles, for example namespaced roles as string array:

```js
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://your-app.example.com/';
  if (event.authorization?.roles?.length) {
    const names = event.authorization.roles.map((r) => r.name);
    api.accessToken.setCustomClaim(`${namespace}roles`, names);
  }
};
```

Set **`AUTH0_ROLES_CLAIM`** to the full claim key (here `https://your-app.example.com/roles`). The API copies that claim into Neon `role` **on each successful sync** (`users.role` stays unchanged if no claim).

Optional: set `AUTH0_EMAIL_CLAIM` to a custom claim name if you use a namespaced key.

### Database

```bash
npm run db:migrate
```

### Auth0 checklist

1. Create an API and set `AUTH0_AUDIENCE` to its identifier.
2. Add an Action (or Rule) so the **access token** includes **`email`** for that API (required for first-time user row creation).
3. Add **`AUTH0_ROLES_CLAIM`** and an Action so the access token exposes role names — see snippet above (`namespace/roles`).
4. Enable RBAC and **Add Permissions in the Access Token**.
5. Add permission `users:read` for the admin list endpoint.
6. Assign roles/permissions to users as needed.
7. For the M2M app (Management API), also grant: `read:roles`, `create:role_memberships`, `delete:role_memberships` — required when admin create/update syncs Auth0 RBAC roles with Neon `users.role`.

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
| `POST` | `/api/admin/users` | Bearer + `users:write` + admin role | Create Auth0 user and Neon user row |
| `PATCH` | `/api/admin/users/:id` | Bearer + `users:write` + admin role | Edit Auth0 profile + RBAC roles and sync Neon |
| `POST` | `/api/admin/users/:id/deactivate` | Bearer + `users:write` + admin role | Block in Auth0 and set Neon status to `inactive` |
| `POST` | `/api/admin/users/:id/password-reset` | Bearer + `users:write` + admin role | Trigger Auth0 reset email and touch Neon `updated_at` |
| `GET` | `/api/courses` | Bearer token | List courses for caller's role (`lessonCount` only, no lessons) |
| `GET` | `/api/courses/:id` | Bearer token | Course detail + prerequisites; admins see all courses |

### `GET /api/courses`

1. Validates Auth0 JWT and loads Neon user (`checkJwt`, `loadAppUser`).
2. Fetches published Contentful `course` entries.
3. Filters by **courseRole** (sanitized to lowercase): instructors see `instructor` courses, learners see `learner`, **admins see all**.
4. Returns `{ courses: [...] }` with `lessonCount` (linked lesson count, not lesson content).

Requires `CONTENTFUL_SPACE_ID` and `CONTENTFUL_ACCESS_TOKEN` (returns **503** if unset).

### `GET /api/auth/me`

1. Validates Auth0 access token (`express-oauth2-jwt-bearer`).
2. Upserts Neon row from token (`auth0_user_id` = `sub`), sets **`last_login_at`**, syncs name/email/`role` from JWT when **`AUTH0_ROLES_CLAIM`** + Action supply roles (else insert uses **`DEFAULT_NEW_USER_ROLE`**).
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
  contentful/
    client.js      # Contentful Delivery / Preview clients
    courseRole.js  # Role sanitization + access filter
    mapCourse.js   # Entry → API response shapes
    fetchCourses.js
  routes/
    health.js      # GET /health
    auth.js
    adminUsers.js
    courses.js     # GET /api/courses
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
| `CONTENTFUL_SPACE_ID` | Contentful space (when serving CMS content) |
| `CONTENTFUL_ACCESS_TOKEN` | Content Delivery API token |
| `CONTENTFUL_ENVIRONMENT` | e.g. `master` (default if unset) |
| `CONTENTFUL_PREVIEW_ACCESS_TOKEN` | Preview API token for draft content |

`AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, and `AUTH0_SECRET` are for the **frontend** login app, not this API.

### Build / start commands

- **Build:** `npm ci`
- **Start:** `npm start` (not `yarn start`, unless you maintain a `yarn.lock`)

If the build still uses Yarn, change the start command in the Render dashboard to `npm start`.
