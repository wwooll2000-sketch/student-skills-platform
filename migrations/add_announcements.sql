-- Migration: Add announcements feature
-- Creates the announcements table and the junction table for per-student targeting

CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL DEFAULT 'basic' CHECK (type IN ('basic', 'warning', 'danger')),
    target_all BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS announcement_students (
    announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    PRIMARY KEY (announcement_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_students_student ON announcement_students(student_id);
CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(created_at DESC);
