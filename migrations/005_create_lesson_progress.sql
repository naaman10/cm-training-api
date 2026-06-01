-- Per-user lesson progress within enrolled courses
CREATE TABLE IF NOT EXISTS lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contentful_course_id TEXT NOT NULL,
  contentful_lesson_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'started',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, contentful_course_id, contentful_lesson_id),
  CONSTRAINT lesson_progress_status_check
    CHECK (status IN ('started', 'completed'))
);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_course
  ON lesson_progress (user_id, contentful_course_id);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_lesson
  ON lesson_progress (user_id, contentful_lesson_id);

COMMENT ON TABLE lesson_progress IS 'User progress on Contentful lessons within a course.';
COMMENT ON COLUMN lesson_progress.contentful_course_id IS 'Contentful course entry id.';
COMMENT ON COLUMN lesson_progress.contentful_lesson_id IS 'Contentful lesson entry id.';
COMMENT ON COLUMN lesson_progress.status IS 'started = user began lesson; completed = lesson finished (future endpoint).';
