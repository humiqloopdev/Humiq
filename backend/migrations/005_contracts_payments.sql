-- Contracts (created when an offer is accepted), payments, payout methods, notifications.

CREATE TABLE contracts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL UNIQUE REFERENCES applications(id) ON DELETE RESTRICT,
  candidate_id   UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE RESTRICT,
  job_id         UUID NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  employer_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  hourly_rate    NUMERIC(8,2) NOT NULL CHECK (hourly_rate >= 0),
  start_date     DATE NOT NULL,
  end_date       DATE,
  status         VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','completed','terminated')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX idx_contracts_candidate ON contracts (candidate_id, status);

CREATE TABLE payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id    UUID NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
  candidate_id   UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE RESTRICT,
  invoice_number VARCHAR(40) NOT NULL UNIQUE,
  period_start   DATE NOT NULL,
  period_end     DATE NOT NULL,
  hours          NUMERIC(7,2) NOT NULL CHECK (hours >= 0),
  gross_amount   NUMERIC(12,2) NOT NULL CHECK (gross_amount >= 0),
  fee_amount     NUMERIC(12,2) NOT NULL CHECK (fee_amount >= 0),
  net_amount     NUMERIC(12,2) NOT NULL CHECK (net_amount >= 0),
  status         VARCHAR(20) NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','paid','failed')),
  paid_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (period_end >= period_start),
  CHECK (net_amount = gross_amount - fee_amount)
);
CREATE INDEX idx_payments_candidate ON payments (candidate_id, period_end DESC);

-- Never store full account numbers: keep a provider token and the last 4 digits only.
CREATE TABLE payout_methods (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id   UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  method_type    VARCHAR(20) NOT NULL CHECK (method_type IN ('bank','paypal','upi','other')),
  label          VARCHAR(100) NOT NULL,
  account_last4  CHAR(4),
  provider_token VARCHAR(200),
  is_default     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_payout_default ON payout_methods (candidate_id) WHERE is_default AND deleted_at IS NULL;

CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(40) NOT NULL,
  title      VARCHAR(160) NOT NULL,
  body       VARCHAR(400),
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notifications_user ON notifications (user_id, is_read, created_at DESC);

CREATE TRIGGER trg_contracts_updated BEFORE UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_payments_updated  BEFORE UPDATE ON payments  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_payout_updated    BEFORE UPDATE ON payout_methods FOR EACH ROW EXECUTE FUNCTION set_updated_at();
