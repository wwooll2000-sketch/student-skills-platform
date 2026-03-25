# Admin Evidence Routes
from flask import Blueprint, request, jsonify
import uuid
import sys
import os

parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

try:
    from auth import verify_admin
    from database import execute_query, invalidate_cache
except ImportError:
    from api.auth import verify_admin
    from api.database import execute_query, invalidate_cache

admin_evidence_bp = Blueprint('admin_evidence', __name__, url_prefix='/api/admin')


@admin_evidence_bp.route('/skills/<skill_id>/evidence', methods=['GET'])
@verify_admin
def get_skill_evidence(skill_id):
    """Get all evidence/photos for a skill"""
    try:
        evidence_list = execute_query(
            "SELECT id, skill_id, evidence_url, created_at FROM skill_evidence "
            "WHERE skill_id = %s AND (evidence_url NOT LIKE '%%youtube%%' AND evidence_url NOT LIKE '%%youtu.be%%') "
            "ORDER BY created_at DESC",
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
        print(f"[ERROR] get_skill_evidence: {error_msg}")
        if 'skill_evidence' in error_msg and ('does not exist' in error_msg or 'not exist' in error_msg):
            return jsonify({
                'success': False,
                'message': 'يرجى تشغيل ملف الترحيل run_migration.py لإنشاء جدول الشواهد',
                'error': 'skill_evidence table does not exist'
            }), 500
        return jsonify({'success': False, 'message': error_msg}), 500


@admin_evidence_bp.route('/skills/<skill_id>/evidence', methods=['POST'])
@verify_admin
def add_skill_evidence(skill_id):
    """Add evidence/photo to a skill"""
    data = request.json
    evidence_url = data.get('evidence_url')

    if not evidence_url:
        return jsonify({'success': False, 'message': 'يرجى إرفاق صورة'}), 400

    try:
        evidence_id = str(uuid.uuid4())
        evidence = execute_query(
            'INSERT INTO skill_evidence (id, skill_id, evidence_url, created_at) '
            'VALUES (%s, %s, %s, CURRENT_TIMESTAMP) RETURNING *',
            (evidence_id, skill_id, evidence_url),
            fetch_one=True
        )

        skill = execute_query('SELECT student_id FROM skills WHERE id = %s', (skill_id,), fetch_one=True)
        if skill:
            invalidate_cache(f"get_student_skills_cached:('{skill['student_id']}',)")

        return jsonify({
            'success': True,
            'message': 'تم إضافة الشاهد بنجاح',
            'evidence': {
                'id': str(evidence['id']),
                'skill_id': str(evidence['skill_id']),
                'evidence_url': evidence['evidence_url'],
                'created_at': evidence['created_at'].isoformat() if evidence['created_at'] else None
            }
        }), 201
    except Exception as e:
        error_msg = str(e)
        print(f"[ERROR] add_skill_evidence: {error_msg}")
        if 'skill_evidence' in error_msg and ('does not exist' in error_msg or 'not exist' in error_msg):
            return jsonify({
                'success': False,
                'message': 'يرجى تشغيل ملف الترحيل run_migration.py لإنشاء جدول الشواهد',
                'error': 'skill_evidence table does not exist',
                'help': 'Run: python run_migration.py'
            }), 500
        return jsonify({'success': False, 'message': error_msg}), 500


@admin_evidence_bp.route('/skills/<skill_id>/evidence', methods=['DELETE'])
@verify_admin
def delete_all_skill_evidence(skill_id):
    """Delete all evidence/photos for a skill"""
    try:
        skill = execute_query('SELECT student_id FROM skills WHERE id = %s', (skill_id,), fetch_one=True)

        if not skill:
            return jsonify({'success': False, 'message': 'المهارة غير موجودة'}), 404

        result = execute_query(
            'DELETE FROM skill_evidence WHERE skill_id = %s RETURNING id',
            (skill_id,),
            fetch_all=True
        )

        deleted_count = len(result) if result else 0
        invalidate_cache(f"get_student_skills_cached:('{skill['student_id']}',)")

        return jsonify({
            'success': True,
            'message': f'تم حذف {deleted_count} شاهد بنجاح',
            'count': deleted_count
        })
    except Exception as e:
        print(f"[ERROR] delete_all_skill_evidence: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_evidence_bp.route('/evidence/<evidence_id>', methods=['DELETE'])
@verify_admin
def delete_evidence(evidence_id):
    """Delete a specific evidence/photo"""
    try:
        evidence = execute_query('SELECT skill_id FROM skill_evidence WHERE id = %s', (evidence_id,), fetch_one=True)

        if not evidence:
            return jsonify({'success': False, 'message': 'الشاهد غير موجود'}), 404

        skill = execute_query('SELECT student_id FROM skills WHERE id = %s', (evidence['skill_id'],), fetch_one=True)

        execute_query('DELETE FROM skill_evidence WHERE id = %s', (evidence_id,))

        if skill:
            invalidate_cache(f"get_student_skills_cached:('{skill['student_id']}',)")

        return jsonify({'success': True, 'message': 'تم حذف الشاهد بنجاح'})
    except Exception as e:
        print(f"[ERROR] delete_evidence: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_evidence_bp.route('/evidence/<evidence_id>', methods=['PUT'])
@verify_admin
def update_evidence(evidence_id):
    """Update/replace a specific evidence/photo"""
    data = request.json
    new_evidence_url = data.get('evidence_url')

    if not new_evidence_url:
        return jsonify({'success': False, 'message': 'يرجى إرفاق صورة'}), 400

    try:
        evidence = execute_query('SELECT skill_id FROM skill_evidence WHERE id = %s', (evidence_id,), fetch_one=True)

        if not evidence:
            return jsonify({'success': False, 'message': 'الشاهد غير موجود'}), 404

        skill = execute_query('SELECT student_id FROM skills WHERE id = %s', (evidence['skill_id'],), fetch_one=True)

        updated_evidence = execute_query(
            'UPDATE skill_evidence SET evidence_url = %s WHERE id = %s RETURNING *',
            (new_evidence_url, evidence_id),
            fetch_one=True
        )

        if skill:
            invalidate_cache(f"get_student_skills_cached:('{skill['student_id']}',)")

        return jsonify({
            'success': True,
            'message': 'تم تحديث الشاهد بنجاح',
            'evidence': {
                'id': str(updated_evidence['id']),
                'skill_id': str(updated_evidence['skill_id']),
                'evidence_url': updated_evidence['evidence_url'],
                'created_at': updated_evidence['created_at'].isoformat() if updated_evidence['created_at'] else None
            }
        })
    except Exception as e:
        print(f"[ERROR] update_evidence: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500
