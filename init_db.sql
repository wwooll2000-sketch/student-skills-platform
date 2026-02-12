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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

-- Categories for organizing skills
CREATE TABLE IF NOT EXISTS skill_categories (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    icon VARCHAR(10) DEFAULT '📁',
    color VARCHAR(20) DEFAULT 'slate',
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Teacher credentials table
CREATE TABLE IF NOT EXISTS teacher (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL DEFAULT 'المعلم',
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_students_code ON students(code);
CREATE INDEX IF NOT EXISTS idx_skills_student_id ON skills(student_id);
CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);
CREATE INDEX IF NOT EXISTS idx_skill_templates_category ON skill_templates(category);
CREATE INDEX IF NOT EXISTS idx_skill_templates_active ON skill_templates(is_active);

-- Insert default categories
INSERT INTO skill_categories (id, name, icon, color, display_order) VALUES
    (gen_random_uuid(), 'لغة عربية', '📖', 'blue', 1),
    (gen_random_uuid(), 'رياضيات', '🔢', 'green', 2),
    (gen_random_uuid(), 'علوم', '🔬', 'purple', 3),
    (gen_random_uuid(), 'برمجة', '💻', 'indigo', 4),
    (gen_random_uuid(), 'مهارات عامة', '⭐', 'yellow', 5),
    (gen_random_uuid(), 'أخرى', '📁', 'slate', 99)
ON CONFLICT (name) DO NOTHING;

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
