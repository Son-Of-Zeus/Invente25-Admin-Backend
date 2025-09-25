-- Migration 005: Add non-technical team members table
-- This table stores all team members (including leader) for non-technical events
-- to support team-based registration while keeping payment/receipt services unchanged

CREATE TABLE nt_team_members (
  team_leader_email TEXT NOT NULL,
  event_id INT NOT NULL REFERENCES events(external_id),
  member_email TEXT NOT NULL,
  member_name TEXT NOT NULL,
  member_phone TEXT,
  member_institution TEXT,
  is_leader BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (team_leader_email, event_id, member_email)
);

-- Add indexes for efficient queries
CREATE INDEX idx_nt_team_members_leader_event ON nt_team_members(team_leader_email, event_id);
CREATE INDEX idx_nt_team_members_event ON nt_team_members(event_id);
CREATE INDEX idx_nt_team_members_leader ON nt_team_members(team_leader_email);
