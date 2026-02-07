import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

// Parse DATABASE_URL to extract connection details
const connectionString = process.env.DATABASE_URL;
let clientConfig;

if (connectionString) {
  clientConfig = { connectionString };
} else {
  clientConfig = {
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
  };
}

// Client to connect to default 'postgres' database first
const adminPool = new Pool(clientConfig);

const setupDatabase = async () => {
  try {
    console.log('🔄 جاري إعداد قاعدة البيانات...\n');

    // Extract database name from connection string or use default
    let databaseName = 'student_skills_db';
    if (connectionString && connectionString.includes('/')) {
      const dbMatch = connectionString.match(/\/([^?]+)/);
      if (dbMatch) {
        databaseName = dbMatch[1];
      }
    }

    console.log(`📊 اسم قاعدة البيانات: ${databaseName}\n`);

    // Create database
    console.log('📝 جاري إنشاء قاعدة البيانات...');
    try {
      await adminPool.query(`CREATE DATABASE "${databaseName}"`);
      console.log(`✅ تم إنشاء قاعدة البيانات: ${databaseName}\n`);
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log(`⚠️  قاعدة البيانات موجودة بالفعل: ${databaseName}\n`);
      } else {
        throw err;
      }
    }

    await adminPool.end();

    // Now connect to the newly created/existing database
    const dbConfig = clientConfig.connectionString
      ? { connectionString: clientConfig.connectionString }
      : {
          ...clientConfig,
          database: databaseName,
        };

    const pool = new Pool(dbConfig);

    // Create tables
    console.log('📋 جاري إنشاء الجداول...\n');

    // Students table
    console.log('   └─ جاري إنشاء جدول الطلاب...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS students (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        class VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✅ تم إنشاء جدول الطلاب\n');

    // Skills table
    console.log('   └─ جاري إنشاء جدول المهارات...');
    await pool.query(`
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
      )
    `);
    console.log('   ✅ تم إنشاء جدول المهارات\n');

    // Student Evaluations table
    console.log('   └─ جاري إنشاء جدول التقييمات...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS student_evaluations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        evaluation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        overall_score INTEGER,
        comments TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✅ تم إنشاء جدول التقييمات\n');

    // Admin Logs table
    console.log('   └─ جاري إنشاء جدول سجلات المعلم...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_id VARCHAR(255),
        action VARCHAR(100),
        table_name VARCHAR(100),
        record_id VARCHAR(255),
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✅ تم إنشاء جدول سجلات المعلم\n');

    // Sessions table
    console.log('   └─ جاري إنشاء جدول الجلسات...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_id VARCHAR(255) NOT NULL,
        token VARCHAR(500) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✅ تم إنشاء جدول الجلسات\n');

    // Create indexes
    console.log('🔑 جاري إنشاء الفهارس...\n');

    const indexes = [
      { table: 'students', column: 'code', name: 'idx_students_code' },
      { table: 'students', column: 'email', name: 'idx_students_email' },
      { table: 'skills', column: 'student_id', name: 'idx_skills_student_id' },
      { table: 'skills', column: 'level', name: 'idx_skills_level' },
      { table: 'skills', column: 'category', name: 'idx_skills_category' },
      { table: 'student_evaluations', column: 'student_id', name: 'idx_evaluations_student_id' },
      { table: 'student_evaluations', column: 'evaluation_date', name: 'idx_evaluations_date' },
      { table: 'admin_logs', column: 'admin_id', name: 'idx_admin_logs_admin_id' },
      { table: 'admin_logs', column: 'action', name: 'idx_admin_logs_action' },
      { table: 'admin_logs', column: 'created_at', name: 'idx_admin_logs_created_at' },
      { table: 'sessions', column: 'token', name: 'idx_sessions_token' },
      { table: 'sessions', column: 'admin_id', name: 'idx_sessions_admin_id' },
      { table: 'sessions', column: 'expires_at', name: 'idx_sessions_expires_at' },
    ];

    for (const index of indexes) {
      try {
        await pool.query(`
          CREATE INDEX IF NOT EXISTS ${index.name} ON ${index.table}(${index.column})
        `);
        console.log(`   ✅ تم إنشاء الفهرس: ${index.name}`);
      } catch (err) {
        if (!err.message.includes('already exists')) {
          console.log(`   ⚠️  الفهرس موجود: ${index.name}`);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ تم إعداد قاعدة البيانات بنجاح!');
    console.log('='.repeat(60));
    console.log('\n📊 تفاصيل قاعدة البيانات:');
    console.log(`   • قاعدة البيانات: ${databaseName}`);
    console.log(`   • الجداول المُنشأة: 5 جداول`);
    console.log(`     - students (الطلاب)`);
    console.log(`     - skills (المهارات)`);
    console.log(`     - student_evaluations (التقييمات)`);
    console.log(`     - admin_logs (السجلات)`);
    console.log(`     - sessions (الجلسات)`);
    console.log(`   • الفهارس المُنشأة: ${indexes.length} فهرس`);
    console.log('\n✨ البيانات جاهزة للاستخدام!\n');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ خطأ أثناء إعداد قاعدة البيانات:');
    console.error(error.message);
    process.exit(1);
  }
};

setupDatabase();
