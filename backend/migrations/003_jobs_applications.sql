-- Minimal job catalogue (the Employer module will extend it) + candidate job activity.

CREATE TABLE jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title            VARCHAR(160) NOT NULL,
  company_name     VARCHAR(160) NOT NULL,
  description      TEXT,
  role_type        VARCHAR(80),
  commitment       VARCHAR(40),
  rate_from        NUMERIC(8,2) CHECK (rate_from >= 0),
  rate_to          NUMERIC(8,2) CHECK (rate_to >= 0),
  location         VARCHAR(120),
  experience_level VARCHAR(40),
  status           VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','paused','closed')),
  posted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  CHECK (rate_to IS NULL OR rate_from IS NULL OR rate_to >= rate_from)
);
CREATE INDEX idx_jobs_status_posted ON jobs (status, posted_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_jobs_employer ON jobs (employer_id);

CREATE TABLE job_skills (
  job_id   UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  PRIMARY KEY (job_id, skill_id)
);
CREATE INDEX idx_job_skills_skill ON job_skills (skill_id);

CREATE TABLE saved_jobs (
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  job_id       UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  saved_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (candidate_id, job_id)
);

CREATE TABLE applications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id      UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  job_id            UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status            VARCHAR(30) NOT NULL DEFAULT 'applied'
                    CHECK (status IN ('applied','in_review','shortlisted','interview_scheduled',
                                      'offer_received','accepted','rejected','withdrawn')),
  match_score       SMALLINT CHECK (match_score BETWEEN 0 AND 100),
  applied_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  withdrawn_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (candidate_id, job_id)
);
CREATE INDEX idx_applications_candidate_status ON applications (candidate_id, status);
CREATE INDEX idx_applications_job ON applications (job_id);

CREATE TABLE application_status_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  from_status    VARCHAR(30),
  to_status      VARCHAR(30) NOT NULL,
  changed_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  note           VARCHAR(300),
  changed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_app_history_application ON application_status_history (application_id, changed_at);

CREATE TRIGGER trg_jobs_updated         BEFORE UPDATE ON jobs         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_applications_updated BEFORE UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION set_updated_at();
