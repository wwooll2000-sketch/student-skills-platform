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
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    'INSERT INTO skills (id, student_id, name, level, description, notes, evidence_url, created_at, updated_at) '
                    'VALUES (%s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *',
                    (skill_id, student_id, name, level, description, notes, evidence)
                )
                skill = cur.fetchone()

                # Recalculate usage count for this skill template
                cur.execute(
                    '''UPDATE skill_templates
                       SET usage_count = (SELECT COUNT(DISTINCT student_id) FROM skills WHERE name = %s AND student_id IS NOT NULL),
                           updated_at = CURRENT_TIMESTAMP
                       WHERE name = %s''',
                    (name, name)
                )
                conn.commit()

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
            # Recalculate usage counts for all affected skill templates
            skill_names = list({s['name'] for s in skills if s.get('name')})
            if skill_names:
                with get_db() as conn:
                    with conn.cursor() as cur:
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


# ─── Skill Template Visibility ──────────────────────────────────────────────

@admin_skills_bp.route('/skill-templates/<template_id>/hidden', methods=['PATCH'])
@verify_admin
def toggle_skill_template_hidden(template_id):
    """Toggle is_hidden_from_students for a skill template"""
    data = request.json or {}
    is_hidden = bool(data.get('is_hidden', False))
    try:
        t = execute_query(
            'UPDATE skill_templates SET is_hidden_from_students = %s, updated_at = CURRENT_TIMESTAMP '
            'WHERE id = %s RETURNING id, is_hidden_from_students',
            (is_hidden, template_id),
            fetch_one=True
        )
        if not t:
            return jsonify({'success': False, 'message': 'المهارة غير موجودة'}), 404
        # Invalidate all caches — hidden state affects every student
        invalidate_cache()
        return jsonify({
            'success': True,
            'is_hidden_from_students': t['is_hidden_from_students'],
            'message': 'تم تحديث حالة المهارة'
        })
    except Exception as e:
        print(f'[ERROR] toggle_skill_template_hidden: {str(e)}')
        return jsonify({'success': False, 'message': str(e)}), 500


# ─── Test Questions CRUD ─────────────────────────────────────────────────────

@admin_skills_bp.route('/skill-templates/<template_id>/test-questions', methods=['GET'])
@verify_admin
def get_test_questions(template_id):
    """Get all test questions for a skill template"""
    try:
        rows = execute_query(
            'SELECT id, question, correct_answer, order_num FROM skill_test_questions '
            'WHERE template_id = %s ORDER BY order_num ASC, created_at ASC',
            (template_id,),
            fetch_all=True
        )
        return jsonify({
            'success': True,
            'questions': [
                {
                    'id': str(r['id']),
                    'question': r['question'],
                    'correct_answer': r['correct_answer'],
                    'order_num': r['order_num']
                }
                for r in (rows or [])
            ]
        })
    except Exception as e:
        print(f"[ERROR] get_test_questions: {str(e)}")
        return jsonify({'success': False, 'message': f'خطأ: {str(e)}'}), 500


@admin_skills_bp.route('/skill-templates/<template_id>/test-questions', methods=['POST'])
@verify_admin
def add_test_question(template_id):
    """Add a test question to a skill template (max 5)"""
    data = request.json or {}
    question_text = data.get('question', '').strip()
    correct_answer = data.get('correct_answer')
    order_num = data.get('order_num', 0)

    if not question_text or correct_answer is None:
        return jsonify({'success': False, 'message': 'السؤال والإجابة مطلوبان'}), 400

    try:
        count_row = execute_query(
            'SELECT COUNT(*) as cnt FROM skill_test_questions WHERE template_id = %s',
            (template_id,),
            fetch_one=True
        )
        if count_row and count_row['cnt'] >= 5:
            return jsonify({'success': False, 'message': 'الحد الأقصى 5 أسئلة لكل اختبار'}), 400

        q = execute_query(
            'INSERT INTO skill_test_questions (template_id, question, correct_answer, order_num) '
            'VALUES (%s, %s, %s, %s) RETURNING id, question, correct_answer, order_num',
            (template_id, question_text, bool(correct_answer), int(order_num)),
            fetch_one=True
        )
        return jsonify({
            'success': True,
            'question': {
                'id': str(q['id']),
                'question': q['question'],
                'correct_answer': q['correct_answer'],
                'order_num': q['order_num']
            }
        }), 201
    except Exception as e:
        print(f"[ERROR] add_test_question: {str(e)}")
        return jsonify({'success': False, 'message': f'خطأ: {str(e)}'}), 500


@admin_skills_bp.route('/test-questions/<question_id>', methods=['PUT'])
@verify_admin
def update_test_question(question_id):
    """Update a test question"""
    data = request.json or {}
    question_text = data.get('question', '').strip()
    correct_answer = data.get('correct_answer')
    order_num = data.get('order_num')

    if not question_text or correct_answer is None:
        return jsonify({'success': False, 'message': 'السؤال والإجابة مطلوبان'}), 400

    try:
        q = execute_query(
            'UPDATE skill_test_questions SET question = %s, correct_answer = %s, '
            'order_num = COALESCE(%s, order_num) WHERE id = %s '
            'RETURNING id, question, correct_answer, order_num',
            (question_text, bool(correct_answer), order_num, question_id),
            fetch_one=True
        )
        if not q:
            return jsonify({'success': False, 'message': 'السؤال غير موجود'}), 404
        return jsonify({
            'success': True,
            'question': {
                'id': str(q['id']),
                'question': q['question'],
                'correct_answer': q['correct_answer'],
                'order_num': q['order_num']
            }
        })
    except Exception as e:
        print(f"[ERROR] update_test_question: {str(e)}")
        return jsonify({'success': False, 'message': f'خطأ: {str(e)}'}), 500


@admin_skills_bp.route('/test-questions/<question_id>', methods=['DELETE'])
@verify_admin
def delete_test_question(question_id):
    """Delete a test question"""
    try:
        q = execute_query(
            'DELETE FROM skill_test_questions WHERE id = %s RETURNING id',
            (question_id,),
            fetch_one=True
        )
        if not q:
            return jsonify({'success': False, 'message': 'السؤال غير موجود'}), 404
        return jsonify({'success': True, 'message': 'تم حذف السؤال'})
    except Exception as e:
        print(f"[ERROR] delete_test_question: {str(e)}")
        return jsonify({'success': False, 'message': f'خطأ: {str(e)}'}), 500


@admin_skills_bp.route('/skill-templates/<template_id>/test-config', methods=['PATCH'])
@verify_admin
def update_test_config(template_id):
    """Update test configuration (max attempts) for a skill template"""
    data = request.json or {}
    max_attempts = data.get('max_test_attempts')

    if max_attempts is None:
        return jsonify({'success': False, 'message': 'عدد المحاولات مطلوب'}), 400
    try:
        max_attempts = int(max_attempts)
    except (ValueError, TypeError):
        return jsonify({'success': False, 'message': 'عدد المحاولات يجب أن يكون رقماً'}), 400
    if max_attempts < 1:
        return jsonify({'success': False, 'message': 'عدد المحاولات يجب أن يكون 1 على الأقل'}), 400

    try:
        t = execute_query(
            'UPDATE skill_templates SET max_test_attempts = %s, updated_at = CURRENT_TIMESTAMP '
            'WHERE id = %s RETURNING id',
            (max_attempts, template_id),
            fetch_one=True
        )
        if not t:
            return jsonify({'success': False, 'message': 'المهارة غير موجودة'}), 404
        return jsonify({'success': True, 'message': 'تم تحديث إعدادات الاختبار', 'max_test_attempts': max_attempts})
    except Exception as e:
        print(f"[ERROR] update_test_config: {str(e)}")
        return jsonify({'success': False, 'message': f'خطأ: {str(e)}'}), 500


@admin_skills_bp.route('/skills/<skill_id>/reset-test-attempts', methods=['POST'])
@verify_admin
def reset_test_attempts(skill_id):
    """Reset test attempts for a specific student skill"""
    try:
        execute_query(
            'DELETE FROM skill_test_attempts WHERE skill_id = %s',
            (skill_id,)
        )
        return jsonify({'success': True, 'message': 'تم إعادة تعيين محاولات الاختبار'})
    except Exception as e:
        print(f"[ERROR] reset_test_attempts: {str(e)}")
        return jsonify({'success': False, 'message': f'خطأ: {str(e)}'}), 500


@admin_skills_bp.route('/skill-templates/<template_id>/reset-all-test-attempts', methods=['POST'])
@verify_admin
def reset_all_test_attempts_for_template(template_id):
    """Reset test attempts for ALL students for a given skill template"""
    try:
        # Delete attempts for all skills with the same template name
        template = execute_query(
            'SELECT name FROM skill_templates WHERE id = %s',
            (template_id,),
            fetch_one=True
        )
        if not template:
            return jsonify({'success': False, 'message': 'المهارة غير موجودة'}), 404

        execute_query(
            '''DELETE FROM skill_test_attempts
               WHERE skill_id IN (
                   SELECT id FROM skills WHERE name = %s
               )''',
            (template['name'],)
        )
        return jsonify({'success': True, 'message': 'تم إعادة تعيين محاولات جميع الطلاب'})
    except Exception as e:
        print(f"[ERROR] reset_all_test_attempts_for_template: {str(e)}")
        return jsonify({'success': False, 'message': f'خطأ: {str(e)}'}), 500


@admin_skills_bp.route('/skill-templates/<template_id>/test-stats', methods=['GET'])
@verify_admin
def get_test_stats(template_id):
    """Get test attempt statistics for a skill template (for admin view)"""
    try:
        template = execute_query(
            'SELECT name, max_test_attempts FROM skill_templates WHERE id = %s',
            (template_id,),
            fetch_one=True
        )
        if not template:
            return jsonify({'success': False, 'message': 'المهارة غير موجودة'}), 404

        rows = execute_query(
            '''SELECT st.name as student_name, st.code,
                      sk.id as skill_id,
                      COUNT(ta.id) as attempts_used,
                      MAX(ta.score) as best_score,
                      BOOL_OR(ta.passed) as ever_passed
               FROM students st
               JOIN skills sk ON sk.student_id = st.id AND sk.name = %s
               LEFT JOIN skill_test_attempts ta ON ta.skill_id = sk.id
               GROUP BY st.name, st.code, sk.id
               ORDER BY st.name ASC''',
            (template['name'],),
            fetch_all=True
        )
        return jsonify({
            'success': True,
            'max_test_attempts': template['max_test_attempts'] or 3,
            'students': [
                {
                    'student_name': r['student_name'],
                    'code': r['code'],
                    'skill_id': str(r['skill_id']),
                    'attempts_used': r['attempts_used'],
                    'best_score': r['best_score'],
                    'ever_passed': r['ever_passed'] or False
                }
                for r in (rows or [])
            ]
        })
    except Exception as e:
        print(f"[ERROR] get_test_stats: {str(e)}")
        return jsonify({'success': False, 'message': f'خطأ: {str(e)}'}), 500
