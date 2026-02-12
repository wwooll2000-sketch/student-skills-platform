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
    from database import get_db, execute_query
except ImportError:
    from api.auth import verify_admin
    from api.database import get_db, execute_query

custom_skills_bp = Blueprint('custom_skills', __name__, url_prefix='/api/skill-templates')

@custom_skills_bp.route('', methods=['GET'])
def get_skill_templates():
    """Get all skill templates with statistics - optimized"""
    try:
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
        
        results = execute_query(query, tuple(params), fetch_all=True) or []
        templates = []
        for row in results:
            templates.append({
                'id': str(row['id']),
                'name': row['name'],
                'description': row['description'] or '',
                'url': row['url'] or '',
                'category': row['category'] or 'مهارات عامة',
                'icon': row['icon'] or '📚',
                'color': row['color'] or 'indigo',
                'is_active': row['is_active'],
                'usage_count': row['usage_count'] or 0,
                'created_at': str(row['created_at']) if row['created_at'] else None,
                'updated_at': str(row['updated_at']) if row['updated_at'] else None
            })
        return jsonify({'success': True, 'templates': templates})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@custom_skills_bp.route('/categories', methods=['GET'])
def get_categories():
    """Get all skill categories - optimized"""
    try:
        results = execute_query(
            'SELECT id, name, icon, color, display_order FROM skill_categories ORDER BY display_order ASC',
            fetch_all=True
        ) or []
        
        categories = []
        for row in results:
            categories.append({
                'id': str(row['id']),
                'name': row['name'],
                'icon': row['icon'] or '📁',
                'color': row['color'] or 'slate',
                'display_order': row['display_order'] or 0
            })
        return jsonify({'success': True, 'categories': categories})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

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
    
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                # Check if an active skill already exists
                cur.execute('SELECT id FROM skill_templates WHERE name = %s AND is_active = true', (name,))
                if cur.fetchone():
                    return jsonify({'success': False, 'message': 'المهارة موجودة بالفعل'}), 400
                
                # Check if an inactive skill exists with this name - if so, reactivate it
                cur.execute('SELECT id FROM skill_templates WHERE name = %s AND is_active = false', (name,))
                inactive_skill = cur.fetchone()
                
                if inactive_skill:
                    # Reactivate the existing skill instead of creating a new one
                    template_id = str(inactive_skill['id'])
                    cur.execute(
                        '''UPDATE skill_templates 
                           SET description = %s, url = %s, category = %s, icon = %s, color = %s, 
                               is_active = true, updated_at = CURRENT_TIMESTAMP
                           WHERE id = %s''',
                        (description, url, category, icon, color, template_id)
                    )
                    conn.commit()
                    return jsonify({'success': True, 'message': 'تم إعادة تفعيل المهارة بنجاح', 'id': template_id})
                
                # Create new skill if none exists
                template_id = str(uuid.uuid4())
                cur.execute(
                    '''INSERT INTO skill_templates 
                       (id, name, description, url, category, icon, color, is_active, usage_count, created_at, updated_at) 
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)''',
                    (template_id, name, description, url, category, icon, color, True, 0)
                )
                conn.commit()
        
        return jsonify({'success': True, 'message': 'تم إضافة المهارة بنجاح', 'id': template_id})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@custom_skills_bp.route('/<template_id>', methods=['PUT'])
@verify_admin
def update_skill_template(template_id):
    """Update a skill template and propagate changes to all student skills"""
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
    
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                # Get the old template data before update
                cur.execute('SELECT name FROM skill_templates WHERE id = %s', (template_id,))
                old_template = cur.fetchone()
                
                if not old_template:
                    return jsonify({'success': False, 'message': 'المهارة غير موجودة'}), 404
                
                old_name = old_template['name']
                
                # Check if another skill has the same name
                cur.execute('SELECT id FROM skill_templates WHERE name = %s AND id != %s', (name, template_id))
                if cur.fetchone():
                    return jsonify({'success': False, 'message': 'اسم المهارة مستخدم بالفعل'}), 400
                
                # Update the skill template
                cur.execute(
                    '''UPDATE skill_templates 
                       SET name = %s, description = %s, url = %s, category = %s, 
                           icon = %s, color = %s, is_active = %s, updated_at = CURRENT_TIMESTAMP
                       WHERE id = %s''',
                    (name, description, url, category, icon, color, is_active, template_id)
                )
                
                # Auto-update all student skills that have the old name
                cur.execute(
                    '''UPDATE skills 
                       SET name = %s, description = %s, category = %s, updated_at = CURRENT_TIMESTAMP
                       WHERE name = %s''',
                    (name, url, category, old_name)
                )
                
                updated_skills_count = cur.rowcount
                
                # Recalculate usage count based on actual student skills
                cur.execute(
                    '''UPDATE skill_templates 
                       SET usage_count = (SELECT COUNT(DISTINCT student_id) FROM skills WHERE name = %s AND student_id IS NOT NULL)
                       WHERE id = %s''',
                    (name, template_id)
                )
                    
                conn.commit()
        
        message = 'تم تحديث المهارة بنجاح'
        if updated_skills_count > 0:
            message += f' وتم تحديث {updated_skills_count} مهارة للطلاب تلقائياً'
        
        return jsonify({'success': True, 'message': message})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@custom_skills_bp.route('/<template_id>', methods=['DELETE'])
@verify_admin
def delete_skill_template(template_id):
    """Delete a skill template (soft delete by setting is_active = false)
    Optional: Also delete from all students if delete_from_students=true query param"""
    
    delete_from_students = request.args.get('delete_from_students', 'false').lower() == 'true'
    
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                # Get the template name before deleting (needed for student skills deletion)
                cur.execute('SELECT name FROM skill_templates WHERE id = %s', (template_id,))
                template = cur.fetchone()
                
                if not template:
                    return jsonify({'success': False, 'message': 'المهارة غير موجودة'}), 404
                
                template_name = template['name']
                
                # Soft delete the template
                cur.execute(
                    'UPDATE skill_templates SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = %s',
                    (template_id,)
                )
                
                deleted_student_skills = 0
                
                # If requested, delete this skill from all students
                if delete_from_students:
                    cur.execute('DELETE FROM skills WHERE name = %s', (template_name,))
                    deleted_student_skills = cur.rowcount
                
                conn.commit()
        
        message = 'تم حذف المهارة بنجاح'
        if deleted_student_skills > 0:
            message += f' وتم حذفها من {deleted_student_skills} سجل للطلاب'
        
        return jsonify({'success': True, 'message': message})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@custom_skills_bp.route('/<template_id>/decrement-usage', methods=['POST'])
@verify_admin
def decrement_template_usage(template_id):
    """Decrement the usage count for a skill template (called when skill is deleted from a student)"""
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                # Get template name
                cur.execute('SELECT name FROM skill_templates WHERE id = %s', (template_id,))
                result = cur.fetchone()
                if not result:
                    return jsonify({'success': False, 'message': 'المهارة غير موجودة'}), 404
                
                template_name = result['name']
                
                # Recalculate usage count based on actual student skills
                cur.execute(
                    '''UPDATE skill_templates 
                       SET usage_count = (SELECT COUNT(DISTINCT student_id) FROM skills WHERE name = %s AND student_id IS NOT NULL),
                           updated_at = CURRENT_TIMESTAMP
                       WHERE id = %s''',
                    (template_name, template_id)
                )
                
                conn.commit()
        
        return jsonify({'success': True, 'message': 'تم تحديث عدد الاستخدامات'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@custom_skills_bp.route('/<template_id>/students', methods=['GET'])
@verify_admin
def get_template_students(template_id):
    """Get all students who have this skill"""
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                # Get template name first
                cur.execute('SELECT name FROM skill_templates WHERE id = %s', (template_id,))
                result = cur.fetchone()
                if not result:
                    return jsonify({'success': False, 'message': 'المهارة غير موجودة'}), 404
                
                template_name = result['name']
                
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
                        'id': str(row['id']),
                        'name': row['name'],
                        'code': row['code'],
                        'level': row['level'],
                        'completed': row['level'] in [2, 3],
                        'assigned_at': str(row['created_at']) if row['created_at'] else None
                    })
        
        return jsonify({'success': True, 'students': students, 'skill_name': template_name})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@custom_skills_bp.route('/<template_id>/bulk-assign', methods=['POST'])
@verify_admin
def bulk_assign_skill(template_id):
    """Assign this skill to multiple students"""
    data = request.json
    student_ids = data.get('student_ids', [])
    
    if not student_ids:
        return jsonify({'success': False, 'message': 'يجب اختيار طلاب'}), 400
    
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                # Get template details
                cur.execute('SELECT name, url FROM skill_templates WHERE id = %s', (template_id,))
                result = cur.fetchone()
                if not result:
                    return jsonify({'success': False, 'message': 'المهارة غير موجودة'}), 404
                
                skill_name = result['name']
                skill_url = result['url'] or ''
                
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
        
        message = f'تم إضافة المهارة لـ {success_count} طالب'
        if skip_count > 0:
            message += f' (تم تخطي {skip_count} طالب لديهم المهارة بالفعل)'
        
        return jsonify({'success': True, 'message': message, 'assigned': success_count, 'skipped': skip_count})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# Legacy endpoint for backward compatibility
@custom_skills_bp.route('/custom-skills', methods=['GET'])
def get_custom_skills_legacy():
    """Get custom skills (legacy endpoint for backward compatibility)"""
    try:
        results = execute_query(
            'SELECT name, url FROM skill_templates WHERE is_active = true ORDER BY name ASC',
            fetch_all=True
        ) or []
        
        skills = [{'name': row['name'], 'url': row['url'] or ''} for row in results]
        return jsonify({'success': True, 'skills': skills})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
