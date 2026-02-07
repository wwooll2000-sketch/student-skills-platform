/**
 * REST API Routes للعمل مع قاعدة البيانات
 * يتم إضافة هذا الملف إلى api/routes/sync.js
 */

import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// ===================== حفظ بيانات الطالب =====================

/**
 * POST /api/sync/student
 * حفظ بيانات الطالب في قاعدة البيانات
 */
router.post('/student', async (req, res) => {
    try {
        const { code, name, createdAt, skills } = req.body;

        if (!code || !name) {
            return res.status(400).json({
                success: false,
                message: 'رقم الطالب والاسم مطلوبان'
            });
        }

        // التحقق من وجود الطالب
        const existingStudent = await pool.query(
            'SELECT id FROM students WHERE code = $1',
            [code]
        );

        let studentId;

        if (existingStudent.rows.length > 0) {
            // تحديث الطالب الموجود
            studentId = existingStudent.rows[0].id;
            await pool.query(
                'UPDATE students SET name = $1, updated_at = NOW() WHERE id = $2',
                [name, studentId]
            );
        } else {
            // إنشاء طالب جديد
            const result = await pool.query(
                'INSERT INTO students (code, name, created_at) VALUES ($1, $2, NOW()) RETURNING id',
                [code, name]
            );
            studentId = result.rows[0].id;
        }

        // حفظ المهارات إذا كانت موجودة
        if (skills && Array.isArray(skills)) {
            for (const skill of skills) {
                await saveSkill(studentId, skill);
            }
        }

        res.json({
            success: true,
            message: 'تم حفظ بيانات الطالب بنجاح',
            studentId: studentId
        });

    } catch (error) {
        console.error('❌ خطأ في حفظ بيانات الطالب:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في التخزين',
            error: error.message
        });
    }
});

// ===================== حفظ المهارات =====================

/**
 * POST /api/sync/skills
 * حفظ مهارات الطالب في قاعدة البيانات
 */
router.post('/skills', async (req, res) => {
    try {
        const { studentId, skills } = req.body;

        if (!studentId || !Array.isArray(skills)) {
            return res.status(400).json({
                success: false,
                message: 'بيانات المهارات غير صحيحة'
            });
        }

        // التحقق من وجود الطالب
        const student = await pool.query(
            'SELECT id FROM students WHERE id = $1',
            [studentId]
        );

        if (student.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'الطالب غير موجود'
            });
        }

        // حفظ كل مهارة
        for (const skill of skills) {
            await saveSkill(studentId, skill);
        }

        res.json({
            success: true,
            message: `تم حفظ ${skills.length} مهارات بنجاح`,
            count: skills.length
        });

    } catch (error) {
        console.error('❌ خطأ في حفظ المهارات:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في التخزين',
            error: error.message
        });
    }
});

/**
 * دالة مساعدة لحفظ المهارة
 */
async function saveSkill(studentId, skill) {
    try {
        // التحقق من وجود المهارة
        const existingSkill = await pool.query(
            'SELECT id FROM skills WHERE student_id = $1 AND name = $2',
            [studentId, skill.name]
        );

        if (existingSkill.rows.length > 0) {
            // تحديث المهارة
            await pool.query(
                `UPDATE skills 
                 SET level = $1, category = $2, updated_at = NOW()
                 WHERE student_id = $3 AND name = $4`,
                [skill.level, skill.category || 'عام', studentId, skill.name]
            );
        } else {
            // إنشاء مهارة جديدة
            await pool.query(
                `INSERT INTO skills (student_id, name, level, category)
                 VALUES ($1, $2, $3, $4)`,
                [studentId, skill.name, skill.level, skill.category || 'عام']
            );
        }
    } catch (error) {
        console.error(`❌ خطأ في حفظ المهارة ${skill.name}:`, error);
        throw error;
    }
}

// ===================== حفظ الملاحظات =====================

/**
 * POST /api/sync/notes
 * حفظ ملاحظات الطالب
 */
router.post('/notes', async (req, res) => {
    try {
        const { studentId, notes } = req.body;

        if (!studentId || !notes) {
            return res.status(400).json({
                success: false,
                message: 'بيانات الملاحظات غير صحيحة'
            });
        }

        // التحقق من وجود الطالب
        const student = await pool.query(
            'SELECT id FROM students WHERE id = $1',
            [studentId]
        );

        if (student.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'الطالب غير موجود'
            });
        }

        // حفظ الملاحظات (يجب أن يكون هناك جدول notes في قاعدة البيانات)
        await pool.query(
            `INSERT INTO notes (student_id, content, created_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (student_id) DO UPDATE
             SET content = EXCLUDED.content, updated_at = NOW()`,
            [studentId, notes]
        );

        res.json({
            success: true,
            message: 'تم حفظ الملاحظات بنجاح'
        });

    } catch (error) {
        console.error('❌ خطأ في حفظ الملاحظات:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في التخزين',
            error: error.message
        });
    }
});

// ===================== المزامنة العامة =====================

/**
 * POST /api/sync/data
 * حفظ البيانات العامة في قاعدة البيانات
 */
router.post('/data', async (req, res) => {
    try {
        const { key, data, timestamp } = req.body;

        if (!key || !data) {
            return res.status(400).json({
                success: false,
                message: 'البيانات المرسلة غير كاملة'
            });
        }

        console.log(`🔄 جاري مزامنة: ${key}`);

        // معالجة البيانات حسب نوعها
        if (key.startsWith('student_')) {
            // بيانات طالب
            const { code, name } = data;
            if (code && name) {
                await pool.query(
                    `INSERT INTO students (code, name) 
                     VALUES ($1, $2)
                     ON CONFLICT (code) DO UPDATE 
                     SET name = EXCLUDED.name, updated_at = NOW()`,
                    [code, name]
                );
            }
        } else if (key.startsWith('skills_')) {
            // بيانات المهارات
            const studentId = key.replace('skills_', '');
            if (data.skills && Array.isArray(data.skills)) {
                for (const skill of data.skills) {
                    await saveSkill(studentId, skill);
                }
            }
        } else if (key.startsWith('notes_')) {
            // ملاحظات الطالب
            const studentId = key.replace('notes_', '');
            if (data.notes) {
                await pool.query(
                    `INSERT INTO notes (student_id, content)
                     VALUES ($1, $2)
                     ON CONFLICT (student_id) DO UPDATE
                     SET content = EXCLUDED.content`,
                    [studentId, data.notes]
                );
            }
        }

        res.json({
            success: true,
            message: `تم مزامنة ${key} بنجاح`,
            key: key,
            syncedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ خطأ في المزامنة:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في المزامنة',
            error: error.message
        });
    }
});

// ===================== الحصول على البيانات =====================

/**
 * GET /api/sync/student/:studentId
 * الحصول على بيانات الطالب من قاعدة البيانات
 */
router.get('/student/:studentId', async (req, res) => {
    try {
        const { studentId } = req.params;

        const student = await pool.query(
            'SELECT * FROM students WHERE id = $1',
            [studentId]
        );

        if (student.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'الطالب غير موجود'
            });
        }

        const skills = await pool.query(
            'SELECT * FROM skills WHERE student_id = $1 ORDER BY name',
            [studentId]
        );

        res.json({
            success: true,
            student: student.rows[0],
            skills: skills.rows
        });

    } catch (error) {
        console.error('❌ خطأ في الحصول على بيانات الطالب:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ===================== إحصائيات المزامنة =====================

/**
 * GET /api/sync/status
 * الحصول على حالة المزامنة
 */
router.get('/status', async (req, res) => {
    try {
        const studentCount = await pool.query('SELECT COUNT(*) FROM students');
        const skillsCount = await pool.query('SELECT COUNT(*) FROM skills');

        res.json({
            success: true,
            status: 'online',
            timestamp: new Date().toISOString(),
            database: {
                students: parseInt(studentCount.rows[0].count),
                skills: parseInt(skillsCount.rows[0].count)
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            status: 'offline',
            error: error.message
        });
    }
});

// ===================== مسح البيانات (اختياري) =====================

/**
 * DELETE /api/sync/clear
 * مسح جميع البيانات المزامنة (للاختبار فقط)
 * تحذير: هذا سيحذف جميع البيانات!
 */
router.delete('/clear', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        
        // التحقق من التفويض (استخدم token حقيقي في الإنتاج)
        if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_TOKEN}`) {
            return res.status(403).json({
                success: false,
                message: 'غير مصرح'
            });
        }

        await pool.query('DELETE FROM skills');
        await pool.query('DELETE FROM students');

        res.json({
            success: true,
            message: 'تم مسح جميع البيانات'
        });

    } catch (error) {
        console.error('❌ خطأ في مسح البيانات:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
