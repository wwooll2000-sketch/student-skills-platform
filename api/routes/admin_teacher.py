# Admin Teacher Settings Routes
from flask import Blueprint, request, jsonify
import sys
import os

parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

try:
    from auth import verify_admin, get_admin_password
    from database import execute_query, invalidate_cache
except ImportError:
    from api.auth import verify_admin, get_admin_password
    from api.database import execute_query, invalidate_cache

admin_teacher_bp = Blueprint('admin_teacher', __name__, url_prefix='/api/admin')


@admin_teacher_bp.route('/teacher/profile', methods=['GET'])
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


@admin_teacher_bp.route('/teacher/column-visibility', methods=['PUT'])
@verify_admin
def update_column_visibility():
    """Update which columns are visible in the student view"""
    data = request.json
    column_visibility = data.get('column_visibility', {})

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


@admin_teacher_bp.route('/teacher/update-name', methods=['PUT'])
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
            'UPDATE teacher SET name = %s, updated_at = CURRENT_TIMESTAMP '
            'WHERE id = (SELECT id FROM teacher LIMIT 1) RETURNING *',
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


@admin_teacher_bp.route('/teacher/update-password', methods=['PUT'])
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

    if current_password != get_admin_password():
        return jsonify({'success': False, 'message': 'كلمة المرور الحالية غير صحيحة'}), 401

    try:
        execute_query(
            'UPDATE teacher SET password = %s, updated_at = CURRENT_TIMESTAMP '
            'WHERE id = (SELECT id FROM teacher LIMIT 1) RETURNING *',
            (new_password,),
            fetch_one=True
        )

        return jsonify({'success': True, 'message': 'تم تحديث كلمة المرور بنجاح'})
    except Exception as e:
        return jsonify({'success': False, 'message': f'خطأ في تحديث كلمة المرور: {str(e)}'}), 500
