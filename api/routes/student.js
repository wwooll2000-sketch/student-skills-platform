import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db.js';

const router = express.Router();

// تسجيل الدخول برقم الطالب
router.post('/login', async (req, res) => {
  try {
    const { studentCode } = req.body;

    if (!studentCode || studentCode.length < 4) {
      return res.status(400).json({ success: false, message: 'رقم الطالب غير صحيح' });
    }

    // البحث عن الطالب
    const result = await pool.query(
      'SELECT * FROM students WHERE code = $1',
      [studentCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'رقم الطالب غير موجود' });
    }

    const student = result.rows[0];

    res.json({
      success: true,
      message: 'تم الدخول بنجاح',
      student: {
        id: student.id,
        name: student.name,
        code: student.code,
        class: student.class,
        email: student.email
      }
    });
  } catch (error) {
    console.error('خطأ في تسجيل الدخول:', error);
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
});

// الحصول على بيانات الطالب
router.get('/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;

    const result = await pool.query(
      'SELECT * FROM students WHERE id = $1',
      [studentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'الطالب غير موجود' });
    }

    const student = result.rows[0];

    // الحصول على مهارات الطالب
    const skillsResult = await pool.query(
      'SELECT * FROM skills WHERE student_id = $1 ORDER BY created_at DESC',
      [studentId]
    );

    res.json({
      success: true,
      student: {
        ...student,
        skills: skillsResult.rows
      }
    });
  } catch (error) {
    console.error('خطأ في جلب بيانات الطالب:', error);
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
});

// الحصول على مهارات الطالب
router.get('/:studentId/skills', async (req, res) => {
  try {
    const { studentId } = req.params;

    const result = await pool.query(
      'SELECT * FROM skills WHERE student_id = $1 ORDER BY level DESC, created_at DESC',
      [studentId]
    );

    res.json({
      success: true,
      skills: result.rows
    });
  } catch (error) {
    console.error('خطأ في جلب المهارات:', error);
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
});

// الحصول على تقييمات الطالب
router.get('/:studentId/evaluations', async (req, res) => {
  try {
    const { studentId } = req.params;

    const result = await pool.query(
      'SELECT * FROM student_evaluations WHERE student_id = $1 ORDER BY evaluation_date DESC',
      [studentId]
    );

    res.json({
      success: true,
      evaluations: result.rows
    });
  } catch (error) {
    console.error('خطأ في جلب التقييمات:', error);
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
});

export default router;
