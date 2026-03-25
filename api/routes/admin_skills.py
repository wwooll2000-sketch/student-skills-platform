# Admin Skill Routes
from flask import Blueprint, request, jsonify
import uuid
import sys
import os

parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

try:
    from auth import verify_admin
    from database import get_db, execute_query, invalidate_cache, batch_insert_skills
except ImportError:
    from api.auth import verify_admin
    from api.database import get_db, execute_query, invalidate_cache, batch_insert_skills

admin_skills_bp = Blueprint('admin_skills', __name__, url_prefix='/api/admin')


@admin_skills_bp.route('/students/<student_id>/skills', methods=['POST'])
@verify_admin
def add_skill(student_id):
    """Add a skill to a student"""
    data = request.json
    name = data.get('name')
    level = data.get('level', 1)
    description = data.get('description')
    notes = data.get('notes')
    evidence = data.get('evidence')

    if not name:
        return jsonify({'success': False, 'message': 'البيانات غير صحيحة'}), 400

    try:
        skill_id = str(uuid.uuid4())
        skill = execute_query(
            'INSERT INTO skills (id, student_id, name, level, description, notes, evidence_url, created_at, updated_at) '
            'VALUES (%s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *',
            (skill_id, student_id, name, level, description, notes, evidence),
            fetch_one=True
        )

        invalidate_cache(f"get_student_skills_cached:('{student_id}',)")

        return jsonify({
            'success': True,
            'message': 'تم إضافة المهارة بنجاح',
            'skill': {
                'id': str(skill['id']),
                'student_id': str(skill['student_id']),
                'name': skill['name'],
                'level': skill['level']
            }
        }), 201
    except Exception as e:
        print(f"[ERROR] add_skill: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_skills_bp.route('/skills/<skill_id>', methods=['PUT'])
@verify_admin
def update_skill(skill_id):
    """Update a skill"""
    data = request.json
    name = data.get('name')
    level = data.get('level')
    description = data.get('description')
    notes = data.get('notes')
    evidence = data.get('evidence')

    try:
        skill = execute_query(
            'UPDATE skills SET '
            'name = COALESCE(%s, name), '
            'level = COALESCE(%s, level), '
            'description = COALESCE(%s, description), '
            'notes = COALESCE(%s, notes), '
            'evidence_url = COALESCE(%s, evidence_url), '
            'updated_at = CURRENT_TIMESTAMP '
            'WHERE id = %s RETURNING *',
            (name, level, description, notes, evidence, skill_id),
            fetch_one=True
        )

        if not skill:
            return jsonify({'success': False, 'message': 'المهارة غير موجودة'}), 404

        student_id = skill['student_id']
        invalidate_cache(f"get_student_skills_cached:('{student_id}',)")

        return jsonify({
            'success': True,
            'message': 'تم تحديث المهارة بنجاح',
            'skill': {
                'id': str(skill['id']),
                'name': skill['name'],
                'level': skill['level']
            }
        })
    except Exception as e:
        print(f"[ERROR] update_skill: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_skills_bp.route('/skills/<skill_id>', methods=['DELETE'])
@verify_admin
def delete_skill(skill_id):
    """Delete a skill"""
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute('SELECT name, student_id FROM skills WHERE id = %s', (skill_id,))
                skill_data = cur.fetchone()

                if not skill_data:
                    return jsonify({'success': False, 'message': 'المهارة غير موجودة'}), 404

                skill_name = skill_data['name']
                student_id = skill_data['student_id']

                cur.execute('DELETE FROM skills WHERE id = %s RETURNING *', (skill_id,))

                cur.execute(
                    '''UPDATE skill_templates
                       SET usage_count = (SELECT COUNT(DISTINCT student_id) FROM skills WHERE name = %s AND student_id IS NOT NULL),
                           updated_at = CURRENT_TIMESTAMP
                       WHERE name = %s''',
                    (skill_name, skill_name)
                )

                conn.commit()

        invalidate_cache(f"get_student_skills_cached:('{student_id}',)")
        return jsonify({'success': True, 'message': 'تم حذف المهارة بنجاح'})
    except Exception as e:
        print(f"[ERROR] delete_skill: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_skills_bp.route('/students/<student_id>/skills', methods=['DELETE'])
@verify_admin
def delete_all_student_skills(student_id):
    """Delete all skills for a specific student"""
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute('SELECT DISTINCT name FROM skills WHERE student_id = %s', (student_id,))
                skill_names = [row['name'] for row in cur.fetchall()]

                cur.execute('DELETE FROM skills WHERE student_id = %s RETURNING id', (student_id,))
                deleted_skills = cur.fetchall()
                deleted_count = len(deleted_skills)

                for skill_name in skill_names:
                    cur.execute(
                        '''UPDATE skill_templates
                           SET usage_count = (SELECT COUNT(DISTINCT student_id) FROM skills WHERE name = %s AND student_id IS NOT NULL),
                               updated_at = CURRENT_TIMESTAMP
                           WHERE name = %s''',
                        (skill_name, skill_name)
                    )

                conn.commit()

        invalidate_cache(f"get_student_skills_cached:('{student_id}',)")

        return jsonify({
            'success': True,
            'message': f'تم حذف {deleted_count} مهارة بنجاح',
            'deleted_count': deleted_count
        })
    except Exception as e:
        print(f"[ERROR] delete_all_student_skills: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_skills_bp.route('/skills/batch', methods=['POST'])
@verify_admin
def batch_add_skills():
    """Batch add multiple skills efficiently"""
    data = request.json
    skills = data.get('skills', [])

    if not skills or not isinstance(skills, list):
        return jsonify({'success': False, 'message': 'يجب إرسال قائمة المهارات'}), 400

    try:
        success = batch_insert_skills(skills)
        if success:
            invalidate_cache()
            return jsonify({
                'success': True,
                'message': f'تم إضافة {len(skills)} مهارة بنجاح',
                'count': len(skills)
            }), 201
        else:
            return jsonify({'success': False, 'message': 'فشل في إضافة المهارات'}), 500
    except Exception as e:
        print(f"[ERROR] Batch add skills exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'خطأ في الإضافة الجماعية: {str(e)}'}), 500


@admin_skills_bp.route('/skills/students-by-skill', methods=['GET'])
@verify_admin
def get_all_students_by_skill():
    """Get all students who have a skill by name, split into ready/not_ready"""
    skill_name = request.args.get('skill_name', '').strip()
    if not skill_name:
        return jsonify({'success': False, 'message': 'اسم المهارة مطلوب'}), 400
    try:
        rows = execute_query(
            '''SELECT st.id, st.name, st.code, st.class, st.email,
                      sk.id as skill_id, sk.is_student_ready
               FROM students st
               JOIN skills sk ON sk.student_id = st.id
               WHERE sk.name = %s
               ORDER BY st.name ASC''',
            (skill_name,),
            fetch_all=True
        )
        ready = []
        not_ready = []
        for r in (rows or []):
            entry = {
                'id': str(r['id']),
                'name': r['name'],
                'code': r['code'],
                'class': r['class'] or '',
                'email': r['email'] or '',
                'skill_id': str(r['skill_id'])
            }
            if r['is_student_ready']:
                ready.append(entry)
            else:
                not_ready.append(entry)
        return jsonify({'success': True, 'skill_name': skill_name, 'ready': ready, 'not_ready': not_ready})
    except Exception as e:
        print(f"[ERROR] get_all_students_by_skill: {str(e)}")
        return jsonify({'success': False, 'message': f'خطأ: {str(e)}'}), 500


@admin_skills_bp.route('/skills/ready-students', methods=['GET'])
@verify_admin
def get_ready_students_for_skill():
    """Get all students who marked themselves ready for a specific skill"""
    skill_name = request.args.get('skill_name', '').strip()

    if not skill_name:
        return jsonify({'success': False, 'message': 'اسم المهارة مطلوب'}), 400

    try:
        rows = execute_query(
            '''SELECT st.id, st.name, st.code, st.class, st.email,
                      sk.id as skill_id, sk.updated_at
               FROM students st
               JOIN skills sk ON sk.student_id = st.id
               WHERE sk.name = %s AND sk.is_student_ready = TRUE
               ORDER BY st.name ASC''',
            (skill_name,),
            fetch_all=True
        )

        return jsonify({
            'success': True,
            'skill_name': skill_name,
            'students': [
                {
                    'id': str(r['id']),
                    'name': r['name'],
                    'code': r['code'],
                    'class': r['class'],
                    'email': r['email'],
                    'skill_id': str(r['skill_id']),
                    'ready_at': r['updated_at'].isoformat() if r['updated_at'] else None
                }
                for r in rows
            ] if rows else []
        })
    except Exception as e:
        print(f"[ERROR] get_ready_students_for_skill: {str(e)}")
        return jsonify({'success': False, 'message': f'خطأ: {str(e)}'}), 500


@admin_skills_bp.route('/skills/batch-ready', methods=['PATCH'])
@verify_admin
def admin_batch_toggle_skill_ready():
    """Admin batch-updates is_student_ready for multiple skill IDs"""
    data = request.json or {}
    skill_ids = data.get('skill_ids', [])
    is_ready = bool(data.get('is_ready', False))

    if not skill_ids or not isinstance(skill_ids, list):
        return jsonify({'success': False, 'message': 'skill_ids مطلوب'}), 400

    try:
        skill_uuids = [uuid.UUID(sid) for sid in skill_ids]

        rows = execute_query(
            'UPDATE skills SET is_student_ready = %s, updated_at = CURRENT_TIMESTAMP '
            'WHERE id = ANY(%s) RETURNING id, student_id',
            (is_ready, skill_uuids),
            fetch_all=True
        )

        seen = set()
        for r in (rows or []):
            sid = str(r['student_id'])
            if sid not in seen:
                seen.add(sid)
                invalidate_cache(f"get_student_skills_cached:('{sid}',)")

        updated = len(rows) if rows else 0
        return jsonify({'success': True, 'updated': updated, 'message': f'تم تحديث {updated} مهارة'})
    except Exception as e:
        print(f"[ERROR] admin_batch_toggle_skill_ready: {str(e)}")
        return jsonify({'success': False, 'message': f'خطأ: {str(e)}'}), 500


@admin_skills_bp.route('/skills/<skill_id>/ready', methods=['PATCH'])
@verify_admin
def admin_toggle_skill_ready(skill_id):
    """Admin toggles is_student_ready for any skill"""
    data = request.json or {}
    is_ready = bool(data.get('is_ready', False))

    try:
        skill = execute_query(
            'UPDATE skills SET is_student_ready = %s, updated_at = CURRENT_TIMESTAMP '
            'WHERE id = %s RETURNING id, student_id, is_student_ready',
            (is_ready, skill_id),
            fetch_one=True
        )

        if not skill:
            return jsonify({'success': False, 'message': 'المهارة غير موجودة'}), 404

        student_id = skill['student_id']
        invalidate_cache(f"get_student_skills_cached:('{student_id}',)")

        return jsonify({
            'success': True,
            'message': 'تم تحديث حالة الجاهزية',
            'is_student_ready': skill['is_student_ready']
        })
    except Exception as e:
        print(f"[ERROR] admin_toggle_skill_ready: {str(e)}")
        return jsonify({'success': False, 'message': f'خطأ: {str(e)}'}), 500
