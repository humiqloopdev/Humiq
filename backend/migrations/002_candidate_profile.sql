-- Candidate identity, preferences, skills, certifications, resumes.

CREATE TABLE candidate_profiles (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  first_name           VARCHAR(80),
  last_name            VARCHAR(80),
  phone                VARCHAR(30),
  headline             VARCHAR(160),
  primary_role         VARCHAR(100),
  experience_level     VARCHAR(40),
  years_experience     SMALLINT CHECK (years_experience BETWEEN 0 AND 60),
  location             VARCHAR(120),
  timezone             VARCHAR(60),
  availability         VARCHAR(60),
  bio                  TEXT,
  profile_score        SMALLINT NOT NULL DEFAULT 0 CHECK (profile_score BETWEEN 0 AND 100),
  onboarding_step      SMALLINT NOT NULL DEFAULT 1 CHECK (onboarding_step BETWEEN 1 AND 6),
  onboarding_completed BOOLEAN  NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ
);

CREATE TABLE candidate_preferences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id    UUID NOT NULL UNIQUE REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  commitment      VARCHAR(40),
  min_rate        NUMERIC(8,2) CHECK (min_rate >= 0),
  preferred_rate  NUMERIC(8,2) CHECK (preferred_rate >= 0),
  timezone        VARCHAR(60),
  availability    VARCHAR(60),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (preferred_rate IS NULL OR min_rate IS NULL OR preferred_rate >= min_rate)
);

CREATE TABLE skills (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX uq_skills_name ON skills (LOWER(name));

CREATE TABLE candidate_skills (
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  skill_id     UUID NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  proficiency  VARCHAR(20) NOT NULL DEFAULT 'intermediate'
               CHECK (proficiency IN ('beginner','intermediate','advanced','expert')),
  source       VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','resume')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (candidate_id, skill_id)
);
CREATE INDEX idx_candidate_skills_skill ON candidate_skills (skill_id);

CREATE TABLE candidate_certifications (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id   UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  name           VARCHAR(160) NOT NULL,
  issuer         VARCHAR(120),
  issued_on      DATE,
  expires_on     DATE,
  credential_url VARCHAR(300),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_certifications_candidate ON candidate_certifications (candidate_id);

CREATE TABLE candidate_resumes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  file_name    VARCHAR(255) NOT NULL,
  file_path    VARCHAR(500) NOT NULL,
  mime_type    VARCHAR(100),
  file_size    INTEGER CHECK (file_size >= 0),
  version      INTEGER NOT NULL DEFAULT 1,
  is_current   BOOLEAN NOT NULL DEFAULT TRUE,
  parse_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (parse_status IN ('pending','parsed','failed')),
  parsed_data  JSONB,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ,
  UNIQUE (candidate_id, version)
);
CREATE UNIQUE INDEX uq_resume_current ON candidate_resumes (candidate_id) WHERE is_current AND deleted_at IS NULL;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON candidate_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_prefs_updated    BEFORE UPDATE ON candidate_preferences FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_certs_updated    BEFORE UPDATE ON candidate_certifications FOR EACH ROW EXECUTE FUNCTION set_updated_at();
