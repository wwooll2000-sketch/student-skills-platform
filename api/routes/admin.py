# Admin Routes
from flask import Blueprint, request, jsonify
import jwt
from datetime import datetime
import uuid
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from auth import verify_admin, get_jwt_secret, get_admin_password
from database import get_db, return_db

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')

@admin_bp.route('/login', methods=['POST'])
def admin_login():
    """Admin login endpoint"""
    data = request.json
    password = data.get('password')
    
    if password != get_admin_password():
        return jsonify({'success': False, 'message':' كلمة المرور غير صحيحة'}), 401
    
    token = jwt.encode(
        {
            'role': 'admin',
            'adminId': 'admin-console',
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
        'user': {'role': 'admin', 'name': 'المعلم'}
    })

@admin_bp.route('/students', methods=['GET'])
@verify_admin
def get_students():
    """Get all students"""
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute('SELECT * FROM students ORDER BY name ASC')
        students = []
        for row in cur.fetchall():
            students.append({
                'id': row[0], 
                'name': row[1], 
                'code': row[2], 
                'email': row[3], 
                'class': row[4], 
                'created_at': row[5].isoformat() if row[5] else None, 
                'updated_at': row[6].isoformat() if row[6] else None
            })
        cur.close()
        return jsonify({'success': True, 'students': students})
    finally:
        return_db(conn)

@admin_bp.route('/students', methods=['POST'])
@verify_admin
def add_student():
    """Add a new student"""
    data = request.json
    name = data.get('name')
    code = data.get('code')
    email = data.get('email')
    student_class = data.get('class')
    
    if not name or not code:
        return jsonify({'success': False, 'message': 'البيانات غير صحيحة'}), 400
    
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute('SELECT id FROM students WHERE code = %s', (code,))
        if cur.fetchone():
            cur.close()
            return jsonify({'success': False, 'message': 'رقم الطالب موجود بالفعل'}), 400
        
        student_id = str(uuid.uuid4())
        cur.execute(
            'INSERT INTO students (id, name, code, email, class, created_at, updated_at) '
            'VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *',
            (student_id, name, code, email, student_class)
        )
        student = cur.fetchone()
        conn.commit()
        cur.close()
        
        return jsonify({
            'success': True, 
            'message': 'تم إضافة الطالب بنجاح', 
            'student': {
                'id': student[0], 
                'name': student[1], 
                'code': student[2], 
                'email': student[3], 
                'class': student[4]
            }
        }), 201
    finally:
        return_db(conn)

@admin_bp.route('/students/<student_id>', methods=['DELETE'])
@verify_admin
def delete_student(student_id):
    """Delete a student"""
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute('DELETE FROM skills WHERE student_id = %s', (student_id,))
        cur.execute('DELETE FROM students WHERE id = %s RETURNING *', (student_id,))
        student = cur.fetchone()
        
        if not student:
            cur.close()
            return jsonify({'success': False, 'message': 'الطالب غير موجود'}), 404
        
        conn.commit()
        cur.close()
        return jsonify({'success': True, 'message': 'تم حذف الطالب بنجاح'})
    finally:
        return_db(conn)

@admin_bp.route('/students/<student_id>', methods=['PUT'])
@verify_admin
def update_student(student_id):
    """Update a student's information"""
    data = request.json
    name = data.get('name')
    code = data.get('code')
    email = data.get('email')
    student_class = data.get('class')
    
    conn = get_db()
    try:
        cur = conn.cursor()
        
        # Check if code is being changed and if it already exists
        if code:
            cur.execute('SELECT id FROM students WHERE code = %s AND id != %s', (code, student_id))
            if cur.fetchone():
                cur.close()
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
            cur.close()
            return jsonify({'success': False, 'message': 'الطالب غير موجود'}), 404
        
        conn.commit()
        cur.close()
        
        return jsonify({
            'success': True,
            'message': 'تم تحديث بيانات الطالب بنجاح',
            'student': {
                'id': student[0],
                'name': student[1],
                'code': student[2],
                'email': student[3],
                'class': student[4]
            }
        })
    finally:
        return_db(conn)

@admin_bp.route('/students/<student_id>/skills', methods=['POST'])
@verify_admin
def add_skill(student_id):
    """Add a skill to a student"""
    data = request.json
    name = data.get('name')
    level = data.get('level', 1)
    description = data.get('description')
    category = data.get('category')
    notes = data.get('notes')
    
    if not name:
        return jsonify({'success': False, 'message': 'البيانات غير صحيحة'}), 400
    
    conn = get_db()
    try:
        cur = conn.cursor()
        skill_id = str(uuid.uuid4())
        cur.execute(
            'INSERT INTO skills (id, student_id, name, level, description, category, notes, created_at, updated_at) '
            'VALUES (%s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *',
            (skill_id, student_id, name, level, description, category, notes)
        )
        skill = cur.fetchone()
        conn.commit()
        cur.close()
        
        return jsonify({
            'success': True, 
            'message': 'تم إضافة المهارة بنجاح', 
            'skill': {
                'id': skill[0], 
                'student_id': skill[1], 
                'name': skill[2], 
                'level': skill[3]
            }
        }), 201
    finally:
        return_db(conn)

@admin_bp.route('/skills/<skill_id>', methods=['PUT'])
@verify_admin
def update_skill(skill_id):
    """Update a skill"""
    data = request.json
    name = data.get('name')
    level = data.get('level')
    description = data.get('description')
    category = data.get('category')
    notes = data.get('notes')
    
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            'UPDATE skills SET '
            'name = COALESCE(%s, name), '
            'level = COALESCE(%s, level), '
            'description = COALESCE(%s, description), '
            'category = COALESCE(%s, category), '
            'notes = COALESCE(%s, notes), '
            'updated_at = CURRENT_TIMESTAMP '
            'WHERE id = %s RETURNING *',
            (name, level, description, category, notes, skill_id)
        )
        skill = cur.fetchone()
        
        if not skill:
            cur.close()
            return jsonify({'success': False, 'message': 'المهارة غير موجودة'}), 404
        
        conn.commit()
        cur.close()
        
        return jsonify({
            'success': True, 
            'message': 'تم تحديث المهارة بنجاح', 
            'skill': {
                'id': skill[0], 
                'name': skill[2], 
                'level': skill[3]
            }
        })
    finally:
        return_db(conn)

@admin_bp.route('/skills/<skill_id>', methods=['DELETE'])
@verify_admin
def delete_skill(skill_id):
    """Delete a skill"""
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute('DELETE FROM skills WHERE id = %s RETURNING *', (skill_id,))
        skill = cur.fetchone()
        
        if not skill:
            cur.close()
            return jsonify({'success': False, 'message': 'المهارة غير موجودة'}), 404
        
        conn.commit()
        cur.close()
        return jsonify({'success': True, 'message': 'تم حذف المهارة بنجاح'})
    finally:
        return_db(conn)

@admin_bp.route('/recent-activities', methods=['GET'])
@verify_admin
def get_recent_activities():
    """Get recent activities (completed skills) from all students in one query"""
    conn = get_db()
    try:
        cur = conn.cursor()
        # Get recent completed skills (level 2 or 3) joined with student info
        cur.execute('''
            SELECT 
                s.name as student_name,
                sk.name as skill_name,
                sk.updated_at AT TIME ZONE 'UTC' as updated_at,
                sk.level
            FROM skills sk
            JOIN students s ON sk.student_id = s.id
            WHERE sk.level IN (2, 3)
            ORDER BY sk.updated_at DESC
            LIMIT 50
        ''')
        
        activities = []
        for row in cur.fetchall():
            # Convert to ISO format with Z suffix for UTC
            updated_at = row[2]
            date_str = updated_at.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z' if updated_at else None
            activities.append({
                'studentName': row[0],
                'skillName': row[1],
                'date': date_str,
                'type': 'completed'
            })
        
        cur.close()
        return jsonify({'success': True, 'activities': activities})
    finally:
        return_db(conn)

@admin_bp.route('/statistics', methods=['GET'])
@verify_admin
def get_statistics():
    """Get dashboard statistics in one query"""
    conn = get_db()
    try:
        cur = conn.cursor()
        
        # Get total students count
        cur.execute('SELECT COUNT(*) FROM students')
        total_students = cur.fetchone()[0]
        
        # Get skills statistics
        cur.execute('''
            SELECT 
                COUNT(*) as total_skills,
                COUNT(CASE WHEN level IN (2, 3) THEN 1 END) as completed_skills
            FROM skills
        ''')
        row = cur.fetchone()
        total_skills = row[0] if row[0] else 0
        completed_skills = row[1] if row[1] else 0
        
        completion_rate = round((completed_skills / total_skills * 100), 1) if total_skills > 0 else 0
        
        cur.close()
        return jsonify({
            'success': True,
            'statistics': {
                'totalStudents': total_students,
                'totalSkills': total_skills,
                'completedSkills': completed_skills,
                'completionRate': completion_rate
            }
        })
    finally:
        return_db(conn)

@admin_bp.route('/students-with-skills', methods=['GET'])
@verify_admin
def get_students_with_skills():
    """Get all students with their skills in optimized queries"""
    conn = get_db()
    try:
        cur = conn.cursor()
        
        # Get all students
        cur.execute('SELECT id, name, code, email, class FROM students ORDER BY name ASC')
        students_rows = cur.fetchall()
        
        # Get all skills for all students in one query with UTC timestamps
        cur.execute('''
            SELECT 
                sk.id, sk.student_id, sk.name, sk.level, 
                sk.description, sk.category, sk.notes, 
                sk.created_at AT TIME ZONE 'UTC' as created_at, 
                sk.updated_at AT TIME ZONE 'UTC' as updated_at
            FROM skills sk
            ORDER BY sk.student_id, sk.updated_at DESC
        ''')
        skills_rows = cur.fetchall()
        
        # Group skills by student_id
        skills_by_student = {}
        for skill_row in skills_rows:
            student_id = skill_row[1]
            if student_id not in skills_by_student:
                skills_by_student[student_id] = []
            
            # Convert timestamps to proper UTC format with Z suffix
            created_at = skill_row[7].strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z' if skill_row[7] else None
            updated_at = skill_row[8].strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z' if skill_row[8] else None
            
            skills_by_student[student_id].append({
                'id': skill_row[0],
                'name': skill_row[2],
                'level': skill_row[3],
                'description': skill_row[4],
                'category': skill_row[5],
                'notes': skill_row[6],
                'created_at': created_at,
                'updated_at': updated_at
            })
        
        # Build students with their skills
        students = []
        for student_row in students_rows:
            student_id = student_row[0]
            students.append({
                'id': student_id,
                'name': student_row[1],
                'code': student_row[2],
                'email': student_row[3],
                'class': student_row[4],
                'skills': skills_by_student.get(student_id, [])
            })
        
        cur.close()
        return jsonify({'success': True, 'students': students})
    finally:
        return_db(conn)
