-- ============================================
-- Student Skills Platform - PostgreSQL Setup
-- ============================================
-- This SQL script creates the complete database schema
-- Run this script directly in PostgreSQL psql console
-- ============================================

-- Create Database
CREATE DATABASE student_skills_db;

-- ============================================
-- Connect to the student_skills_db database
-- ============================================
-- Use: \c student_skills_db

-- ============================================
-- Create Students Table
-- ============================================
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    class VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_students_code ON students(code);
CREATE INDEX idx_students_email ON students(email);

-- ============================================
-- Create Skills Table
-- ============================================
CREATE TABLE IF NOT EXISTS skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    level INTEGER DEFAULT 1,
    description TEXT,
    category VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_skills_student_id ON skills(student_id);
CREATE INDEX idx_skills_level ON skills(level);
CREATE INDEX idx_skills_category ON skills(category);

-- ============================================
-- Create Student Evaluations Table
-- ============================================
CREATE TABLE IF NOT EXISTS student_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    evaluation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    overall_score INTEGER,
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_evaluations_student_id ON student_evaluations(student_id);
CREATE INDEX idx_evaluations_date ON student_evaluations(evaluation_date);

-- ============================================
-- Create Admin Logs Table
-- ============================================
CREATE TABLE IF NOT EXISTS admin_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id VARCHAR(255),
    action VARCHAR(100),
    table_name VARCHAR(100),
    record_id VARCHAR(255),
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX idx_admin_logs_action ON admin_logs(action);
CREATE INDEX idx_admin_logs_created_at ON admin_logs(created_at);

-- ============================================
-- Create Sessions Table
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id VARCHAR(255) NOT NULL,
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_admin_id ON sessions(admin_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- ============================================
-- Data Types Reference
-- ============================================
-- UUID: Universally Unique Identifier (for primary keys)
-- VARCHAR(n): Variable-length character string (up to n characters)
-- TEXT: Unlimited-length text
-- INTEGER: Whole numbers
-- TIMESTAMP: Date and time with milliseconds
-- BOOLEAN: True/False values

-- ============================================
-- All tables created successfully!
-- ============================================

