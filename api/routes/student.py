# Student Routes
from flask import Blueprint, request, jsonify
import sys
import os

# Add parent directory to path for imports
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

try:
    from database import get_db, execute_query, get_student_by_code_cached, get_student_skills_cached
except ImportError:
    from api.database import get_db, execute_query, get_student_by_code_cached, get_student_skills_cached

student_bp = Blueprint('student', __name__, url_prefix='/api/student')

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

@student_bp.route('/<student_id>/skills', methods=['GET'])
def get_student_skills(student_id):
    """Get all skills for a student with caching"""
    try:
        # Use cached query for much faster response
        skills_data = get_student_skills_cached(student_id)
        
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
                'created_at': created_at, 
                'updated_at': updated_at
            })
        
        return jsonify({'success': True, 'skills': skills})
    except Exception as e:
        print(f"[ERROR] get_student_skills: {str(e)}")
        return jsonify({'success': False, 'message': f'خطأ في جلب المهارات: {str(e)}'}), 500
