-- Populate user_id for existing accepted invites by joining with users table
UPDATE user_invites ui
SET user_id = u.id
FROM users u
WHERE ui.email = u.email
  AND ui.organization_id = u.organization_id
  AND ui.accepted_at IS NOT NULL
  AND ui.user_id IS NULL;
