# Skill Templates Management Routes
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

custom_skills_bp = Blueprint('custom_skills', __name__, url_prefix='/api/skill-templates')

@custom_skills_bp.route('', methods=['GET'])
def get_skill_templates():
    """Get all skill templates with statistics"""
    conn = get_db()
    try:
        cur = conn.cursor()
        
        # Get filter parameters
        category = request.args.get('category')
        search = request.args.get('search')
        is_active = request.args.get('is_active', 'true')
        
        query = '''
            SELECT st.id, st.name, st.description, st.url, st.category, 
                   st.icon, st.color, st.is_active, st.usage_count, 
                   st.created_at, st.updated_at
            FROM skill_templates st
            WHERE st.is_active = %s
        '''
        params = [is_active.lower() == 'true']
        
        if category:
            query += ' AND st.category = %s'
            params.append(category)
        
        if search:
            query += ' AND st.name ILIKE %s'
            params.append(f'%{search}%')
        
        query += ' ORDER BY st.name ASC'
        
        cur.execute(query, params)
        templates = []
        for row in cur.fetchall():
            templates.append({
                'id': str(row[0]),
                'name': row[1],
                'description': row[2] or '',
                'url': row[3] or '',
                'category': row[4] or 'مهارات عامة',
                'icon': row[5] or '📚',
                'color': row[6] or 'indigo',
                'is_active': row[7],
                'usage_count': row[8] or 0,
                'created_at': str(row[9]) if row[9] else None,
                'updated_at': str(row[10]) if row[10] else None
            })
        cur.close()
        return jsonify({'success': True, 'templates': templates})
    except Exception as e:
        print(f"Error fetching skill templates: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        return_db(conn)

@custom_skills_bp.route('/categories', methods=['GET'])
def get_categories():
    """Get all skill categories"""
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            'SELECT id, name, icon, color, display_order FROM skill_categories ORDER BY display_order ASC'
        )
        categories = []
        for row in cur.fetchall():
            categories.append({
                'id': str(row[0]),
                'name': row[1],
                'icon': row[2] or '📁',
                'color': row[3] or 'slate',
                'display_order': row[4] or 0
            })
        cur.close()
        return jsonify({'success': True, 'categories': categories})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        return_db(conn)

@custom_skills_bp.route('', methods=['POST'])
@verify_admin
def add_skill_template():
    """Add a new skill template"""
    data = request.json
    name = data.get('name', '').strip()
    description = data.get('description', '').strip()
    url = data.get('url', '').strip()
    category = data.get('category', 'مهارات عامة')
    icon = data.get('icon', '📚')
    color = data.get('color', 'indigo')
    
    if not name:
        return jsonify({'success': False, 'message': 'يجب إدخال اسم المهارة'}), 400
    
    conn = get_db()
    try:
        cur = conn.cursor()
        
        # Check if skill already exists
        cur.execute('SELECT id FROM skill_templates WHERE name = %s', (name,))
        if cur.fetchone():
            cur.close()
            return jsonify({'success': False, 'message': 'المهارة موجودة بالفعل'}), 400
        
        template_id = str(uuid.uuid4())
        cur.execute(
            '''INSERT INTO skill_templates 
               (id, name, description, url, category, icon, color, is_active, usage_count, created_at, updated_at) 
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)''',
            (template_id, name, description, url, category, icon, color, True, 0)
        )
        conn.commit()
        cur.close()
        return jsonify({'success': True, 'message': 'تم إضافة المهارة بنجاح', 'id': template_id})
    except Exception as e:
        print(f"Error adding skill template: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        return_db(conn)

@custom_skills_bp.route('/<template_id>', methods=['PUT'])
@verify_admin
def update_skill_template(template_id):
    """Update a skill template"""
    data = request.json
    name = data.get('name', '').strip()
    description = data.get('description', '').strip()
    url = data.get('url', '').strip()
    category = data.get('category', 'مهارات عامة')
    icon = data.get('icon', '📚')
    color = data.get('color', 'indigo')
    is_active = data.get('is_active', True)
    
    if not name:
        return jsonify({'success': False, 'message': 'يجب إدخال اسم المهارة'}), 400
    
    conn = get_db()
    try:
        cur = conn.cursor()
        
        # Check if another skill has the same name
        cur.execute('SELECT id FROM skill_templates WHERE name = %s AND id != %s', (name, template_id))
        if cur.fetchone():
            cur.close()
            return jsonify({'success': False, 'message': 'اسم المهارة مستخدم بالفعل'}), 400
        
        cur.execute(
            '''UPDATE skill_templates 
               SET name = %s, description = %s, url = %s, category = %s, 
                   icon = %s, color = %s, is_active = %s, updated_at = CURRENT_TIMESTAMP
               WHERE id = %s''',
            (name, description, url, category, icon, color, is_active, template_id)
        )
        
        if cur.rowcount == 0:
            cur.close()
            return jsonify({'success': False, 'message': 'المهارة غير موجودة'}), 404
            
        conn.commit()
        cur.close()
        return jsonify({'success': True, 'message': 'تم تحديث المهارة بنجاح'})
    except Exception as e:
        print(f"Error updating skill template: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        return_db(conn)

@custom_skills_bp.route('/<template_id>', methods=['DELETE'])
@verify_admin
def delete_skill_template(template_id):
    """Delete a skill template (soft delete by setting is_active = false)"""
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            'UPDATE skill_templates SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = %s',
            (template_id,)
        )
        
        if cur.rowcount == 0:
            cur.close()
            return jsonify({'success': False, 'message': 'المهارة غير موجودة'}), 404
        
        conn.commit()
        cur.close()
        return jsonify({'success': True, 'message': 'تم حذف المهارة بنجاح'})
    except Exception as e:
        print(f"Error deleting skill template: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        return_db(conn)

@custom_skills_bp.route('/<template_id>/students', methods=['GET'])
@verify_admin
def get_template_students(template_id):
    """Get all students who have this skill"""
    conn = get_db()
    try:
        cur = conn.cursor()
        
        # Get template name first
        cur.execute('SELECT name FROM skill_templates WHERE id = %s', (template_id,))
        result = cur.fetchone()
        if not result:
            cur.close()
            return jsonify({'success': False, 'message': 'المهارة غير موجودة'}), 404
        
        template_name = result[0]
        
        # Get students with this skill
        cur.execute(
            '''SELECT DISTINCT s.id, s.name, s.code, sk.level, sk.created_at
               FROM students s
               INNER JOIN skills sk ON s.id = sk.student_id
               WHERE sk.name = %s
               ORDER BY sk.created_at DESC''',
            (template_name,)
        )
        
        students = []
        for row in cur.fetchall():
            students.append({
                'id': str(row[0]),
                'name': row[1],
                'code': row[2],
                'level': row[3],
                'completed': row[3] in [2, 3],
                'assigned_at': str(row[4]) if row[4] else None
            })
        
        cur.close()
        return jsonify({'success': True, 'students': students, 'skill_name': template_name})
    except Exception as e:
        print(f"Error getting template students: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        return_db(conn)

@custom_skills_bp.route('/<template_id>/bulk-assign', methods=['POST'])
@verify_admin
def bulk_assign_skill(template_id):
    """Assign this skill to multiple students"""
    data = request.json
    student_ids = data.get('student_ids', [])
    
    if not student_ids:
        return jsonify({'success': False, 'message': 'يجب اختيار طلاب'}), 400
    
    conn = get_db()
    try:
        cur = conn.cursor()
        
        # Get template details
        cur.execute('SELECT name, url FROM skill_templates WHERE id = %s', (template_id,))
        result = cur.fetchone()
        if not result:
            cur.close()
            return jsonify({'success': False, 'message': 'المهارة غير موجودة'}), 404
        
        skill_name = result[0]
        skill_url = result[1] or ''
        
        success_count = 0
        skip_count = 0
        
        for student_id in student_ids:
            # Check if student already has this skill
            cur.execute(
                'SELECT id FROM skills WHERE student_id = %s AND name = %s',
                (student_id, skill_name)
            )
            if cur.fetchone():
                skip_count += 1
                continue
            
            # Add skill to student
            skill_id = str(uuid.uuid4())
            cur.execute(
                '''INSERT INTO skills (id, student_id, name, level, description, category, created_at, updated_at)
                   VALUES (%s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)''',
                (skill_id, student_id, skill_name, 1, skill_url, 'assigned')
            )
            success_count += 1
        
        # Update usage count
        cur.execute(
            '''UPDATE skill_templates 
               SET usage_count = (SELECT COUNT(DISTINCT student_id) FROM skills WHERE name = %s AND student_id IS NOT NULL),
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = %s''',
            (skill_name, template_id)
        )
        
        conn.commit()
        cur.close()
        
        message = f'تم إضافة المهارة لـ {success_count} طالب'
        if skip_count > 0:
            message += f' (تم تخطي {skip_count} طالب لديهم المهارة بالفعل)'
        
        return jsonify({'success': True, 'message': message, 'assigned': success_count, 'skipped': skip_count})
    except Exception as e:
        print(f"Error bulk assigning skill: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        return_db(conn)

# Legacy endpoint for backward compatibility
@custom_skills_bp.route('/custom-skills', methods=['GET'])
def get_custom_skills_legacy():
    """Get custom skills (legacy endpoint for backward compatibility)"""
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            'SELECT name, url FROM skill_templates WHERE is_active = true ORDER BY name ASC'
        )
        skills = []
        for row in cur.fetchall():
            skills.append({'name': row[0], 'url': row[1] or ''})
        cur.close()
        return jsonify({'success': True, 'skills': skills})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        return_db(conn)
