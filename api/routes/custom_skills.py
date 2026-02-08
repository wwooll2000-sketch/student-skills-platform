# Custom Skills Routes
from flask import Blueprint, request, jsonify
import uuid
import sys
import os

# Add parent directory to path for imports
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

try:
    from auth import verify_admin
    from database import get_db, return_db
except ImportError:
    from api.auth import verify_admin
    from api.database import get_db, return_db

custom_skills_bp = Blueprint('custom_skills', __name__, url_prefix='/api/custom-skills')

@custom_skills_bp.route('', methods=['GET'])
def get_custom_skills():
    """Get all custom skills"""
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            'SELECT DISTINCT name, description FROM skills WHERE category = %s',
            ('custom',)
        )
        skills = []
        for row in cur.fetchall():
            skills.append({'name': row[0], 'url': row[1] or ''})
        cur.close()
        return jsonify({'success': True, 'skills': skills})
    finally:
        return_db(conn)

@custom_skills_bp.route('', methods=['POST'])
@verify_admin
def add_custom_skill():
    """Add a custom skill"""
    data = request.json
    name = data.get('name')
    url = data.get('url')
    
    if not name or not url:
        return jsonify({'success': False, 'message': 'البيانات غير صحيحة'}), 400
    
    conn = get_db()
    try:
        cur = conn.cursor()
        skill_id = str(uuid.uuid4())
        cur.execute(
            'INSERT INTO skills (id, student_id, name, level, description, category, created_at, updated_at) '
            'VALUES (%s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
            (skill_id, None, name, 0, url, 'custom')
        )
        conn.commit()
        cur.close()
        return jsonify({'success': True, 'message': 'تم إضافة المهارة المخصصة'})
    finally:
        return_db(conn)

@custom_skills_bp.route('/<skill_name>', methods=['DELETE'])
@verify_admin
def delete_custom_skill(skill_name):
    """Delete a custom skill"""
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            'DELETE FROM skills WHERE name = %s AND category = %s',
            (skill_name, 'custom')
        )
        conn.commit()
        cur.close()
        return jsonify({'success': True, 'message': 'تم حذف المهارة المخصصة'})
    finally:
        return_db(conn)
