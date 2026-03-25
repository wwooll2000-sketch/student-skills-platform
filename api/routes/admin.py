# Admin Routes
from flask import Blueprint, request, jsonify
import jwt
from datetime import datetime
import uuid
import sys
import os

# Add parent directory to path for imports
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

try:
    from auth import verify_admin, get_jwt_secret, get_admin_password, get_teacher_name, get_teacher_id
    from database import get_db, execute_query, execute_batch, invalidate_cache, get_all_students_cached, batch_insert_students, batch_insert_skills
except ImportError:
    # Fallback for different import contexts
    from api.auth import verify_admin, get_jwt_secret, get_admin_password, get_teacher_name, get_teacher_id
    from api.database import get_db, execute_query, execute_batch, invalidate_cache, get_all_students_cached, batch_insert_students, batch_insert_skills

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')

@admin_bp.route('/login', methods=['POST'])
def admin_login():
    """Admin login endpoint"""
    data = request.json
    password = data.get('password')
    
    if password != get_admin_password():
        return jsonify({'success': False, 'message':' كلمة المرور غير صحيحة'}), 401
    
    teacher_name = get_teacher_name()
    teacher_id = get_teacher_id()
    
    token = jwt.encode(
        {
            'role': 'admin',
            'adminId': teacher_id,
            'loginTime': datetime.now().isoformat()
        },
        get_jwt_secret(),
        algorithm='HS256'
    )
    
    # Ensure token is a string (PyJWT 2.x returns string, but just to be safe)
    if isinstance(token, bytes):
        token = token.decode('utf-8')
    
    return jsonify({
        'success': True,
        'message': 'تم تسجيل الدخول بنجاح',
        'token': token,
        'user': {'role': 'admin', 'name': teacher_name}
    })

@admin_bp.route('/students', methods=['GET'])
@verify_admin
def get_students():
    """Get all students with caching"""
    try:
        # Use cached query for much faster response
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

@admin_bp.route('/students', methods=['POST'])
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
        # Check if student exists
        existing = execute_query('SELECT id FROM students WHERE code = %s', (code,), fetch_one=True)
        if existing:
            return jsonify({'success': False, 'message': 'رقم الطالب موجود بالفعل'}), 400
        
        # Insert new student
        student_id = str(uuid.uuid4())
        student = execute_query(
            'INSERT INTO students (id, name, code, email, class, created_at, updated_at) '
            'VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *',
            (student_id, name, code, email, student_class),
            fetch_one=True
        )
        
        # Invalidate cache
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

@admin_bp.route('/students/<student_id>', methods=['DELETE'])
@verify_admin
def delete_student(student_id):
    """Delete a student and all related data"""
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                # First verify student exists
                cur.execute('SELECT code, name FROM students WHERE id = %s', (student_id,))
                student = cur.fetchone()
                
                if not student:
                    return jsonify({'success': False, 'message': 'الطالب غير موجود'}), 404
                
                student_code = student['code']
                student_name = student['name']
                
                # Get all skill names for this student BEFORE deleting
                cur.execute('SELECT DISTINCT name FROM skills WHERE student_id = %s', (student_id,))
                skill_names = [row['name'] for row in cur.fetchall()]
                
                # Delete all student's skills (this will cascade to skill_evidence due to ON DELETE CASCADE)
                cur.execute('DELETE FROM skills WHERE student_id = %s', (student_id,))
                skills_deleted = cur.rowcount
                
                # Delete the student
                cur.execute('DELETE FROM students WHERE id = %s', (student_id,))
                
                # Update usage counts for all affected skill templates
                for skill_name in skill_names:
                    cur.execute(
                        '''UPDATE skill_templates 
                           SET usage_count = (SELECT COUNT(DISTINCT student_id) FROM skills WHERE name = %s AND student_id IS NOT NULL),
                               updated_at = CURRENT_TIMESTAMP
                           WHERE name = %s''',
                        (skill_name, skill_name)
                    )
                
                conn.commit()
        
        # Invalidate ALL caches to ensure no stale data
        invalidate_cache()  # Clear entire cache
        
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

@admin_bp.route('/students/delete-all', methods=['DELETE'])
@verify_admin
def delete_all_students():
    """Delete all students - much faster than individual deletes"""
    try:
        with get_db() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                # Get count before deleting
                cur.execute('SELECT COUNT(*) as count FROM students')
                count_result = cur.fetchone()
                student_count = count_result['count'] if count_result else 0
                
                if student_count == 0:
                    return jsonify({'success': True, 'message': 'لا يوجد طلاب لحذفهم', 'count': 0})
                
                # Get all skill names before deleting for usage count updates
                cur.execute('SELECT DISTINCT name FROM skills')
                skill_names = [row['name'] for row in cur.fetchall()]
                
                # Delete all students (CASCADE will delete skills and skill_evidence)
                cur.execute('DELETE FROM students')
                
                # Update usage counts for all affected skill templates
                for skill_name in skill_names:
                    cur.execute(
                        '''UPDATE skill_templates 
                           SET usage_count = 0,
                               updated_at = CURRENT_TIMESTAMP
                           WHERE name = %s''',
                        (skill_name,)
                    )
                
                conn.commit()
        
        # Invalidate ALL caches
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

@admin_bp.route('/students/<student_id>', methods=['PUT'])
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
                # Check if code is being changed and if it already exists
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

@admin_bp.route('/students/<student_id>/skills', methods=['POST'])
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
        
        # Cache key format is: get_student_skills_cached:('uuid',):{}
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

@admin_bp.route('/skills/<skill_id>', methods=['PUT'])
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
        # Cache key format is: get_student_skills_cached:('uuid',):{}
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

@admin_bp.route('/skills/<skill_id>', methods=['DELETE'])
@verify_admin
def delete_skill(skill_id):
    """Delete a skill"""
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                # Get the skill name and student_id BEFORE deleting
                cur.execute('SELECT name, student_id FROM skills WHERE id = %s', (skill_id,))
                skill_data = cur.fetchone()
                
                if not skill_data:
                    return jsonify({'success': False, 'message': 'المهارة غير موجودة'}), 404
                
                skill_name = skill_data['name']
                student_id = skill_data['student_id']
                
                # Delete the skill
                cur.execute('DELETE FROM skills WHERE id = %s RETURNING *', (skill_id,))
                skill = cur.fetchone()
                
                # Update usage count for the skill template
                cur.execute(
                    '''UPDATE skill_templates 
                       SET usage_count = (SELECT COUNT(DISTINCT student_id) FROM skills WHERE name = %s AND student_id IS NOT NULL),
                           updated_at = CURRENT_TIMESTAMP
                       WHERE name = %s''',
                    (skill_name, skill_name)
                )
                
                conn.commit()
        
        # Cache key format is: get_student_skills_cached:('uuid',):{}
        invalidate_cache(f"get_student_skills_cached:('{student_id}',)")
        return jsonify({'success': True, 'message': 'تم حذف المهارة بنجاح'})
    except Exception as e:
        print(f"[ERROR] delete_skill: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@admin_bp.route('/students/<student_id>/skills', methods=['DELETE'])
@verify_admin
def delete_all_student_skills(student_id):
    """Delete all skills for a specific student"""
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                # Get all skill names for this student before deleting
                cur.execute('SELECT DISTINCT name FROM skills WHERE student_id = %s', (student_id,))
                skill_names = [row['name'] for row in cur.fetchall()]
                
                # Delete all skills for this student
                cur.execute('DELETE FROM skills WHERE student_id = %s RETURNING id', (student_id,))
                deleted_skills = cur.fetchall()
                deleted_count = len(deleted_skills)
                
                # Update usage counts for all affected skill templates
                for skill_name in skill_names:
                    cur.execute(
                        '''UPDATE skill_templates 
                           SET usage_count = (SELECT COUNT(DISTINCT student_id) FROM skills WHERE name = %s AND student_id IS NOT NULL),
                               updated_at = CURRENT_TIMESTAMP
                           WHERE name = %s''',
                        (skill_name, skill_name)
                    )
                
                conn.commit()
        
        # Invalidate cache for this student
        invalidate_cache(f"get_student_skills_cached:('{student_id}',)")
        
        return jsonify({
            'success': True, 
            'message': f'تم حذف {deleted_count} مهارة بنجاح',
            'deleted_count': deleted_count
        })
    except Exception as e:
        print(f"[ERROR] delete_all_student_skills: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@admin_bp.route('/recent-activities', methods=['GET'])
@verify_admin
def get_recent_activities():
    """Get recent activities (completed skills and student logins) from all students"""
    try:
        # Get recent completed skills (level 2 or 3) joined with student info
        skill_results = execute_query('''
            SELECT 
                s.name as student_name,
                s.code as student_code,
                sk.name as skill_name,
                sk.updated_at AT TIME ZONE 'UTC' as activity_date,
                'completed' as activity_type
            FROM skills sk
            JOIN students s ON sk.student_id = s.id
            WHERE sk.level IN (2, 3)
            ORDER BY sk.updated_at DESC
            LIMIT 30
        ''', fetch_all=True) or []
        
        # Get recent student logins - try with action_type first, fallback if column doesn't exist
        login_results = []
        try:
            login_results = execute_query('''
                SELECT 
                    s.name as student_name,
                    s.code as student_code,
                    l.logged_in_at AT TIME ZONE 'UTC' as activity_date,
                    l.action_type as activity_type
                FROM student_login_logs l
                JOIN students s ON l.student_id = s.id
                ORDER BY l.logged_in_at DESC
                LIMIT 30
            ''', fetch_all=True) or []
        except Exception as login_error:
            # If table doesn't exist or action_type column missing, try simpler query or skip
            error_msg = str(login_error).lower()
            if 'does not exist' in error_msg or 'student_login_logs' in error_msg:
                # Table doesn't exist yet - skip login logs
                print(f"[INFO] student_login_logs table not found, skipping login activities")
                login_results = []
            elif 'action_type' in error_msg or 'column' in error_msg:
                # Column doesn't exist - use old query without action_type
                print(f"[INFO] action_type column not found, using default 'login' type")
                try:
                    login_results = execute_query('''
                        SELECT 
                            s.name as student_name,
                            s.code as student_code,
                            l.logged_in_at AT TIME ZONE 'UTC' as activity_date,
                            'login' as activity_type
                        FROM student_login_logs l
                        JOIN students s ON l.student_id = s.id
                        ORDER BY l.logged_in_at DESC
                        LIMIT 30
                    ''', fetch_all=True) or []
                except:
                    login_results = []
            else:
                print(f"[WARNING] Unexpected error fetching login logs: {login_error}")
                login_results = []
        
        # Get recent student-initiated ready/unready events
        ready_results = []
        try:
            ready_results = execute_query('''
                SELECT
                    s.name as student_name,
                    s.code as student_code,
                    rl.skill_name,
                    rl.is_ready,
                    rl.logged_at AT TIME ZONE 'UTC' as activity_date
                FROM student_ready_log rl
                JOIN students s ON rl.student_id = s.id
                ORDER BY rl.logged_at DESC
                LIMIT 30
            ''', fetch_all=True) or []
        except Exception as ready_err:
            if 'student_ready_log' in str(ready_err).lower() or 'does not exist' in str(ready_err).lower():
                print('[INFO] student_ready_log table not found, skipping ready activities')
            else:
                print(f'[WARNING] Unexpected error fetching ready log: {ready_err}')

        # Combine and sort all activities
        all_activities = []

        for row in ready_results:
            activity_date = row['activity_date']
            date_str = activity_date.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z' if activity_date else None
            all_activities.append({
                'studentName': row['student_name'],
                'studentCode': row['student_code'],
                'skillName': row['skill_name'],
                'date': date_str,
                'type': 'ready' if row['is_ready'] else 'unready'
            })

        for row in skill_results:
            activity_date = row['activity_date']
            date_str = activity_date.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z' if activity_date else None
            all_activities.append({
                'studentName': row['student_name'],
                'studentCode': row['student_code'],
                'skillName': row.get('skill_name'),
                'date': date_str,
                'type': 'completed'
            })
        
        for row in login_results:
            activity_date = row['activity_date']
            date_str = activity_date.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z' if activity_date else None
            all_activities.append({
                'studentName': row['student_name'],
                'studentCode': row['student_code'],
                'date': date_str,
                'type': row.get('activity_type', 'login')  # Use action_type from DB (login or logout)
            })
        
        # Sort by date descending and limit to 50
        all_activities.sort(key=lambda x: x['date'] if x['date'] else '', reverse=True)
        all_activities = all_activities[:50]
        
        return jsonify({'success': True, 'activities': all_activities})
    except Exception as e:
        print(f"[ERROR] get_recent_activities: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@admin_bp.route('/statistics', methods=['GET'])
@verify_admin
def get_statistics():
    """Get dashboard statistics in one query"""
    try:
        # Get total students count
        total_students = execute_query('SELECT COUNT(*) as count FROM students', fetch_one=True)['count']
        
        # Get skills statistics
        stats = execute_query('''
            SELECT 
                COUNT(*) as total_skills,
                COUNT(CASE WHEN level IN (2, 3) THEN 1 END) as completed_skills
            FROM skills
        ''', fetch_one=True)
        
        total_skills = stats['total_skills'] if stats['total_skills'] else 0
        completed_skills = stats['completed_skills'] if stats['completed_skills'] else 0
        
        completion_rate = round((completed_skills / total_skills * 100), 1) if total_skills > 0 else 0
        
        return jsonify({
            'success': True,
            'statistics': {
                'totalStudents': total_students,
                'totalSkills': total_skills,
                'completedSkills': completed_skills,
                'completionRate': completion_rate
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@admin_bp.route('/students-with-skills', methods=['GET'])
@verify_admin
def get_students_with_skills():
    """Get all students with their skills in optimized queries"""
    try:
        # Get all students
        students_rows = execute_query('SELECT id, name, code, email, class FROM students ORDER BY name ASC', fetch_all=True) or []
        
        # Get all skills for all students in one query with UTC timestamps
        skills_rows = execute_query('''
            SELECT 
                sk.id, sk.student_id, sk.name, sk.level, 
                sk.description, sk.category, sk.notes, sk.evidence_url,
                sk.created_at AT TIME ZONE 'UTC' as created_at, 
                sk.updated_at AT TIME ZONE 'UTC' as updated_at,
                (SELECT COUNT(*) FROM skill_evidence se WHERE se.skill_id = sk.id AND (se.evidence_url NOT LIKE '%%youtube%%' AND se.evidence_url NOT LIKE '%%youtu.be%%')) as evidence_count
            FROM skills sk
            ORDER BY sk.student_id, sk.updated_at DESC
        ''', fetch_all=True) or []
        
        # Group skills by student_id
        skills_by_student = {}
        for skill_row in skills_rows:
            student_id = skill_row['student_id']
            if student_id not in skills_by_student:
                skills_by_student[student_id] = []
            
            # Convert timestamps to proper UTC format with Z suffix
            created_at = skill_row['created_at'].strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z' if skill_row['created_at'] else None
            updated_at = skill_row['updated_at'].strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z' if skill_row['updated_at'] else None
            
            skills_by_student[student_id].append({
                'id': str(skill_row['id']),
                'name': skill_row['name'],
                'level': skill_row['level'],
                'description': skill_row['description'],
                'category': skill_row['category'],
                'notes': skill_row['notes'],
                'evidence_url': skill_row['evidence_url'],
                'evidence_count': skill_row['evidence_count'],
                'created_at': created_at,
                'updated_at': updated_at
            })
        
        # Build students with their skills
        students = []
        for student_row in students_rows:
            student_id = student_row['id']
            students.append({
                'id': str(student_id),
                'name': student_row['name'],
                'code': student_row['code'],
                'email': student_row['email'],
                'class': student_row['class'],
                'skills': skills_by_student.get(student_id, [])
            })
        
        return jsonify({'success': True, 'students': students})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@admin_bp.route('/teacher/profile', methods=['GET'])
@verify_admin
def get_teacher_profile():
    """Get teacher profile"""
    try:
        teacher = execute_query('SELECT id, name, created_at FROM teacher LIMIT 1', fetch_one=True)
        
        if not teacher:
            return jsonify({'success': False, 'message': 'المعلم غير موجود'}), 404
        
        return jsonify({
            'success': True,
            'teacher': {
                'id': str(teacher['id']),
                'name': teacher['name'],
                'created_at': teacher['created_at'].isoformat() if teacher['created_at'] else None
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@admin_bp.route('/teacher/column-visibility', methods=['PUT'])
@verify_admin
def update_column_visibility():
    """Update which columns are visible in the student view"""
    data = request.json
    column_visibility = data.get('column_visibility', {})

    # Validate: only allow known column keys
    allowed_keys = {'الرابط', 'جاهز', 'الشواهد', 'الحالة'}
    column_visibility = {k: bool(v) for k, v in column_visibility.items() if k in allowed_keys}

    try:
        import json
        execute_query(
            'UPDATE teacher SET column_visibility = %s WHERE id = (SELECT id FROM teacher LIMIT 1)',
            (json.dumps(column_visibility),)
        )
        invalidate_cache('teacher')
        return jsonify({'success': True, 'message': 'تم تحديث إعدادات الأعمدة'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_bp.route('/teacher/update-name', methods=['PUT'])
@verify_admin
def update_teacher_name():
    """Update teacher name"""
    data = request.json
    new_name = data.get('name', '').strip()
    
    if not new_name:
        return jsonify({'success': False, 'message': 'يرجى إدخال الاسم'}), 400
    
    if len(new_name) < 2:
        return jsonify({'success': False, 'message': 'الاسم قصير جداً'}), 400
    
    try:
        teacher = execute_query(
            'UPDATE teacher SET name = %s, updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT id FROM teacher LIMIT 1) RETURNING *',
            (new_name,),
            fetch_one=True
        )
        
        if not teacher:
            return jsonify({'success': False, 'message': 'المعلم غير موجود'}), 404
        
        return jsonify({
            'success': True,
            'message': 'تم تحديث الاسم بنجاح',
            'teacher': {'id': str(teacher['id']), 'name': teacher['name']}
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@admin_bp.route('/teacher/update-password', methods=['PUT'])
@verify_admin
def update_teacher_password():
    """Update teacher password"""
    data = request.json
    current_password = data.get('currentPassword', '')
    new_password = data.get('newPassword', '')
    
    if not current_password or not new_password:
        return jsonify({'success': False, 'message': 'يرجى إدخال كلمة المرور الحالية والجديدة'}), 400
    
    if len(new_password) < 4:
        return jsonify({'success': False, 'message': 'كلمة المرور الجديدة قصيرة جداً (4 أحرف على الأقل)'}), 400
    
    # Verify current password
    if current_password != get_admin_password():
        return jsonify({'success': False, 'message': 'كلمة المرور الحالية غير صحيحة'}), 401
    
    try:
        execute_query(
            'UPDATE teacher SET password = %s, updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT id FROM teacher LIMIT 1) RETURNING *',
            (new_password,),
            fetch_one=True
        )
        
        return jsonify({
            'success': True,
            'message': 'تم تحديث كلمة المرور بنجاح'
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'خطأ في تحديث كلمة المرور: {str(e)}'}), 500

# Optimized batch operation endpoints for much faster bulk operations

@admin_bp.route('/students/batch', methods=['POST'])
@verify_admin
def batch_add_students():
    """Batch add multiple students efficiently - much faster than individual adds"""
    data = request.json
    students = data.get('students', [])
    
    if not students or not isinstance(students, list):
        return jsonify({'success': False, 'message': 'يجب إرسال قائمة الطلاب'}), 400
    
    try:
        created_students = batch_insert_students(students)
        if created_students is not None:
            # Invalidate entire cache to ensure fresh data
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

@admin_bp.route('/skills/batch', methods=['POST'])
@verify_admin
def batch_add_skills():
    """Batch add multiple skills efficiently - much faster than individual adds"""
    data = request.json
    skills = data.get('skills', [])
    
    if not skills or not isinstance(skills, list):
        return jsonify({'success': False, 'message': 'يجب إرسال قائمة المهارات'}), 400
    
    try:
        success = batch_insert_skills(skills)
        if success:
            # Invalidate entire cache to ensure fresh data
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

@admin_bp.route('/skills/students-by-skill', methods=['GET'])
@verify_admin
def get_all_students_by_skill():
    """Get all students who have a skill by name, split into ready/not_ready, each with skill_id"""
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


@admin_bp.route('/skills/ready-students', methods=['GET'])
@verify_admin
def get_ready_students_for_skill():
    """Get all students who marked themselves ready for a specific skill (by name)"""
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


@admin_bp.route('/skills/batch-ready', methods=['PATCH'])
@verify_admin
def admin_batch_toggle_skill_ready():
    """Admin batch-updates is_student_ready for multiple skill IDs in one query"""
    data = request.json or {}
    skill_ids = data.get('skill_ids', [])
    is_ready = bool(data.get('is_ready', False))

    if not skill_ids or not isinstance(skill_ids, list):
        return jsonify({'success': False, 'message': 'skill_ids مطلوب'}), 400

    try:
        import uuid
        skill_uuids = [uuid.UUID(sid) for sid in skill_ids]

        rows = execute_query(
            'UPDATE skills SET is_student_ready = %s, updated_at = CURRENT_TIMESTAMP '
            'WHERE id = ANY(%s) RETURNING id, student_id',
            (is_ready, skill_uuids),
            fetch_all=True
        )

        # Invalidate each affected student's cache
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


@admin_bp.route('/skills/<skill_id>/ready', methods=['PATCH'])
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


@admin_bp.route('/cache/clear', methods=['POST'])
@verify_admin
def clear_cache():
    """Clear all cached queries - use after bulk operations"""
    try:
        invalidate_cache()
        return jsonify({
            'success': True,
            'message': 'تم مسح ذاكرة التخزين المؤقت بنجاح'
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'خطأ في مسح الذاكرة: {str(e)}'}), 500

# Evidence Management Endpoints

@admin_bp.route('/skills/<skill_id>/evidence', methods=['GET'])
@verify_admin
def get_skill_evidence(skill_id):
    """Get all evidence/photos for a skill"""
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
        print(f"[ERROR] get_skill_evidence: {error_msg}")
        
        # Check if it's a table doesn't exist error
        if 'skill_evidence' in error_msg and ('does not exist' in error_msg or 'not exist' in error_msg):
            return jsonify({
                'success': False, 
                'message': 'يرجى تشغيل ملف الترحيل run_migration.py لإنشاء جدول الشواهد',
                'error': 'skill_evidence table does not exist'
            }), 500
        
        return jsonify({'success': False, 'message': error_msg}), 500

@admin_bp.route('/skills/<skill_id>/evidence', methods=['POST'])
@verify_admin
def add_skill_evidence(skill_id):
    """Add evidence/photo to a skill"""
    data = request.json
    evidence_url = data.get('evidence_url')
    
    if not evidence_url:
        return jsonify({'success': False, 'message': 'يرجى إرفاق صورة'}), 400
    
    try:
        evidence_id = str(uuid.uuid4())
        evidence = execute_query(
            'INSERT INTO skill_evidence (id, skill_id, evidence_url, created_at) '
            'VALUES (%s, %s, %s, CURRENT_TIMESTAMP) RETURNING *',
            (evidence_id, skill_id, evidence_url),
            fetch_one=True
        )
        
        # Get student_id for cache invalidation
        skill = execute_query('SELECT student_id FROM skills WHERE id = %s', (skill_id,), fetch_one=True)
        if skill:
            invalidate_cache(f"get_student_skills_cached:('{skill['student_id']}',)")
        
        return jsonify({
            'success': True,
            'message': 'تم إضافة الشاهد بنجاح',
            'evidence': {
                'id': str(evidence['id']),
                'skill_id': str(evidence['skill_id']),
                'evidence_url': evidence['evidence_url'],
                'created_at': evidence['created_at'].isoformat() if evidence['created_at'] else None
            }
        }), 201
    except Exception as e:
        error_msg = str(e)
        print(f"[ERROR] add_skill_evidence: {error_msg}")
        
        # Check if it's a table doesn't exist error
        if 'skill_evidence' in error_msg and ('does not exist' in error_msg or 'not exist' in error_msg):
            return jsonify({
                'success': False, 
                'message': 'يرجى تشغيل ملف الترحيل run_migration.py لإنشاء جدول الشواهد',
                'error': 'skill_evidence table does not exist',
                'help': 'Run: python run_migration.py'
            }), 500
        
        return jsonify({'success': False, 'message': error_msg}), 500

@admin_bp.route('/skills/<skill_id>/evidence', methods=['DELETE'])
@verify_admin
def delete_all_skill_evidence(skill_id):
    """Delete all evidence/photos for a skill - much faster than individual deletes"""
    try:
        # Get student_id before deletion for cache invalidation
        skill = execute_query('SELECT student_id FROM skills WHERE id = %s', (skill_id,), fetch_one=True)
        
        if not skill:
            return jsonify({'success': False, 'message': 'المهارة غير موجودة'}), 404
        
        # Delete all evidence for this skill
        result = execute_query(
            'DELETE FROM skill_evidence WHERE skill_id = %s RETURNING id',
            (skill_id,),
            fetch_all=True
        )
        
        deleted_count = len(result) if result else 0
        
        # Invalidate cache
        invalidate_cache(f"get_student_skills_cached:('{skill['student_id']}',)")
        
        return jsonify({
            'success': True,
            'message': f'تم حذف {deleted_count} شاهد بنجاح',
            'count': deleted_count
        })
    except Exception as e:
        print(f"[ERROR] delete_all_skill_evidence: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@admin_bp.route('/evidence/<evidence_id>', methods=['DELETE'])
@verify_admin
def delete_evidence(evidence_id):
    """Delete a specific evidence/photo"""
    try:
        # Get skill_id and student_id before deletion for cache invalidation
        evidence = execute_query('SELECT skill_id FROM skill_evidence WHERE id = %s', (evidence_id,), fetch_one=True)
        
        if not evidence:
            return jsonify({'success': False, 'message': 'الشاهد غير موجود'}), 404
        
        skill = execute_query('SELECT student_id FROM skills WHERE id = %s', (evidence['skill_id'],), fetch_one=True)
        
        # Delete the evidence
        execute_query('DELETE FROM skill_evidence WHERE id = %s', (evidence_id,))
        
        # Invalidate cache
        if skill:
            invalidate_cache(f"get_student_skills_cached:('{skill['student_id']}',)")
        
        return jsonify({
            'success': True,
            'message': 'تم حذف الشاهد بنجاح'
        })
    except Exception as e:
        print(f"[ERROR] delete_evidence: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@admin_bp.route('/evidence/<evidence_id>', methods=['PUT'])
@verify_admin
def update_evidence(evidence_id):
    """Update/replace a specific evidence/photo"""
    data = request.json
    new_evidence_url = data.get('evidence_url')
    
    if not new_evidence_url:
        return jsonify({'success': False, 'message': 'يرجى إرفاق صورة'}), 400
    
    try:
        # Get skill_id and student_id for cache invalidation
        evidence = execute_query('SELECT skill_id FROM skill_evidence WHERE id = %s', (evidence_id,), fetch_one=True)
        
        if not evidence:
            return jsonify({'success': False, 'message': 'الشاهد غير موجود'}), 404
        
        skill = execute_query('SELECT student_id FROM skills WHERE id = %s', (evidence['skill_id'],), fetch_one=True)
        
        # Update the evidence
        updated_evidence = execute_query(
            'UPDATE skill_evidence SET evidence_url = %s WHERE id = %s RETURNING *',
            (new_evidence_url, evidence_id),
            fetch_one=True
        )
        
        # Invalidate cache
        if skill:
            invalidate_cache(f"get_student_skills_cached:('{skill['student_id']}',)")
        
        return jsonify({
            'success': True,
            'message': 'تم تحديث الشاهد بنجاح',
            'evidence': {
                'id': str(updated_evidence['id']),
                'skill_id': str(updated_evidence['skill_id']),
                'evidence_url': updated_evidence['evidence_url'],
                'created_at': updated_evidence['created_at'].isoformat() if updated_evidence['created_at'] else None
            }
        })
    except Exception as e:
        print(f"[ERROR] update_evidence: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

