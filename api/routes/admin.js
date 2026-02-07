import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db.js';
import { verifyAdminToken, generateToken } from '../auth.js';

const router = express.Router();

// تسجيل دخول الأدمن
router.post('/login', async (req, res) => {
  try {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (password !== adminPassword) {
      return res.status(401).json({ success: false, message: 'كلمة المرور غير صحيحة' });
    }

    const token = generateToken({
      role: 'admin',
      adminId: 'admin-console',
      loginTime: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح',
      token,
      user: { role: 'admin', name: 'المعلم' }
    });
  } catch (error) {
    console.error('خطأ في تسجيل دخول الأدمن:', error);
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
});

// إضافة طالب جديد
router.post('/students', verifyAdminToken, async (req, res) => {
  try {
    const { name, code, email, class: studentClass } = req.body;

    if (!name || !code) {
      return res.status(400).json({ success: false, message: 'البيانات غير صحيحة' });
    }

    // التحقق من عدم تكرار الرقم
    const existingStudent = await pool.query(
      'SELECT id FROM students WHERE code = $1',
      [code]
    );

    if (existingStudent.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'رقم الطالب موجود بالفعل' });
    }

    const studentId = uuidv4();
    const result = await pool.query(
      `INSERT INTO students (id, name, code, email, class, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [studentId, name, code, email || null, studentClass || null]
    );

    // تسجيل العملية
    await pool.query(
      `INSERT INTO admin_logs (admin_id, action, table_name, record_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.admin.adminId, 'ADD_STUDENT', 'students', studentId, JSON.stringify(result.rows[0])]
    );

    res.status(201).json({
      success: true,
      message: 'تم إضافة الطالب بنجاح',
      student: result.rows[0]
    });
  } catch (error) {
    console.error('خطأ في إضافة الطالب:', error);
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
});

// الحصول على جميع الطلاب
router.get('/students', verifyAdminToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM students ORDER BY name ASC'
    );

    res.json({
      success: true,
      students: result.rows
    });
  } catch (error) {
    console.error('خطأ في جلب الطلاب:', error);
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
});

// تحديث بيانات الطالب
router.put('/students/:studentId', verifyAdminToken, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { name, email, class: studentClass } = req.body;

    const result = await pool.query(
      `UPDATE students 
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           class = COALESCE($3, class),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [name || null, email || null, studentClass || null, studentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'الطالب غير موجود' });
    }

    // تسجيل العملية
    await pool.query(
      `INSERT INTO admin_logs (admin_id, action, table_name, record_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.admin.adminId, 'UPDATE_STUDENT', 'students', studentId, JSON.stringify(result.rows[0])]
    );

    res.json({
      success: true,
      message: 'تم تحديث بيانات الطالب بنجاح',
      student: result.rows[0]
    });
  } catch (error) {
    console.error('خطأ في تحديث الطالب:', error);
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
});

// حذف طالب
router.delete('/students/:studentId', verifyAdminToken, async (req, res) => {
  try {
    const { studentId } = req.params;

    // حذف المهارات المرتبطة
    await pool.query('DELETE FROM skills WHERE student_id = $1', [studentId]);

    // حذف التقييمات المرتبطة
    await pool.query('DELETE FROM student_evaluations WHERE student_id = $1', [studentId]);

    // حذف الطالب
    const result = await pool.query(
      'DELETE FROM students WHERE id = $1 RETURNING *',
      [studentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'الطالب غير موجود' });
    }

    // تسجيل العملية
    await pool.query(
      `INSERT INTO admin_logs (admin_id, action, table_name, record_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.admin.adminId, 'DELETE_STUDENT', 'students', studentId, JSON.stringify(result.rows[0])]
    );

    res.json({ success: true, message: 'تم حذف الطالب بنجاح' });
  } catch (error) {
    console.error('خطأ في حذف الطالب:', error);
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
});

// إضافة مهارة للطالب
router.post('/students/:studentId/skills', verifyAdminToken, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { name, level, description, category, notes } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'البيانات غير صحيحة' });
    }

    const skillId = uuidv4();
    const result = await pool.query(
      `INSERT INTO skills (id, student_id, name, level, description, category, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [skillId, studentId, name, level || 1, description || null, category || null, notes || null]
    );

    // تسجيل العملية
    await pool.query(
      `INSERT INTO admin_logs (admin_id, action, table_name, record_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.admin.adminId, 'ADD_SKILL', 'skills', skillId, JSON.stringify(result.rows[0])]
    );

    res.status(201).json({
      success: true,
      message: 'تم إضافة المهارة بنجاح',
      skill: result.rows[0]
    });
  } catch (error) {
    console.error('خطأ في إضافة المهارة:', error);
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
});

// تحديث مهارة
router.put('/skills/:skillId', verifyAdminToken, async (req, res) => {
  try {
    const { skillId } = req.params;
    const { name, level, description, category, notes } = req.body;

    const result = await pool.query(
      `UPDATE skills 
       SET name = COALESCE($1, name),
           level = COALESCE($2, level),
           description = COALESCE($3, description),
           category = COALESCE($4, category),
           notes = COALESCE($5, notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [name || null, level || null, description || null, category || null, notes || null, skillId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'المهارة غير موجودة' });
    }

    // تسجيل العملية
    await pool.query(
      `INSERT INTO admin_logs (admin_id, action, table_name, record_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.admin.adminId, 'UPDATE_SKILL', 'skills', skillId, JSON.stringify(result.rows[0])]
    );

    res.json({
      success: true,
      message: 'تم تحديث المهارة بنجاح',
      skill: result.rows[0]
    });
  } catch (error) {
    console.error('خطأ في تحديث المهارة:', error);
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
});

// حذف مهارة
router.delete('/skills/:skillId', verifyAdminToken, async (req, res) => {
  try {
    const { skillId } = req.params;

    const result = await pool.query(
      'DELETE FROM skills WHERE id = $1 RETURNING *',
      [skillId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'المهارة غير موجودة' });
    }

    // تسجيل العملية
    await pool.query(
      `INSERT INTO admin_logs (admin_id, action, table_name, record_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.admin.adminId, 'DELETE_SKILL', 'skills', skillId, JSON.stringify(result.rows[0])]
    );

    res.json({ success: true, message: 'تم حذف المهارة بنجاح' });
  } catch (error) {
    console.error('خطأ في حذف المهارة:', error);
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
});

// إضافة تقييم للطالب
router.post('/students/:studentId/evaluations', verifyAdminToken, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { overallScore, comments } = req.body;

    const evaluationId = uuidv4();
    const result = await pool.query(
      `INSERT INTO student_evaluations (id, student_id, overall_score, comments, evaluation_date, created_at, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [evaluationId, studentId, overallScore || null, comments || null]
    );

    // تسجيل العملية
    await pool.query(
      `INSERT INTO admin_logs (admin_id, action, table_name, record_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.admin.adminId, 'ADD_EVALUATION', 'student_evaluations', evaluationId, JSON.stringify(result.rows[0])]
    );

    res.status(201).json({
      success: true,
      message: 'تم إضافة التقييم بنجاح',
      evaluation: result.rows[0]
    });
  } catch (error) {
    console.error('خطأ في إضافة التقييم:', error);
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
});

// الإحصائيات
router.get('/stats', verifyAdminToken, async (req, res) => {
  try {
    const studentsCount = await pool.query('SELECT COUNT(*) as count FROM students');
    const skillsCount = await pool.query('SELECT COUNT(*) as count FROM skills');
    const evaluationsCount = await pool.query('SELECT COUNT(*) as count FROM student_evaluations');
    const logsCount = await pool.query('SELECT COUNT(*) as count FROM admin_logs');

    res.json({
      success: true,
      stats: {
        studentsCount: parseInt(studentsCount.rows[0].count),
        skillsCount: parseInt(skillsCount.rows[0].count),
        evaluationsCount: parseInt(evaluationsCount.rows[0].count),
        logsCount: parseInt(logsCount.rows[0].count)
      }
    });
  } catch (error) {
    console.error('خطأ في الحصول على الإحصائيات:', error);
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
});

export default router;
