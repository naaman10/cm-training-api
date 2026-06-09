-- Per-question answers within a lesson (one row per user + question)
CREATE TABLE IF NOT EXISTS lesson_question_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contentful_course_id TEXT NOT NULL,
  contentful_lesson_id TEXT NOT NULL,
  contentful_question_id TEXT NOT NULL,
  contentful_answer_id TEXT NOT NULL,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, contentful_course_id, contentful_lesson_id, contentful_question_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_question_answers_user_course
  ON lesson_question_answers (user_id, contentful_course_id);

CREATE INDEX IF NOT EXISTS idx_lesson_question_answers_user_lesson
  ON lesson_question_answers (user_id, contentful_course_id, contentful_lesson_id);

COMMENT ON TABLE lesson_question_answers IS 'User selected answers for Contentful lesson questions.';
COMMENT ON COLUMN lesson_question_answers.contentful_question_id IS 'Contentful questions entry id.';
COMMENT ON COLUMN lesson_question_answers.contentful_answer_id IS 'Contentful answer entry id selected by the user.';
