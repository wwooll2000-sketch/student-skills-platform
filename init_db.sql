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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_students_code ON students(code);
CREATE INDEX IF NOT EXISTS idx_skills_student_id ON skills(student_id);
CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);
