# Student Routes
from flask import Blueprint, request, jsonify
import sys
import os

# Add parent directory to path for imports
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

try:
    from database import get_db, return_db
except ImportError:
    from api.database import get_db, return_db

student_bp = Blueprint('student', __name__, url_prefix='/api/student')

@student_bp.route('/login', methods=['POST'])
def student_login():
    """Student login endpoint"""
    data = request.json
    student_code = data.get('studentCode')
    
    if not student_code or len(student_code) < 4:
        return jsonify({'success': False, 'message': 'رقم الطالب غير صحيح'}), 400
    
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute('SELECT * FROM students WHERE code = %s', (student_code,))
        student = cur.fetchone()
        
        if not student:
            cur.close()
            return jsonify({'success': False, 'message': 'رقم الطالب غير موجود'}), 404
        
        cur.close()
        return jsonify({
            'success': True, 
            'message': 'تم الدخول بنجاح', 
            'student': {
                'id': student[0], 
                'name': student[1], 
                'code': student[2], 
                'class': student[4], 
                'email': student[3]
            }
        })
    finally:
        return_db(conn)

@student_bp.route('/<student_id>/skills', methods=['GET'])
def get_student_skills(student_id):
    """Get all skills for a student"""
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            'SELECT id, student_id, name, level, description, category, notes, '
            'created_at AT TIME ZONE \'UTC\' as created_at, '
            'updated_at AT TIME ZONE \'UTC\' as updated_at '
            'FROM skills WHERE student_id = %s ORDER BY level DESC, created_at DESC',
            (student_id,)
        )
        skills = []
        for row in cur.fetchall():
            # Convert timestamps to proper UTC format with Z suffix
            created_at = row[7].strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z' if row[7] else None
            updated_at = row[8].strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z' if row[8] else None
            
            skills.append({
                'id': row[0], 
                'student_id': row[1], 
                'name': row[2], 
                'level': row[3], 
                'description': row[4], 
                'category': row[5], 
                'notes': row[6], 
                'created_at': created_at, 
                'updated_at': updated_at
            })
        cur.close()
        return jsonify({'success': True, 'skills': skills})
    finally:
        return_db(conn)
