-- Add user_id column to user_invites to track which user accepted the invite
ALTER TABLE user_invites
ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_user_invites_user_id ON user_invites(user_id);
CREATE INDEX idx_user_invites_user_project ON user_invites(user_id, project_id);
