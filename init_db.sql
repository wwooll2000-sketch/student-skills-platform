-- Create tables for student skills platform

CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255),
    class VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS skills (
    id UUID PRIMARY KEY,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    level INTEGER DEFAULT 1,
    description TEXT,
    category VARCHAR(100),
    notes TEXT,
    evidence_url TEXT,
    is_student_ready BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add is_student_ready column to existing databases (safe: ignored if already exists)
ALTER TABLE skills ADD COLUMN IF NOT EXISTS is_student_ready BOOLEAN DEFAULT FALSE;

-- Add column_visibility to teacher table (safe: ignored if already exists)
ALTER TABLE teacher ADD COLUMN IF NOT EXISTS column_visibility JSONB DEFAULT '{}';

-- Log table for student-initiated ready/unready events
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

-- New table for skill templates (predefined skills that can be assigned)
CREATE TABLE IF NOT EXISTS skill_templates (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    url TEXT,
    category VARCHAR(100) DEFAULT 'general',
    icon VARCHAR(10) DEFAULT '📚',
    color VARCHAR(20) DEFAULT 'indigo',
    is_active BOOLEAN DEFAULT TRUE,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Teacher credentials table
CREATE TABLE IF NOT EXISTS teacher (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL DEFAULT 'المعلم',
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for storing multiple evidence/photos per skill
CREATE TABLE IF NOT EXISTS skill_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
    evidence_url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for logging student logins for activity tracking
CREATE TABLE IF NOT EXISTS student_login_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    action_type VARCHAR(20) DEFAULT 'login',
    logged_in_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_students_code ON students(code);
CREATE INDEX IF NOT EXISTS idx_skills_student_id ON skills(student_id);
CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);
CREATE INDEX IF NOT EXISTS idx_skills_is_student_ready ON skills(is_student_ready);
CREATE INDEX IF NOT EXISTS idx_student_login_logs_student_id ON student_login_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_student_login_logs_logged_in_at ON student_login_logs(logged_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_skill_templates_category ON skill_templates(category);
CREATE INDEX IF NOT EXISTS idx_skill_templates_active ON skill_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_skill_evidence_skill_id ON skill_evidence(skill_id);

-- Insert default teacher (password: admin123)
INSERT INTO teacher (name, password)
SELECT 'المعلم', 'admin123'
WHERE NOT EXISTS (SELECT 1 FROM teacher);

-- Migrate existing custom skills to skill_templates
INSERT INTO skill_templates (id, name, description, url, category, icon, is_active, created_at)
SELECT DISTINCT ON (name)
    gen_random_uuid(),
    name,
    description,
    description as url,
    CASE 
        WHEN category = 'custom' THEN 'أخرى'
        ELSE COALESCE(category, 'مهارات عامة')
    END,
    '📚',
    true,
    created_at
FROM skills
WHERE student_id IS NULL AND category = 'custom'
ON CONFLICT (name) DO NOTHING;

-- Update usage count for existing templates
UPDATE skill_templates st
SET usage_count = (
    SELECT COUNT(DISTINCT student_id)
    FROM skills s
    WHERE s.name = st.name AND s.student_id IS NOT NULL
);

-- Migrate existing evidence_url data to skill_evidence table (only image URLs, not YouTube)
INSERT INTO skill_evidence (skill_id, evidence_url, created_at)
SELECT id, evidence_url, created_at
FROM skills
WHERE evidence_url IS NOT NULL 
AND evidence_url != ''
AND evidence_url NOT LIKE '%youtube%' 
AND evidence_url NOT LIKE '%youtu.be%'
AND evidence_url NOT LIKE '%drive.google.com%'
ON CONFLICT DO NOTHING;
