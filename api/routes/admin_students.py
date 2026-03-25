# Admin Student Routes
from flask import Blueprint, request, jsonify
import uuid
import sys
import os

parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

try:
    from auth import verify_admin
    from database import get_db, execute_query, invalidate_cache, get_all_students_cached, batch_insert_students
except ImportError:
    from api.auth import verify_admin
    from api.database import get_db, execute_query, invalidate_cache, get_all_students_cached, batch_insert_students

try:
    from psycopg.rows import dict_row
except ImportError:
    dict_row = None

admin_students_bp = Blueprint('admin_students', __name__, url_prefix='/api/admin')


@admin_students_bp.route('/students', methods=['GET'])
@verify_admin
def get_students():
    """Get all students with caching"""
    try:
        students = get_all_students_cached()
        students_list = []
        for row in students:
            students_list.append({
                'id': str(row['id']),
                'name': row['name'],
                'code': row['code'],
                'email': row['email'],
                'class': row['class'],
                'created_at': row['created_at'].isoformat() if row['created_at'] else None,
                'updated_at': row['updated_at'].isoformat() if row['updated_at'] else None
            })
        return jsonify({'success': True, 'students': students_list})
    except Exception as e:
        return jsonify({'success': False, 'message': f'خطأ في جلب البيانات: {str(e)}'}), 500


@admin_students_bp.route('/students', methods=['POST'])
@verify_admin
def add_student():
    """Add a new student with optimized queries"""
    data = request.json
    name = data.get('name')
    code = data.get('code')
    email = data.get('email')
    student_class = data.get('class')

    if not name or not code:
        return jsonify({'success': False, 'message': 'البيانات غير صحيحة'}), 400

    try:
        existing = execute_query('SELECT id FROM students WHERE code = %s', (code,), fetch_one=True)
        if existing:
            return jsonify({'success': False, 'message': 'رقم الطالب موجود بالفعل'}), 400

        student_id = str(uuid.uuid4())
        student = execute_query(
            'INSERT INTO students (id, name, code, email, class, created_at, updated_at) '
            'VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *',
            (student_id, name, code, email, student_class),
            fetch_one=True
        )

        invalidate_cache('get_all_students_cached')

        return jsonify({
            'success': True,
            'message': 'تم إضافة الطالب بنجاح',
            'student': {
                'id': str(student['id']),
                'name': student['name'],
                'code': student['code'],
                'email': student['email'],
                'class': student['class']
            }
        }), 201
    except Exception as e:
        return jsonify({'success': False, 'message': f'خطأ في إضافة الطالب: {str(e)}'}), 500


@admin_students_bp.route('/students/<student_id>', methods=['DELETE'])
@verify_admin
def delete_student(student_id):
    """Delete a student and all related data"""
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute('SELECT code, name FROM students WHERE id = %s', (student_id,))
                student = cur.fetchone()

                if not student:
                    return jsonify({'success': False, 'message': 'الطالب غير موجود'}), 404

                student_code = student['code']
                student_name = student['name']

                cur.execute('SELECT DISTINCT name FROM skills WHERE student_id = %s', (student_id,))
                skill_names = [row['name'] for row in cur.fetchall()]

                cur.execute('DELETE FROM skills WHERE student_id = %s', (student_id,))
                skills_deleted = cur.rowcount

                cur.execute('DELETE FROM students WHERE id = %s', (student_id,))

                for skill_name in skill_names:
                    cur.execute(
                        '''UPDATE skill_templates
                           SET usage_count = (SELECT COUNT(DISTINCT student_id) FROM skills WHERE name = %s AND student_id IS NOT NULL),
                               updated_at = CURRENT_TIMESTAMP
                           WHERE name = %s''',
                        (skill_name, skill_name)
                    )

                conn.commit()

        invalidate_cache()

        print(f"[INFO] Student deleted: ID={student_id}, Name={student_name}, Code={student_code}, Skills deleted={skills_deleted}")

        return jsonify({
            'success': True,
            'message': 'تم حذف الطالب بنجاح',
            'deleted': {
                'student_id': student_id,
                'student_name': student_name,
                'skills_count': skills_deleted
            }
        })
    except Exception as e:
        print(f"[ERROR] delete_student: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_students_bp.route('/students/delete-all', methods=['DELETE'])
@verify_admin
def delete_all_students():
    """Delete all students - much faster than individual deletes"""
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute('SELECT COUNT(*) as count FROM students')
                count_result = cur.fetchone()
                student_count = count_result['count'] if count_result else 0

                if student_count == 0:
                    return jsonify({'success': True, 'message': 'لا يوجد طلاب لحذفهم', 'count': 0})

                cur.execute('SELECT DISTINCT name FROM skills')
                skill_names = [row['name'] for row in cur.fetchall()]

                cur.execute('DELETE FROM students')

                for skill_name in skill_names:
                    cur.execute(
                        '''UPDATE skill_templates
                           SET usage_count = 0,
                               updated_at = CURRENT_TIMESTAMP
                           WHERE name = %s''',
                        (skill_name,)
                    )

                conn.commit()

        invalidate_cache()

        print(f"[INFO] Deleted all students: count={student_count}")

        return jsonify({
            'success': True,
            'message': f'تم حذف جميع الطلاب ({student_count}) بنجاح',
            'count': student_count
        })
    except Exception as e:
        print(f"[ERROR] delete_all_students: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_students_bp.route('/students/<student_id>', methods=['PUT'])
@verify_admin
def update_student(student_id):
    """Update a student's information"""
    data = request.json
    name = data.get('name')
    code = data.get('code')
    email = data.get('email')
    student_class = data.get('class')

    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                if code:
                    cur.execute('SELECT id FROM students WHERE code = %s AND id != %s', (code, student_id))
                    if cur.fetchone():
                        return jsonify({'success': False, 'message': 'رقم الطالب موجود بالفعل'}), 400

                cur.execute(
                    'UPDATE students SET '
                    'name = COALESCE(%s, name), '
                    'code = COALESCE(%s, code), '
                    'email = COALESCE(%s, email), '
                    'class = COALESCE(%s, class), '
                    'updated_at = CURRENT_TIMESTAMP '
                    'WHERE id = %s RETURNING *',
                    (name, code, email, student_class, student_id)
                )
                student = cur.fetchone()

                if not student:
                    return jsonify({'success': False, 'message': 'الطالب غير موجود'}), 404

                conn.commit()

        invalidate_cache('get_all_students_cached')
        return jsonify({
            'success': True,
            'message': 'تم تحديث بيانات الطالب بنجاح',
            'student': {
                'id': str(student['id']),
                'name': student['name'],
                'code': student['code'],
                'email': student['email'],
                'class': student['class']
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_students_bp.route('/students/batch', methods=['POST'])
@verify_admin
def batch_add_students():
    """Batch add multiple students efficiently"""
    data = request.json
    students = data.get('students', [])

    if not students or not isinstance(students, list):
        return jsonify({'success': False, 'message': 'يجب إرسال قائمة الطلاب'}), 400

    try:
        created_students = batch_insert_students(students)
        if created_students is not None:
            invalidate_cache()
            return jsonify({
                'success': True,
                'message': f'تم إضافة {len(created_students)} طالب بنجاح',
                'count': len(created_students),
                'students': created_students
            }), 201
        else:
            return jsonify({'success': False, 'message': 'فشل في إضافة الطلاب'}), 500
    except Exception as e:
        print(f"[ERROR] batch_add_students: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'خطأ في الإضافة الجماعية: {str(e)}'}), 500
