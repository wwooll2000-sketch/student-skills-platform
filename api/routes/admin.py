# Admin Routes — login, statistics, students-with-skills, cache
# Student CRUD      → admin_students.py
# Skills CRUD       → admin_skills.py
# Evidence          → admin_evidence.py
# Teacher settings  → admin_teacher.py
# Activity feed     → admin_activities.py
from flask import Blueprint, request, jsonify
import jwt
from datetime import datetime
import sys
import os

# Add parent directory to path for imports
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

try:
    from auth import verify_admin, get_jwt_secret, get_admin_password, get_teacher_name, get_teacher_id
    from database import execute_query, invalidate_cache
except ImportError:
    from api.auth import verify_admin, get_jwt_secret, get_admin_password, get_teacher_name, get_teacher_id
    from api.database import execute_query, invalidate_cache

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
        
        completion_rate = round(completed_skills / total_skills * 100) if total_skills > 0 else 0

        # Students who have at least one skill and all skills completed
        completed_students = 0
        try:
            cs_row = execute_query('''
                SELECT COUNT(DISTINCT s.id) AS count
                FROM students s
                WHERE EXISTS (
                    SELECT 1 FROM skills sk WHERE sk.student_id = s.id
                )
                AND NOT EXISTS (
                    SELECT 1 FROM skills sk WHERE sk.student_id = s.id AND sk.level NOT IN (2, 3)
                )
            ''', fetch_one=True)
            completed_students = cs_row['count'] if cs_row else 0
        except Exception:
            pass

        # Test attempt statistics
        total_tests = 0
        test_pass_rate = 0
        try:
            test_row = execute_query('''
                SELECT
                    COUNT(*) AS total,
                    COUNT(CASE WHEN passed THEN 1 END) AS passed
                FROM skill_test_attempts
            ''', fetch_one=True)
            if test_row:
                total_tests = test_row['total'] or 0
                passed_tests = test_row['passed'] or 0
                test_pass_rate = round(passed_tests / total_tests * 100) if total_tests > 0 else 0
        except Exception:
            pass

        return jsonify({
            'success': True,
            'statistics': {
                'totalStudents': total_students,
                'totalSkills': total_skills,
                'completedSkills': completed_skills,
                'completionRate': completion_rate,
                'completedStudents': completed_students,
                'totalTests': total_tests,
                'testPassRate': test_pass_rate,
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

