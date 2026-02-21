-- Clean database Script - Keep users and organizations only
-- Delete all project-related data and invites

DELETE FROM user_invites;
DELETE FROM estimate_revisions;
DELETE FROM estimates;
DELETE FROM boq_revisions;
DELETE FROM boqs;
DELETE FROM project_revisions;
DELETE FROM projects;
DELETE FROM base_pricing;
DELETE FROM audit_logs;

-- Verify data is cleared
SELECT 'Users kept:' as status, COUNT(*) FROM users
UNION ALL
SELECT 'Organizations kept:' as status, COUNT(*) FROM organizations
UNION ALL
SELECT 'Projects deleted:' as status, COUNT(*) FROM projects
UNION ALL
SELECT 'Invites deleted:' as status, COUNT(*) FROM user_invites
UNION ALL
SELECT 'BOQs deleted:' as status, COUNT(*) FROM boqs
UNION ALL
SELECT 'Estimates deleted:' as status, COUNT(*) FROM estimates;
