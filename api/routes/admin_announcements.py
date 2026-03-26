# Admin Announcements Routes — CRUD for announcements
from flask import Blueprint, request, jsonify
import sys
import os
import uuid

parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

try:
    from auth import verify_admin
    from database import execute_query, invalidate_cache
except ImportError:
    from api.auth import verify_admin
    from api.database import execute_query, invalidate_cache

admin_announcements_bp = Blueprint('admin_announcements', __name__, url_prefix='/api/admin')

VALID_TYPES = {'basic', 'warning', 'danger'}


def _ensure_announcements_tables():
    """Create announcements tables if they don't exist (auto-migration)"""
    try:
        execute_query("""
            CREATE TABLE IF NOT EXISTS announcements (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                title TEXT NOT NULL,
                description TEXT,
                type VARCHAR(20) NOT NULL DEFAULT 'basic'
                    CHECK (type IN ('basic', 'warning', 'danger')),
                target_all BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        """)
        execute_query("""
            CREATE TABLE IF NOT EXISTS announcement_students (
                announcement_id UUID NOT NULL
                    REFERENCES announcements(id) ON DELETE CASCADE,
                student_id UUID NOT NULL
                    REFERENCES students(id) ON DELETE CASCADE,
                PRIMARY KEY (announcement_id, student_id)
            )
        """)
    except Exception as e:
        print(f"[WARNING] Could not create announcements tables: {e}")


def _format_announcement(row, student_ids):
    return {
        'id': str(row['id']),
        'title': row['title'],
        'description': row['description'] or '',
        'type': row['type'],
        'target_all': row['target_all'],
        'student_ids': student_ids,
        'created_at': row['created_at'].strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z' if row['created_at'] else None,
        'updated_at': row['updated_at'].strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z' if row['updated_at'] else None,
    }


@admin_announcements_bp.route('/announcements', methods=['GET'])
@verify_admin
def get_announcements():
    """Get all announcements with their targeted student IDs"""
    _ensure_announcements_tables()
    try:
        rows = execute_query(
            "SELECT id, title, description, type, target_all, created_at, updated_at "
            "FROM announcements ORDER BY created_at DESC",
            fetch_all=True
        ) or []

        if not rows:
            return jsonify({'success': True, 'announcements': []})

        announcement_ids = [str(r['id']) for r in rows]

        # Fetch all student targets in one query
        placeholders = ', '.join(['%s'] * len(announcement_ids))
        targets = execute_query(
            f"SELECT announcement_id, student_id FROM announcement_students "
            f"WHERE announcement_id IN ({placeholders})",
            tuple(announcement_ids),
            fetch_all=True
        ) or []

        # Build map: announcement_id -> [student_id, ...]
        target_map = {}
        for t in targets:
            aid = str(t['announcement_id'])
            if aid not in target_map:
                target_map[aid] = []
            target_map[aid].append(str(t['student_id']))

        announcements = [
            _format_announcement(r, target_map.get(str(r['id']), []))
            for r in rows
        ]

        return jsonify({'success': True, 'announcements': announcements})
    except Exception as e:
        err = str(e).lower()
        # Table not created yet — auto-create and return empty list
        if 'announcements' in err and ('does not exist' in err or 'not exist' in err or 'undefined table' in err):
            _ensure_announcements_tables()
            return jsonify({'success': True, 'announcements': []})
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_announcements_bp.route('/announcements', methods=['POST'])
@verify_admin
def create_announcement():
    """Create a new announcement"""
    _ensure_announcements_tables()
    data = request.json or {}
    title = (data.get('title') or '').strip()
    description = (data.get('description') or '').strip()
    ann_type = data.get('type', 'basic')
    target_all = bool(data.get('target_all', True))
    student_ids = data.get('student_ids', [])

    if not title:
        return jsonify({'success': False, 'message': 'العنوان مطلوب'}), 400
    if ann_type not in VALID_TYPES:
        return jsonify({'success': False, 'message': 'نوع الإعلان غير صحيح'}), 400

    try:
        ann_id = str(uuid.uuid4())
        execute_query(
            "INSERT INTO announcements (id, title, description, type, target_all) "
            "VALUES (%s, %s, %s, %s, %s)",
            (ann_id, title, description, ann_type, target_all)
        )

        if not target_all and student_ids:
            for sid in student_ids:
                try:
                    execute_query(
                        "INSERT INTO announcement_students (announcement_id, student_id) VALUES (%s, %s)",
                        (ann_id, str(sid))
                    )
                except Exception:
                    pass  # Skip invalid student IDs

        invalidate_cache('announcement')

        row = execute_query(
            "SELECT id, title, description, type, target_all, created_at, updated_at "
            "FROM announcements WHERE id = %s",
            (ann_id,),
            fetch_one=True
        )
        return jsonify({
            'success': True,
            'message': 'تم إضافة الإعلان بنجاح',
            'announcement': _format_announcement(row, student_ids if not target_all else [])
        }), 201
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_announcements_bp.route('/announcements/<announcement_id>', methods=['PUT'])
@verify_admin
def update_announcement(announcement_id):
    """Update an existing announcement"""
    _ensure_announcements_tables()
    data = request.json or {}
    title = (data.get('title') or '').strip()
    description = (data.get('description') or '').strip()
    ann_type = data.get('type', 'basic')
    target_all = bool(data.get('target_all', True))
    student_ids = data.get('student_ids', [])

    if not title:
        return jsonify({'success': False, 'message': 'العنوان مطلوب'}), 400
    if ann_type not in VALID_TYPES:
        return jsonify({'success': False, 'message': 'نوع الإعلان غير صحيح'}), 400

    try:
        existing = execute_query(
            "SELECT id FROM announcements WHERE id = %s",
            (announcement_id,),
            fetch_one=True
        )
        if not existing:
            return jsonify({'success': False, 'message': 'الإعلان غير موجود'}), 404

        execute_query(
            "UPDATE announcements SET title = %s, description = %s, type = %s, "
            "target_all = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
            (title, description, ann_type, target_all, announcement_id)
        )

        # Replace student targets
        execute_query(
            "DELETE FROM announcement_students WHERE announcement_id = %s",
            (announcement_id,)
        )
        if not target_all and student_ids:
            for sid in student_ids:
                try:
                    execute_query(
                        "INSERT INTO announcement_students (announcement_id, student_id) VALUES (%s, %s)",
                        (announcement_id, str(sid))
                    )
                except Exception:
                    pass

        invalidate_cache('announcement')

        row = execute_query(
            "SELECT id, title, description, type, target_all, created_at, updated_at "
            "FROM announcements WHERE id = %s",
            (announcement_id,),
            fetch_one=True
        )
        return jsonify({
            'success': True,
            'message': 'تم تحديث الإعلان بنجاح',
            'announcement': _format_announcement(row, student_ids if not target_all else [])
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_announcements_bp.route('/announcements/<announcement_id>', methods=['DELETE'])
@verify_admin
def delete_announcement(announcement_id):
    """Delete an announcement"""
    try:
        existing = execute_query(
            "SELECT id FROM announcements WHERE id = %s",
            (announcement_id,),
            fetch_one=True
        )
        if not existing:
            return jsonify({'success': False, 'message': 'الإعلان غير موجود'}), 404

        execute_query("DELETE FROM announcements WHERE id = %s", (announcement_id,))
        invalidate_cache('announcement')

        return jsonify({'success': True, 'message': 'تم حذف الإعلان بنجاح'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
