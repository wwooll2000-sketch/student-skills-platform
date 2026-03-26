-- Migration: Add is_hidden_from_students column to skill_templates
ALTER TABLE skill_templates ADD COLUMN IF NOT EXISTS is_hidden_from_students BOOLEAN DEFAULT FALSE;
