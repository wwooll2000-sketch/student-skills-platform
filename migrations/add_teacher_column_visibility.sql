-- Add column_visibility JSONB field to teacher table
-- This stores which columns should be visible in the student view
ALTER TABLE teacher ADD COLUMN IF NOT EXISTS column_visibility JSONB DEFAULT '{}';
