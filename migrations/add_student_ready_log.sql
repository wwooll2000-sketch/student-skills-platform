-- Migration: Add student_ready_log table to track when students mark skills as ready/not ready
-- Only populated by the student endpoint, never by admin actions.

CREATE TABLE IF NOT EXISTS student_ready_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    skill_name TEXT NOT NULL,
    is_ready BOOLEAN NOT NULL,
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_student_ready_log_logged_at ON student_ready_log(logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_ready_log_student_id ON student_ready_log(student_id);
