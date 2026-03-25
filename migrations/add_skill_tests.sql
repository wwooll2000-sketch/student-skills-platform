-- Migration: Add skill test tables and columns

-- Add max_test_attempts column to skill_templates
ALTER TABLE skill_templates ADD COLUMN IF NOT EXISTS max_test_attempts INT DEFAULT 3;

-- Table for test questions per skill template (max 5 per template)
CREATE TABLE IF NOT EXISTS skill_test_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES skill_templates(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    correct_answer BOOLEAN NOT NULL,
    order_num INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_skill_test_questions_template_id ON skill_test_questions(template_id);

-- Table for student test attempts (tracks score, pass/fail, and attempt number)
CREATE TABLE IF NOT EXISTS skill_test_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
    score INT NOT NULL DEFAULT 0,
    passed BOOLEAN NOT NULL DEFAULT FALSE,
    attempt_number INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_skill_test_attempts_skill_id ON skill_test_attempts(skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_test_attempts_student_id ON skill_test_attempts(student_id);
