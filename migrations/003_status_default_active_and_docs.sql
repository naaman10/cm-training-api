-- New rows default to approved for portal sync; admins use suspended/blocked to deny access explicitly.
ALTER TABLE users
  ALTER COLUMN status SET DEFAULT 'active';

COMMENT ON TABLE users IS 'Users linked to Auth0; JWT validates identity. Portal access denied only when status is suspended/blocked.';
COMMENT ON COLUMN users.status IS 'Portal access denied only for: suspended | blocked. Other values (active, pending, inactive, …) allow access once the row exists.';
