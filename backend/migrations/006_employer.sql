-- Employer module: companies, team, hiring workflow (notes, invitations, offers), talent pool, audit trail.

CREATE TABLE companies (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(160) NOT NULL,
  website        VARCHAR(255),
  industry       VARCHAR(100),
  headquarters   VARCHAR(120),
  size           VARCHAR(40),
  description    TEXT,
  logo_path      VARCHAR(500),
  plan           VARCHAR(20) NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter','pro','enterprise')),
  trial_ends_at  TIMESTAMPTZ,
  billing_email  VARCHAR(150),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ
);

-- One company per user. Role controls what the user may do inside it.
CREATE TABLE company_members (
  company_id UUID    NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  role       VARCHAR(20) NOT NULL CHECK (role IN ('owner','admin','recruiter','viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (company_id, user_id)
);

CREATE TABLE company_invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email       VARCHAR(150) NOT NULL,
  role        VARCHAR(20) NOT NULL CHECK (role IN ('admin','recruiter','viewer')),
  token_hash  CHAR(64) NOT NULL UNIQUE,   -- SHA-256 of the emailed token; the token itself is never stored
  status      VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked','expired')),
  invited_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX uq_invitation_pending ON company_invitations (company_id, LOWER(email)) WHERE status = 'pending';

ALTER TABLE jobs ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
CREATE INDEX idx_jobs_company ON jobs (company_id, status) WHERE deleted_at IS NULL;

ALTER TABLE applications ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'direct'
  CHECK (source IN ('direct','referral','job_board','ai_search','employer'));
ALTER TABLE applications DROP CONSTRAINT applications_status_check;
ALTER TABLE applications ADD CONSTRAINT applications_status_check CHECK (status IN
  ('applied','in_review','shortlisted','interview_scheduled','interviewed','offer_received','accepted','rejected','withdrawn'));

CREATE TABLE application_notes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  author_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  note           TEXT NOT NULL,
  rating         SMALLINT CHECK (rating BETWEEN 1 AND 5),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_app_notes_application ON application_notes (application_id, created_at);

CREATE TABLE interview_invitations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  candidate_id   UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  job_id         UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  invited_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','expired')),
  message        VARCHAR(500),
  scheduled_at   TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  responded_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX uq_invitation_open ON interview_invitations (application_id) WHERE status = 'pending';
CREATE INDEX idx_invitations_candidate ON interview_invitations (candidate_id, status);

CREATE TABLE offers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  sent_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  hourly_rate    NUMERIC(8,2) NOT NULL CHECK (hourly_rate >= 0),
  commitment     VARCHAR(40),
  start_date     DATE NOT NULL,
  expires_at     TIMESTAMPTZ NOT NULL,
  message        VARCHAR(1000),
  status         VARCHAR(20) NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','accepted','declined','expired','withdrawn')),
  responded_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX uq_offer_open ON offers (application_id) WHERE status = 'sent';

CREATE TABLE saved_candidates (
  company_id   UUID    NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  candidate_id UUID    NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  saved_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  note         VARCHAR(300),
  saved_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (company_id, candidate_id)
);

CREATE TABLE job_views (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES candidate_profiles(id) ON DELETE SET NULL,
  viewed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_job_views_job ON job_views (job_id, viewed_at);

CREATE TABLE audit_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID REFERENCES companies(id) ON DELETE CASCADE,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  entity_type   VARCHAR(40) NOT NULL,
  entity_id     UUID,
  action        VARCHAR(60) NOT NULL,
  meta          JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_company ON audit_events (company_id, created_at DESC);

CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_offers_updated    BEFORE UPDATE ON offers    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
