-- Admin module: account status, KYC, job moderation, platform settings, plans, flags, disputes, payroll runs,
-- data-deletion requests and LLM usage.

ALTER TABLE users ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleted'));
ALTER TABLE users ADD COLUMN last_login_at TIMESTAMPTZ;
CREATE INDEX idx_users_role_status ON users (role, status);

ALTER TABLE companies ADD COLUMN kyc_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending','verified','rejected'));
ALTER TABLE companies ADD COLUMN kyc_notes VARCHAR(500);
ALTER TABLE companies ADD COLUMN kyc_reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE companies ADD COLUMN kyc_reviewed_at TIMESTAMPTZ;

ALTER TABLE jobs ADD COLUMN moderation_status VARCHAR(20) NOT NULL DEFAULT 'approved' CHECK (moderation_status IN ('approved','flagged','removed'));
ALTER TABLE jobs ADD COLUMN moderation_note VARCHAR(500);
ALTER TABLE jobs ADD COLUMN moderated_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN moderated_at TIMESTAMPTZ;

ALTER TABLE payments DROP CONSTRAINT payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check CHECK (status IN ('processing','paid','failed','refunded'));

-- One row per settings group (platform, interview, scoring, llm). Values are validated by the API.
CREATE TABLE platform_settings (
  key         VARCHAR(60) PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE subscription_plans (
  code          VARCHAR(20) PRIMARY KEY CHECK (code IN ('starter','pro','enterprise')),
  name          VARCHAR(60) NOT NULL,
  price_monthly NUMERIC(10,2) CHECK (price_monthly >= 0),   -- NULL means "custom pricing"
  max_roles     INTEGER CHECK (max_roles >= 0),              -- NULL means unlimited
  features      TEXT[] NOT NULL DEFAULT '{}',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE interview_flags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  reason      VARCHAR(30) NOT NULL CHECK (reason IN ('ai_assisted','technical_failure','other')),
  severity    VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high')),
  details     VARCHAR(500),
  status      VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  resolution  VARCHAR(500),
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,   -- NULL = raised automatically
  resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_flags_status ON interview_flags (status, created_at DESC);

CREATE TABLE billing_disputes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id  UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  raised_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reason      VARCHAR(500) NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','refunded','rejected')),
  resolution  VARCHAR(500),
  resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX uq_dispute_open ON billing_disputes (payment_id) WHERE status = 'open';

CREATE TABLE payroll_runs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  payments_count INTEGER NOT NULL CHECK (payments_count >= 0),
  total_gross    NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_net      NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE data_deletion_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at       TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  processed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ,
  notes        VARCHAR(500)
);
CREATE UNIQUE INDEX uq_deletion_pending ON data_deletion_requests (user_id) WHERE status = 'pending';

CREATE TABLE llm_usage_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model         VARCHAR(80) NOT NULL,
  purpose       VARCHAR(40) NOT NULL,
  input_tokens  INTEGER NOT NULL CHECK (input_tokens >= 0),
  output_tokens INTEGER NOT NULL CHECK (output_tokens >= 0),
  session_id    UUID REFERENCES interview_sessions(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_llm_usage_created ON llm_usage_log (created_at);

CREATE TRIGGER trg_plans_updated BEFORE UPDATE ON subscription_plans FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON platform_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
