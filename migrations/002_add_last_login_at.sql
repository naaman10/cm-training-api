-- Last successful login sync from Auth0 (stored as UTC; format for UK in the API layer)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

COMMENT ON COLUMN users.last_login_at IS 'Updated when the user hits GET /api/auth/me after Auth0 login; timestamptz (UTC). Use Europe/London for UK display.';
