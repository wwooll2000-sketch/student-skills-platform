# Student Routes
from flask import Blueprint, request, jsonify
from functools import wraps
import sys
import os
import uuid

# Add parent directory to path for imports
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

try:
    from database import get_db, execute_query, get_student_by_code_cached, get_student_skills_cached, invalidate_cache
except ImportError:
    from api.database import get_db, execute_query, get_student_by_code_cached, get_student_skills_cached, invalidate_cache

import jwt
try:
    from auth import get_jwt_secret
except ImportError:
    try:
        from api.auth import get_jwt_secret
    except ImportError:
        def get_jwt_secret():
            return os.environ.get('JWT_SECRET', 'secret')

student_bp = Blueprint('student', __name__, url_prefix='/api/student')

def verify_student_exists(f):
    """Decorator to verify student still exists in database"""
    @wraps(f)
    def decorated(*args, **kwargs):
        student_id = kwargs.get('student_id')
        if not student_id:
            return jsonify({'success': False, 'message': 'معرف الطالب مطلوب', 'student_deleted': True}), 400
        
        try:
            # Check if student exists
            student = execute_query(
                'SELECT id FROM students WHERE id = %s',
                (student_id,),
                fetch_one=True
            )
            
            if not student:
                # Student was deleted - return special response
                return jsonify({
                    'success': False,
                    'message': 'تم حذف حساب الطالب من قبل المعلم',
                    'student_deleted': True
                }), 404
            
            # Student exists, proceed with the route handler
            return f(*args, **kwargs)
        except Exception as e:
            return jsonify({'success': False, 'message': f'خطأ في التحقق: {str(e)}'}), 500
    return decorated

@student_bp.route('/login', methods=['POST'])
def student_login():
    """Student login endpoint with caching"""
    data = request.json
    student_code = data.get('studentCode')
    
    if not student_code or len(student_code) < 4:
        return jsonify({'success': False, 'message': 'رقم الطالب غير صحيح'}), 400
    
    try:
        # Use cached query for faster login
        student = get_student_by_code_cached(student_code)
        
        if not student:
            return jsonify({'success': False, 'message': 'رقم الطالب غير موجود'}), 404
        
        # Log the student login for activity tracking
        try:
            # Try with action_type first
            execute_query(
                "INSERT INTO student_login_logs (id, student_id, action_type, logged_in_at) VALUES (%s, %s, 'login', CURRENT_TIMESTAMP)",
                (str(uuid.uuid4()), student['id'])
            )
        except Exception as log_error:
            # If action_type column doesn't exist, try without it
            error_msg = str(log_error).lower()
            if 'action_type' in error_msg or 'column' in error_msg:
                try:
                    execute_query(
                        "INSERT INTO student_login_logs (id, student_id, logged_in_at) VALUES (%s, %s, CURRENT_TIMESTAMP)",
                        (str(uuid.uuid4()), student['id'])
                    )
                except Exception as fallback_error:
                    print(f"[WARNING] Failed to log student login: {fallback_error}")
            else:
                print(f"[WARNING] Failed to log student login: {log_error}")
        
        return jsonify({
            'success': True, 
            'message': 'تم الدخول بنجاح', 
            'student': {
                'id': str(student['id']), 
                'name': student['name'], 
                'code': student['code'], 
                'class': student['class'], 
                'email': student['email']
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'خطأ في تسجيل الدخول: {str(e)}'}), 500

@student_bp.route('/logout', methods=['POST'])
def student_logout():
    """Student logout endpoint - logs the logout activity"""
    data = request.json
    student_id = data.get('studentId')
    
    if not student_id:
        return jsonify({'success': False, 'message': 'معرف الطالب مطلوب'}), 400
    
    try:
        # Log the student logout for activity tracking
        try:
            execute_query(
                "INSERT INTO student_login_logs (id, student_id, action_type, logged_in_at) VALUES (%s, %s, 'logout', CURRENT_TIMESTAMP)",
                (str(uuid.uuid4()), student_id)
            )
        except Exception as log_error:
            # If action_type column doesn't exist, just skip logout logging (can't distinguish from login)
            error_msg = str(log_error).lower()
            if 'action_type' in error_msg or 'column' in error_msg:
                print(f"[INFO] action_type column not found, skipping logout logging (run migration to enable)")
            else:
                print(f"[WARNING] Failed to log student logout: {log_error}")
        
        return jsonify({
            'success': True,
            'message': 'تم تسجيل الخروج بنجاح'
        })
    except Exception as e:
        # Don't fail logout if logging fails
        print(f"[WARNING] Failed to log student logout: {str(e)}")
        return jsonify({
            'success': True,
            'message': 'تم تسجيل الخروج بنجاح'
        })

@student_bp.route('/validate/<student_id>', methods=['GET'])
@verify_student_exists
def validate_student_session(student_id):
    """Validate if a student session is still valid (student exists)"""
    return jsonify({
        'success': True,
        'message': 'الجلسة صالحة',
        'valid': True
    })

@student_bp.route('/<student_id>/skills', methods=['GET'])
@verify_student_exists
def get_student_skills(student_id):
    """Get all skills for a student with caching"""
    try:
        # Use cached query for much faster response
        skills_data = get_student_skills_cached(student_id)

        # Filter hidden skills for student requests; admin sees everything
        try:
            auth_header = request.headers.get('Authorization', '')
            _is_admin = False
            if auth_header.startswith('Bearer '):
                _payload = jwt.decode(auth_header[7:], get_jwt_secret(), algorithms=['HS256'])
                _is_admin = _payload.get('role') == 'admin'
        except Exception:
            _is_admin = False

        if not _is_admin:
            try:
                hidden_rows = execute_query(
                    'SELECT name FROM skill_templates WHERE is_hidden_from_students = TRUE',
                    fetch_all=True
                ) or []
                hidden_names = {r['name'] for r in hidden_rows}
                if hidden_names:
                    skills_data = [s for s in skills_data if s['name'] not in hidden_names]
            except Exception:
                pass  # Column may not exist yet; show all skills

        skills = []
        for row in skills_data:
            # Convert timestamps to proper UTC format with Z suffix
            created_at = row['created_at'].strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z' if row['created_at'] else None
            updated_at = row['updated_at'].strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z' if row['updated_at'] else None
            
            skills.append({
                'id': str(row['id']), 
                'student_id': str(row['student_id']), 
                'name': row['name'], 
                'level': row['level'], 
                'description': row['description'], 
                'category': row['category'], 
                'notes': row['notes'],
                'evidence_url': row['evidence_url'],
                'evidence_count': row['evidence_count'],
                'first_evidence_url': row.get('first_evidence_url'),
                'is_student_ready': row.get('is_student_ready', False) or False,
                'question_count': int(row.get('question_count', 0) or 0),
                'max_test_attempts': int(row.get('max_test_attempts', 3) or 3),
                'attempts_used': int(row.get('attempts_used', 0) or 0),
                'created_at': created_at, 
                'updated_at': updated_at
            })
        
        return jsonify({'success': True, 'skills': skills})
    except Exception as e:
        print(f"[ERROR] get_student_skills: {str(e)}")
        return jsonify({'success': False, 'message': f'خطأ في جلب المهارات: {str(e)}'}), 500

@student_bp.route('/<student_id>/skills/<skill_id>/ready', methods=['PATCH'])
@verify_student_exists
def toggle_skill_ready(student_id, skill_id):
    """Student marks themselves as ready (or not ready) for a skill"""
    data = request.json or {}
    is_ready = bool(data.get('is_ready', False))

    try:
        skill = execute_query(
            'UPDATE skills SET is_student_ready = %s, updated_at = CURRENT_TIMESTAMP '
            'WHERE id = %s AND student_id = %s RETURNING id, is_student_ready',
            (is_ready, skill_id, student_id),
            fetch_one=True
        )

        if not skill:
            return jsonify({'success': False, 'message': 'المهارة غير موجودة'}), 404

        # Invalidate cache so teacher panel reflects the change immediately
        invalidate_cache(f"get_student_skills_cached:('{student_id}',)")

        # Log the event (student-only — admin endpoints never write here)
        try:
            execute_query(
                '''INSERT INTO student_ready_log (student_id, skill_id, skill_name, is_ready)
                   SELECT %s, sk.id, sk.name, %s FROM skills sk WHERE sk.id = %s''',
                (student_id, is_ready, skill_id)
            )
        except Exception as log_err:
            # Non-fatal: log but don't fail the request
            print(f"[WARN] Could not write student_ready_log: {log_err}")

        return jsonify({
            'success': True,
            'message': 'تم تحديث حالة الجاهزية',
            'is_student_ready': skill['is_student_ready']
        })
    except Exception as e:
        print(f"[ERROR] toggle_skill_ready: {str(e)}")
        return jsonify({'success': False, 'message': f'خطأ: {str(e)}'}), 500


@student_bp.route('/skills/<skill_id>/evidence', methods=['GET'])
def get_student_skill_evidence(skill_id):
    """Get evidence/photos for a skill (student read-only view)"""
    try:
        evidence_list = execute_query(
            "SELECT id, skill_id, evidence_url, created_at FROM skill_evidence WHERE skill_id = %s AND (evidence_url NOT LIKE '%%youtube%%' AND evidence_url NOT LIKE '%%youtu.be%%') ORDER BY created_at DESC",
            (skill_id,),
            fetch_all=True
        )
        
        return jsonify({
            'success': True,
            'evidence': [
                {
                    'id': str(ev['id']),
                    'skill_id': str(ev['skill_id']),
                    'evidence_url': ev['evidence_url'],
                    'created_at': ev['created_at'].isoformat() if ev['created_at'] else None
                }
                for ev in evidence_list
            ] if evidence_list else []
        })
    except Exception as e:
        error_msg = str(e)
        print(f"[ERROR] get_student_skill_evidence: {error_msg}")
        
        # Return empty array if table doesn't exist (graceful degradation)
        if 'skill_evidence' in error_msg and ('does not exist' in error_msg or 'not exist' in error_msg):
            return jsonify({'success': True, 'evidence': []})
        
        return jsonify({'success': False, 'message': error_msg}), 500


# ─── Skill Test Routes ────────────────────────────────────────────────────────

@student_bp.route('/<student_id>/skills/<skill_id>/test-info', methods=['GET'])
@verify_student_exists
def get_test_info(student_id, skill_id):
    """Get test questions and attempt info for a student's skill"""
    try:
        skill = execute_query(
            'SELECT name FROM skills WHERE id = %s AND student_id = %s',
            (skill_id, student_id),
            fetch_one=True
        )
        if not skill:
            return jsonify({'success': False, 'message': 'المهارة غير موجودة', 'has_test': False}), 404

        template = execute_query(
            'SELECT id, name, max_test_attempts FROM skill_templates WHERE name = %s',
            (skill['name'],),
            fetch_one=True
        )
        if not template:
            return jsonify({'success': True, 'has_test': False, 'message': 'لا يوجد قالب لهذه المهارة'})

        questions = execute_query(
            'SELECT id, question, order_num FROM skill_test_questions '
            'WHERE template_id = %s ORDER BY order_num ASC, created_at ASC',
            (str(template['id']),),
            fetch_all=True
        )
        if not questions:
            return jsonify({'success': True, 'has_test': False, 'message': 'لا توجد أسئلة لهذا الاختبار'})

        max_attempts = template['max_test_attempts'] or 3
        attempts_row = execute_query(
            'SELECT COUNT(*) as cnt FROM skill_test_attempts WHERE skill_id = %s AND student_id = %s',
            (skill_id, student_id),
            fetch_one=True
        )
        attempts_used = attempts_row['cnt'] if attempts_row else 0
        remaining = max(0, max_attempts - attempts_used)

        return jsonify({
            'success': True,
            'has_test': True,
            'questions': [{'id': str(q['id']), 'question': q['question']} for q in questions],
            'questions_count': len(questions),
            'attempts_used': attempts_used,
            'max_attempts': max_attempts,
            'remaining_attempts': remaining
        })
    except Exception as e:
        print(f"[ERROR] get_test_info: {str(e)}")
        return jsonify({'success': False, 'message': f'خطأ: {str(e)}'}), 500


@student_bp.route('/<student_id>/skills/<skill_id>/test-submit', methods=['POST'])
@verify_student_exists
def submit_test(student_id, skill_id):
    """Submit test answers and record result"""
    data = request.json or {}
    answers = data.get('answers', {})  # {question_id: true/false}

    try:
        skill = execute_query(
            'SELECT name FROM skills WHERE id = %s AND student_id = %s',
            (skill_id, student_id),
            fetch_one=True
        )
        if not skill:
            return jsonify({'success': False, 'message': 'المهارة غير موجودة'}), 404

        template = execute_query(
            'SELECT id, max_test_attempts FROM skill_templates WHERE name = %s',
            (skill['name'],),
            fetch_one=True
        )
        if not template:
            return jsonify({'success': False, 'message': 'لا يوجد اختبار لهذه المهارة'}), 404

        max_attempts = template['max_test_attempts'] or 3
        attempts_row = execute_query(
            'SELECT COUNT(*) as cnt FROM skill_test_attempts WHERE skill_id = %s AND student_id = %s',
            (skill_id, student_id),
            fetch_one=True
        )
        attempts_used = attempts_row['cnt'] if attempts_row else 0

        if attempts_used >= max_attempts:
            return jsonify({
                'success': False,
                'message': 'لقد استنفذت جميع محاولاتك لهذا الاختبار',
                'no_attempts': True
            }), 403

        questions = execute_query(
            'SELECT id, correct_answer FROM skill_test_questions WHERE template_id = %s',
            (str(template['id']),),
            fetch_all=True
        )
        if not questions:
            return jsonify({'success': False, 'message': 'لا توجد أسئلة لهذا الاختبار'}), 404

        # Calculate score: each question is 2 points (10 total for 5 questions)
        q_count = len(questions)
        points_per_q = 10 // q_count if q_count else 2
        correct = sum(
            1 for q in questions
            if str(q['id']) in answers and bool(answers[str(q['id'])]) == bool(q['correct_answer'])
        )
        score = correct * points_per_q
        passed = score >= 6
        attempt_number = attempts_used + 1

        execute_query(
            'INSERT INTO skill_test_attempts (student_id, skill_id, score, passed, attempt_number) '
            'VALUES (%s, %s, %s, %s, %s)',
            (student_id, skill_id, score, passed, attempt_number)
        )

        if passed:
            execute_query(
                'UPDATE skills SET level = 2, updated_at = CURRENT_TIMESTAMP WHERE id = %s',
                (skill_id,)
            )
            invalidate_cache(f"get_student_skills_cached:('{student_id}',)")
            return jsonify({
                'success': True,
                'passed': True,
                'score': score,
                'message': 'مبروك! لقد اجتزت الاختبار بنجاح!'
            })
        else:
            remaining = max_attempts - attempt_number
            invalidate_cache(f"get_student_skills_cached:('{student_id}',)")
            if remaining <= 0:
                return jsonify({
                    'success': True,
                    'passed': False,
                    'score': score,
                    'remaining_attempts': 0,
                    'message': f'لم تجتاز الاختبار. حصلت على {score} من 10. لقد استنفذت جميع محاولاتك.'
                })
            else:
                def _attempts_label(n):
                    if n == 1: return 'محاولة واحدة'
                    if n == 2: return 'محاولتان'
                    return f'{n} محاولات'
                return jsonify({
                    'success': True,
                    'passed': False,
                    'score': score,
                    'remaining_attempts': remaining,
                    'message': f'لم تجتاز الاختبار، حاول مرة أخرى. لديك {_attempts_label(remaining)} متبقية'
                })
    except Exception as e:
        print(f"[ERROR] submit_test: {str(e)}")
        return jsonify({'success': False, 'message': f'خطأ: {str(e)}'}), 500


# ─── Announcements Route ──────────────────────────────────────────────────────

@student_bp.route('/<student_id>/announcements', methods=['GET'])
@verify_student_exists
def get_student_announcements(student_id):
    """Get announcements visible to this student (target_all or specifically targeted)"""
    try:
        rows = execute_query(
            """
            SELECT DISTINCT a.id, a.title, a.description, a.type, a.created_at
            FROM announcements a
            LEFT JOIN announcement_students ans ON ans.announcement_id = a.id
            WHERE a.target_all = TRUE
               OR ans.student_id = %s
            ORDER BY a.created_at DESC
            """,
            (student_id,),
            fetch_all=True
        ) or []

        announcements = []
        for r in rows:
            announcements.append({
                'id': str(r['id']),
                'title': r['title'],
                'description': r['description'] or '',
                'type': r['type'],
                'created_at': r['created_at'].strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z' if r['created_at'] else None,
            })

        return jsonify({'success': True, 'announcements': announcements})
    except Exception as e:
        # Gracefully handle missing table (migration not run yet)
        if 'announcements' in str(e).lower() and ('does not exist' in str(e).lower() or 'not exist' in str(e).lower()):
            return jsonify({'success': True, 'announcements': []})
        return jsonify({'success': False, 'message': str(e)}), 500


# ─── Badges Route ─────────────────────────────────────────────────────────────

@student_bp.route('/<student_id>/badges', methods=['GET'])
@verify_student_exists
def get_student_badges(student_id):
    """Return all badges with earned=true/false evaluated against the student's data"""
    try:
        # Auto-create table if migration hasn't run yet
        try:
            execute_query("""
                CREATE TABLE IF NOT EXISTS badges (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name VARCHAR(255) NOT NULL,
                    icon VARCHAR(20) NOT NULL DEFAULT '🏅',
                    description TEXT,
                    criteria_type VARCHAR(50) NOT NULL DEFAULT 'skills_completed',
                    criteria_value INTEGER NOT NULL DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
        except Exception:
            pass

        badges = execute_query(
            'SELECT id, name, icon, description, criteria_type, criteria_value '
            'FROM badges ORDER BY created_at ASC',
            fetch_all=True
        ) or []

        if not badges:
            return jsonify({'success': True, 'badges': []})

        # Gather student stats needed for all criteria types in one pass
        stats = execute_query(
            """
            SELECT
                COUNT(*) FILTER (WHERE level >= 2) AS skills_completed,
                COUNT(*) FILTER (WHERE level = 3)  AS level3_skills,
                COUNT(*)                            AS total_skills
            FROM skills WHERE student_id = %s
            """,
            (student_id,),
            fetch_one=True
        )
        tests_row = execute_query(
            'SELECT COUNT(*) AS cnt FROM skill_test_attempts WHERE student_id = %s AND passed = TRUE',
            (student_id,),
            fetch_one=True
        )
        tests_attempted_row = execute_query(
            'SELECT COUNT(*) AS cnt FROM skill_test_attempts WHERE student_id = %s',
            (student_id,),
            fetch_one=True
        )
        perfect_row = execute_query(
            'SELECT COUNT(*) AS cnt FROM skill_test_attempts WHERE student_id = %s AND score >= 10',
            (student_id,),
            fetch_one=True
        )
        ready_row = execute_query(
            'SELECT COUNT(*) AS cnt FROM student_ready_log WHERE student_id = %s AND is_ready = TRUE',
            (student_id,),
            fetch_one=True
        )
        login_row = execute_query(
            'SELECT COUNT(*) AS cnt FROM student_login_logs WHERE student_id = %s AND action_type = %s',
            (student_id, 'login'),
            fetch_one=True
        )

        completed       = int(stats['skills_completed'])    if stats else 0
        level3          = int(stats['level3_skills'])        if stats else 0
        passed_tests    = int(tests_row['cnt'])              if tests_row else 0
        tests_attempted = int(tests_attempted_row['cnt'])    if tests_attempted_row else 0
        perfect_tests   = int(perfect_row['cnt'])            if perfect_row else 0
        ready_count     = int(ready_row['cnt'])              if ready_row else 0
        login_count     = int(login_row['cnt'])              if login_row else 0
        total           = int(stats['total_skills'])         if stats else 0
        completion_pct  = round(completed / total * 100)     if total > 0 else 0

        result = []
        for b in badges:
            ctype = b['criteria_type']
            cval  = int(b['criteria_value'])
            if ctype == 'skills_completed':
                earned = completed >= cval
            elif ctype == 'completion_percent':
                earned = completion_pct >= cval
            elif ctype == 'tests_passed':
                earned = passed_tests >= cval
            elif ctype == 'level3_skills':
                earned = level3 >= cval
            elif ctype == 'tests_attempted':
                earned = tests_attempted >= cval
            elif ctype == 'perfect_tests':
                earned = perfect_tests >= cval
            elif ctype == 'ready_actions':
                earned = ready_count >= cval
            elif ctype == 'login_count':
                earned = login_count >= cval
            else:
                earned = False

            result.append({
                'id':             str(b['id']),
                'name':           b['name'],
                'icon':           b['icon'],
                'description':    b['description'] or '',
                'criteria_type':  b['criteria_type'],
                'criteria_value': int(b['criteria_value']),
                'earned':         earned,
            })

        return jsonify({'success': True, 'badges': result})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
