-- ============================================
-- Migration 029: Add requested phone number to product inquiries
-- Captures the phone number entered at request time.
-- ============================================

ALTER TABLE product_inquiries
  ADD COLUMN IF NOT EXISTS requested_phone_number TEXT;

UPDATE product_inquiries pi
SET requested_phone_number = COALESCE(
  NULLIF(TRIM(u.phone_number), ''),
  NULLIF(TRIM(d.contact_number), '')
)
FROM users u
LEFT JOIN dealers d ON d.user_id = u.id
WHERE pi.user_id = u.id
  AND (pi.requested_phone_number IS NULL OR TRIM(pi.requested_phone_number) = '');
