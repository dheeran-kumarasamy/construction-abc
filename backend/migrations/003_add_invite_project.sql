-- Add project_id to user_invites so invites can be scoped to a project
ALTER TABLE user_invites
ADD COLUMN project_id UUID REFERENCES projects(id);

CREATE INDEX idx_user_invites_project_id ON user_invites(project_id);