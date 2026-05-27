-- Approved application users (admin-provisioned; no public sign-up via this API)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth0_user_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_auth0_user_id ON users (auth0_user_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);

COMMENT ON TABLE users IS 'Users linked to Auth0; JWT validates identity. Portal access denied only when status is suspended/blocked.';
COMMENT ON COLUMN users.auth0_user_id IS 'Auth0 subject (sub) from access token';
COMMENT ON COLUMN users.status IS 'Portal access denied only for: suspended | blocked. Other values (active, pending, inactive, …) allow access once the row exists.';
