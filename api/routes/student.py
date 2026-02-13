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

@student_bp.route('/skills/<skill_id>/evidence', methods=['GET'])
def get_student_skill_evidence(skill_id):
    """Get evidence/photos for a skill (student read-only view)"""
    try:
        evidence_list = execute_query(
            'SELECT id, skill_id, evidence_url, created_at FROM skill_evidence WHERE skill_id = %s ORDER BY created_at DESC',
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
