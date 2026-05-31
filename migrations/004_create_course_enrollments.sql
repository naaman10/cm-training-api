-- User enrollments in Contentful courses (status tracked in Neon)
CREATE TABLE IF NOT EXISTS course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contentful_course_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'enrolled',
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, contentful_course_id),
  CONSTRAINT course_enrollments_status_check
    CHECK (status IN ('enrolled', 'completed'))
);

CREATE INDEX IF NOT EXISTS idx_course_enrollments_user_id ON course_enrollments (user_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_contentful_course_id ON course_enrollments (contentful_course_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_user_status ON course_enrollments (user_id, status);

COMMENT ON TABLE course_enrollments IS 'Portal user enrollment in Contentful courses; contentful_course_id is the Contentful entry id.';
COMMENT ON COLUMN course_enrollments.status IS 'enrolled = in progress; completed = user marked course complete';
