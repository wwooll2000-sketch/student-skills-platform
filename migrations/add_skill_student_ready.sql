-- Migration: Add is_student_ready column to skills table
-- This lets students mark themselves as ready for a skill (self-assessment)

ALTER TABLE skills ADD COLUMN IF NOT EXISTS is_student_ready BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_skills_is_student_ready ON skills(is_student_ready);
