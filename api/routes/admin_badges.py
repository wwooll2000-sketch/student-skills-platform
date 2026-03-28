# Admin Badges Routes — CRUD for badge management
from flask import Blueprint, request, jsonify
import sys
import os

parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

try:
    from auth import verify_admin
    from database import execute_query
except ImportError:
    from api.auth import verify_admin
    from api.database import execute_query

admin_badges_bp = Blueprint('admin_badges', __name__, url_prefix='/api/admin')

VALID_CRITERIA_TYPES = {
    'skills_completed', 'completion_percent', 'tests_passed', 'level3_skills',
    'tests_attempted', 'perfect_tests', 'ready_actions', 'login_count'
}


def _ensure_badges_table():
    """Auto-migrate: create badges table if it doesn't exist"""
    try:
        execute_query("""
            CREATE TABLE IF NOT EXISTS badges (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                icon VARCHAR(20) NOT NULL DEFAULT '🏅',
                description TEXT,
                criteria_type VARCHAR(50) NOT NULL DEFAULT 'skills_completed',
                criteria_value INTEGER NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        execute_query("""
            ALTER TABLE teacher
            ADD COLUMN IF NOT EXISTS badge_display_mode VARCHAR(20) DEFAULT 'show_all'
        """)
    except Exception as e:
        print(f"[WARNING] Could not create badges table: {e}")


def _format_badge(row):
    return {
        'id': str(row['id']),
        'name': row['name'],
        'icon': row['icon'],
        'description': row['description'] or '',
        'criteria_type': row['criteria_type'],
        'criteria_value': int(row['criteria_value']),
        'created_at': row['created_at'].isoformat() if row['created_at'] else None,
        'updated_at': row['updated_at'].isoformat() if row['updated_at'] else None,
    }


@admin_badges_bp.route('/badges', methods=['GET'])
@verify_admin
def list_badges():
    _ensure_badges_table()
    try:
        rows = execute_query(
            'SELECT id, name, icon, description, criteria_type, criteria_value, created_at, updated_at '
            'FROM badges ORDER BY created_at ASC',
            fetch_all=True
        )
        return jsonify({'success': True, 'badges': [_format_badge(r) for r in (rows or [])]})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_badges_bp.route('/badges', methods=['POST'])
@verify_admin
def create_badge():
    _ensure_badges_table()
    data = request.json or {}
    name = (data.get('name') or '').strip()
    icon = (data.get('icon') or '🏅').strip()
    description = (data.get('description') or '').strip()
    criteria_type = data.get('criteria_type', 'skills_completed')
    criteria_value = data.get('criteria_value', 1)

    if not name:
        return jsonify({'success': False, 'message': 'اسم الإنجاز مطلوب'}), 400
    if criteria_type not in VALID_CRITERIA_TYPES:
        return jsonify({'success': False, 'message': 'نوع المعيار غير صحيح'}), 400
    try:
        criteria_value = int(criteria_value)
        if criteria_value < 1:
            raise ValueError()
    except (ValueError, TypeError):
        return jsonify({'success': False, 'message': 'قيمة المعيار يجب أن تكون رقماً موجباً'}), 400

    try:
        row = execute_query(
            'INSERT INTO badges (name, icon, description, criteria_type, criteria_value) '
            'VALUES (%s, %s, %s, %s, %s) RETURNING id',
            (name, icon, description, criteria_type, criteria_value),
            fetch_one=True
        )
        return jsonify({'success': True, 'badge_id': str(row['id'])})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_badges_bp.route('/badges/<badge_id>', methods=['PUT'])
@verify_admin
def update_badge(badge_id):
    _ensure_badges_table()
    data = request.json or {}
    name = (data.get('name') or '').strip()
    icon = (data.get('icon') or '🏅').strip()
    description = (data.get('description') or '').strip()
    criteria_type = data.get('criteria_type', 'skills_completed')
    criteria_value = data.get('criteria_value', 1)

    if not name:
        return jsonify({'success': False, 'message': 'اسم الإنجاز مطلوب'}), 400
    if criteria_type not in VALID_CRITERIA_TYPES:
        return jsonify({'success': False, 'message': 'نوع المعيار غير صحيح'}), 400
    try:
        criteria_value = int(criteria_value)
        if criteria_value < 1:
            raise ValueError()
    except (ValueError, TypeError):
        return jsonify({'success': False, 'message': 'قيمة المعيار يجب أن تكون رقماً موجباً'}), 400

    try:
        execute_query(
            'UPDATE badges SET name=%s, icon=%s, description=%s, criteria_type=%s, '
            'criteria_value=%s, updated_at=CURRENT_TIMESTAMP WHERE id=%s',
            (name, icon, description, criteria_type, criteria_value, badge_id)
        )
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_badges_bp.route('/badges/<badge_id>', methods=['DELETE'])
@verify_admin
def delete_badge(badge_id):
    _ensure_badges_table()
    try:
        execute_query('DELETE FROM badges WHERE id = %s', (badge_id,))
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_badges_bp.route('/badges', methods=['DELETE'])
@verify_admin
def delete_all_badges():
    _ensure_badges_table()
    try:
        execute_query('DELETE FROM badges')
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
