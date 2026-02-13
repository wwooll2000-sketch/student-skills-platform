-- Migration: Add student_login_logs table to track when students log in and log out

CREATE TABLE IF NOT EXISTS student_login_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    action_type VARCHAR(20) DEFAULT 'login',
    logged_in_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_student_login_logs_student_id ON student_login_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_student_login_logs_logged_in_at ON student_login_logs(logged_in_at DESC);
