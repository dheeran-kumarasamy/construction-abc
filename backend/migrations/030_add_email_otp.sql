-- Migration 030: Email OTP for registration verification
-- Stores one-time 6-digit codes sent to a user's email before account creation.

CREATE TABLE IF NOT EXISTS email_otps (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       TEXT        NOT NULL,
  otp_code    TEXT        NOT NULL,
  purpose     TEXT        NOT NULL DEFAULT 'registration',
  expires_at  TIMESTAMP   NOT NULL,
  used_at     TIMESTAMP,
  attempts    INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_otps_lookup
  ON email_otps (email, purpose, used_at, expires_at);
