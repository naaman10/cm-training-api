-- Features table: tracks available features in the application
CREATE TABLE IF NOT EXISTS features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_features_name ON features (name);
CREATE INDEX IF NOT EXISTS idx_features_is_active ON features (is_active);

COMMENT ON TABLE features IS 'Application features that can be granted to users on a per-user basis';
COMMENT ON COLUMN features.name IS 'Unique feature identifier (e.g., "user_management", "reports", or action-level like "social:create")';
COMMENT ON COLUMN features.is_active IS 'Whether the feature is currently active in the application';

-- Seed existing features
INSERT INTO features (name, description, is_active) VALUES
  ('user_management', 'Manage users and their permissions', true),
  ('courses', 'Access to course catalog and content', true),
  ('enrollments', 'Enroll in and complete courses', true),
  ('lessons', 'Access lesson content and submit answers', true)
ON CONFLICT (name) DO NOTHING;
