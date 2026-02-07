import pool from './db.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * ملف البيانات الأولية (Seed Data)
 * استخدم هذا الملف لتعبئة قاعدة البيانات ببيانات تجريبية
 */

export async function seedDatabase() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // إنشاء طلاب تجريبيين
    const students = [
      { id: uuidv4(), name: 'أحمد محمد', code: '1001', email: 'ahmed@school.edu', class: '10A' },
      { id: uuidv4(), name: 'فاطمة علي', code: '1002', email: 'fatima@school.edu', class: '10B' },
      { id: uuidv4(), name: 'محمود حسن', code: '1003', email: 'mahmoud@school.edu', class: '10A' },
      { id: uuidv4(), name: 'نور الهدى', code: '1004', email: 'noor@school.edu', class: '10C' },
      { id: uuidv4(), name: 'عمر خالد', code: '1005', email: 'omar@school.edu', class: '10B' }
    ];

    for (const student of students) {
      await client.query(
        `INSERT INTO students (id, name, code, email, class, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [student.id, student.name, student.code, student.email, student.class]
      );

      // إضافة مهارات لكل طالب
      const skills = [
        {
          name: 'القراءة الفصحى',
          level: Math.floor(Math.random() * 3) + 1,
          category: 'القراءة',
          description: 'المهارة في قراءة النصوص الفصحى بشكل صحيح'
        },
        {
          name: 'الكتابة والإملاء',
          level: Math.floor(Math.random() * 3) + 1,
          category: 'الكتابة',
          description: 'القدرة على الكتابة الصحيحة والإملاء السليم'
        },
        {
          name: 'النحو والصرف',
          level: Math.floor(Math.random() * 3) + 1,
          category: 'القواعد',
          description: 'فهم واستيعاب قواعد النحو والصرف'
        },
        {
          name: 'التعبير الشفهي',
          level: Math.floor(Math.random() * 3) + 1,
          category: 'التحدث',
          description: 'الحوار والتعبير عن الآراء بوضوح'
        },
        {
          name: 'الاستيعاب والفهم',
          level: Math.floor(Math.random() * 3) + 1,
          category: 'الفهم',
          description: 'فهم واستيعاب المعاني من النصوص'
        }
      ];

      for (const skill of skills) {
        await client.query(
          `INSERT INTO skills (id, student_id, name, level, description, category, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [uuidv4(), student.id, skill.name, skill.level, skill.description, skill.category]
        );
      }

      // إضافة تقييم واحد لكل طالب
      const overallScore = Math.floor(Math.random() * 40) + 60; // 60-100
      await client.query(
        `INSERT INTO student_evaluations (id, student_id, overall_score, comments, evaluation_date, created_at, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          uuidv4(),
          student.id,
          overallScore,
          'تقييم جيد جداً - قدرات عالية في اللغة العربية'
        ]
      );
    }

    await client.query('COMMIT');
    console.log('✅ تم إضافة البيانات التجريبية بنجاح');
    console.log(`   - ${students.length} طالب/طالبة`);
    console.log(`   - ${students.length * 5} مهارة`);
    console.log(`   - ${students.length} تقييم`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ خطأ في إضافة البيانات:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * مسح جميع البيانات (استخدم بحذر!)
 */
export async function clearDatabase() {
  try {
    const tables = ['admin_logs', 'student_evaluations', 'skills', 'students'];
    
    for (const table of tables) {
      await pool.query(`DELETE FROM ${table}`);
    }

    console.log('⚠️  تم مسح جميع البيانات من قاعدة البيانات');
  } catch (error) {
    console.error('❌ خطأ في مسح البيانات:', error);
    throw error;
  }
}

/**
 * الحصول على إحصائيات قاعدة البيانات
 */
export async function getDatabaseStats() {
  try {
    const studentsCount = await pool.query('SELECT COUNT(*) as count FROM students');
    const skillsCount = await pool.query('SELECT COUNT(*) as count FROM skills');
    const evaluationsCount = await pool.query('SELECT COUNT(*) as count FROM student_evaluations');
    const logsCount = await pool.query('SELECT COUNT(*) as count FROM admin_logs');

    return {
      students: parseInt(studentsCount.rows[0].count),
      skills: parseInt(skillsCount.rows[0].count),
      evaluations: parseInt(evaluationsCount.rows[0].count),
      logs: parseInt(logsCount.rows[0].count),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ خطأ في الحصول على الإحصائيات:', error);
    throw error;
  }
}

// تشغيل البذرة إذا تم استدعاء الملف مباشرة
if (process.env.SEED_DB === 'true') {
  console.log('🌱 بدء إضافة البيانات التجريبية...');
  seedDatabase().then(() => {
    console.log('✅ تم الانتهاء بنجاح');
    process.exit(0);
  }).catch(err => {
    console.error('❌ فشل:', err);
    process.exit(1);
  });
}
