-- AI interview sessions, questions, answers and scores.

CREATE TABLE interview_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id   UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  job_id         UUID REFERENCES jobs(id) ON DELETE SET NULL,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  retake_of      UUID REFERENCES interview_sessions(id) ON DELETE SET NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'scheduled'
                 CHECK (status IN ('scheduled','in_progress','completed','abandoned')),
  overall_score  NUMERIC(5,2) CHECK (overall_score BETWEEN 0 AND 100),
  scoring_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (scoring_status IN ('pending','scored','failed')),
  scheduled_at   TIMESTAMPTZ,
  started_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_interviews_candidate ON interview_sessions (candidate_id, created_at DESC);

CREATE TABLE interview_questions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  position      SMALLINT NOT NULL,
  category      VARCHAR(40) NOT NULL,
  question_text TEXT NOT NULL,
  UNIQUE (session_id, position)
);

CREATE TABLE interview_answers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL UNIQUE REFERENCES interview_questions(id) ON DELETE CASCADE,
  transcript  TEXT NOT NULL,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE interview_scores (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  category   VARCHAR(40) NOT NULL,
  score      NUMERIC(5,2) NOT NULL CHECK (score BETWEEN 0 AND 100),
  feedback   TEXT,
  UNIQUE (session_id, category)
);

CREATE TRIGGER trg_interviews_updated BEFORE UPDATE ON interview_sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
