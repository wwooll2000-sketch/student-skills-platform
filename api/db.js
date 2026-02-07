import pkg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pkg;
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('خطأ غير متوقع في مجموعة الاتصالات', err);
  process.exit(-1);
});

// اختبار الاتصال
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('خطأ في الاتصال بقاعدة البيانات:', err);
  } else {
    console.log('✅ تم الاتصال بقاعدة البيانات بنجاح');
  }
});

// إنشء الجداول إذا لم تكن موجودة
export async function initializeDatabase() {
  try {
    const createStudentsTableQuery = `
      CREATE TABLE IF NOT EXISTS students (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        class VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS skills (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        level INTEGER DEFAULT 1,
        description TEXT,
        category VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_student_id (student_id)
      );

      CREATE TABLE IF NOT EXISTS student_evaluations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        evaluation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        overall_score INTEGER,
        comments TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_student_id (student_id)
      );

      CREATE TABLE IF NOT EXISTS admin_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_id VARCHAR(255),
        action VARCHAR(100),
        table_name VARCHAR(100),
        record_id VARCHAR(255),
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_students_code ON students(code);
      CREATE INDEX IF NOT EXISTS idx_skills_student ON skills(student_id);
      CREATE INDEX IF NOT EXISTS idx_evaluations_student ON student_evaluations(student_id);
    `;

    // تنفيذ البيانات الجديدة
    const statements = createStudentsTableQuery.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        await pool.query(statement);
      }
    }

    console.log('✅ تم إنشاء/التحقق من جميع الجداول');
  } catch (error) {
    console.error('❌ خطأ في إنشاء الجداول:', error);
  }
}

export default pool;
