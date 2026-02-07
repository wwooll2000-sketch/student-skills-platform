#!/usr/bin/env node

/**
 * أداة لاستيراد وتصدير البيانات
 * استخدام:
 *   node api/migrate.js export > backup.json
 *   node api/migrate.js import backup.json
 */

import pool from './db.js';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const command = process.argv[2];
const file = process.argv[3];

async function exportData() {
  const client = await pool.connect();
  
  try {
    console.log('📤 بدء تصدير البيانات...');

    // جلب جميع البيانات
    const students = await client.query('SELECT * FROM students ORDER BY created_at DESC');
    const skills = await client.query('SELECT * FROM skills ORDER BY created_at DESC');
    const evaluations = await client.query('SELECT * FROM student_evaluations ORDER BY created_at DESC');

    const data = {
      version: '2.0',
      exportDate: new Date().toISOString(),
      database: {
        students: students.rows,
        skills: skills.rows,
        evaluations: evaluations.rows
      },
      statistics: {
        totalStudents: students.rowCount,
        totalSkills: skills.rowCount,
        totalEvaluations: evaluations.rowCount
      }
    };

    console.log(JSON.stringify(data, null, 2));
    console.error('✅ تم تصدير البيانات بنجاح');

  } catch (error) {
    console.error('❌ خطأ في التصدير:', error.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

async function importData(filePath) {
  const client = await pool.connect();

  try {
    console.error('📥 بدء استيراد البيانات...');

    // قراءة الملف
    if (!fs.existsSync(filePath)) {
      throw new Error(`الملف غير موجود: ${filePath}`);
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent);

    if (!data.database) {
      throw new Error('صيغة الملف غير صحيحة');
    }

    await client.query('BEGIN');

    // حذف البيانات القديمة
    console.error('🗑️  مسح البيانات القديمة...');
    await client.query('TRUNCATE TABLE admin_logs CASCADE');
    await client.query('TRUNCATE TABLE student_evaluations CASCADE');
    await client.query('TRUNCATE TABLE skills CASCADE');
    await client.query('TRUNCATE TABLE students CASCADE');

    // استيراد الطلاب
    console.error('👥 استيراد الطلاب...');
    for (const student of data.database.students) {
      await client.query(
        `INSERT INTO students (id, name, code, email, class, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          student.id || uuidv4(),
          student.name,
          student.code,
          student.email || null,
          student.class || null,
          student.created_at || new Date(),
          student.updated_at || new Date()
        ]
      );
    }

    // استيراد المهارات
    console.error('📚 استيراد المهارات...');
    for (const skill of data.database.skills) {
      await client.query(
        `INSERT INTO skills (id, student_id, name, level, description, category, notes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          skill.id || uuidv4(),
          skill.student_id,
          skill.name,
          skill.level || 1,
          skill.description || null,
          skill.category || null,
          skill.notes || null,
          skill.created_at || new Date(),
          skill.updated_at || new Date()
        ]
      );
    }

    // استيراد التقييمات
    console.error('⭐ استيراد التقييمات...');
    for (const evaluation of data.database.evaluations) {
      await client.query(
        `INSERT INTO student_evaluations (id, student_id, evaluation_date, overall_score, comments, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          evaluation.id || uuidv4(),
          evaluation.student_id,
          evaluation.evaluation_date || new Date(),
          evaluation.overall_score || null,
          evaluation.comments || null,
          evaluation.created_at || new Date(),
          evaluation.updated_at || new Date()
        ]
      );
    }

    await client.query('COMMIT');

    console.error('✅ تم استيراد البيانات بنجاح');
    console.error(`   - ${data.database.students.length} طالب/طالبة`);
    console.error(`   - ${data.database.skills.length} مهارة`);
    console.error(`   - ${data.database.evaluations.length} تقييم`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ خطأ في الاستيراد:', error.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

async function main() {
  if (command === 'export') {
    await exportData();
  } else if (command === 'import' && file) {
    await importData(file);
  } else {
    console.error('الاستخدام:');
    console.error('  تصدير البيانات:');
    console.error('    node api/migrate.js export > backup.json');
    console.error('');
    console.error('  استيراد البيانات:');
    console.error('    node api/migrate.js import backup.json');
    process.exit(1);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('❌ خطأ:', err.message);
  process.exit(1);
});
