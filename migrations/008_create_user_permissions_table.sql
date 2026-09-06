-- User permissions: many-to-many relationship between users and features
CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by UUID REFERENCES users(id),
  UNIQUE(user_id, feature_id)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_feature_id ON user_permissions (feature_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_granted_by ON user_permissions (granted_by);

COMMENT ON TABLE user_permissions IS 'Per-user feature access grants; admin role bypasses these checks';
COMMENT ON COLUMN user_permissions.granted_by IS 'Admin user who granted this permission (null for system grants)';
