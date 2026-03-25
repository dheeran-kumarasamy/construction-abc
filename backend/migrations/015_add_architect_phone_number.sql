-- Add phone number field for SMS notifications to architect users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_users_phone_number
ON users(phone_number)
WHERE phone_number IS NOT NULL;
