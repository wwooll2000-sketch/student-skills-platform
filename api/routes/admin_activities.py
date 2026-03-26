# Admin Activity & Statistics Routes
from flask import Blueprint, request, jsonify
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

admin_activities_bp = Blueprint('admin_activities', __name__, url_prefix='/api/admin')


@admin_activities_bp.route('/recent-activities', methods=['GET'])
@verify_admin
def get_recent_activities():
    """Get recent activities with optional filtering by type, date range, student name, and limit"""
    try:
        activity_type = request.args.get('type', 'all')
        if activity_type not in ('all', 'login', 'logout', 'ready', 'unready', 'completed', 'test'):
            activity_type = 'all'

        date_from = request.args.get('date_from', '').strip()
        date_to = request.args.get('date_to', '').strip()
        student_search = request.args.get('student', '').strip()

        try:
            limit = min(int(request.args.get('limit', 50)), 500)
        except (ValueError, TypeError):
            limit = 50

        per_source = max(limit * 2, 100)

        qp = {'per_source': per_source}
        if date_from:
            qp['date_from'] = date_from
        if date_to:
            qp['date_to'] = date_to
        if student_search:
            qp['student_search'] = f'%{student_search.lower()}%'

        def _date_cond(col):
            parts = []
            if date_from:
                parts.append(f"{col} >= %(date_from)s::date")
            if date_to:
                parts.append(f"{col} < (%(date_to)s::date + interval '1 day')")
            return ('AND ' + ' AND '.join(parts)) if parts else ''

        def _student_cond():
            if student_search:
                return "AND (LOWER(s.name) LIKE %(student_search)s OR LOWER(s.code) LIKE %(student_search)s)"
            return ''

        all_activities = []

        # ── Completed skills ─────────────────────────────────────────────────
        if activity_type in ('all', 'completed'):
            date_c = _date_cond('sk.updated_at')
            stu_c = _student_cond()
            skill_results = execute_query(f'''
                SELECT
                    s.name  AS student_name,
                    s.code  AS student_code,
                    sk.name AS skill_name,
                    sk.updated_at AT TIME ZONE 'UTC' AS activity_date
                FROM skills sk
                JOIN students s ON sk.student_id = s.id
                WHERE sk.level IN (2, 3)
                  {date_c}
                  {stu_c}
                ORDER BY sk.updated_at DESC
                LIMIT %(per_source)s
            ''', qp, fetch_all=True) or []

            for row in skill_results:
                ad = row['activity_date']
                all_activities.append({
                    'studentName': row['student_name'],
                    'studentCode': row['student_code'],
                    'skillName': row.get('skill_name'),
                    'date': ad.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z' if ad else None,
                    'type': 'completed'
                })

        # ── Login / logout ────────────────────────────────────────────────────
        if activity_type in ('all', 'login', 'logout'):
            date_c = _date_cond('l.logged_in_at')
            stu_c = _student_cond()
            type_c = ''
            if activity_type == 'login':
                type_c = "AND l.action_type = 'login'"
            elif activity_type == 'logout':
                type_c = "AND l.action_type = 'logout'"

            login_results = []
            try:
                login_results = execute_query(f'''
                    SELECT
                        s.name  AS student_name,
                        s.code  AS student_code,
                        l.logged_in_at AT TIME ZONE 'UTC' AS activity_date,
                        l.action_type AS activity_type
                    FROM student_login_logs l
                    JOIN students s ON l.student_id = s.id
                    WHERE 1=1
                      {type_c}
                      {date_c}
                      {stu_c}
                    ORDER BY l.logged_in_at DESC
                    LIMIT %(per_source)s
                ''', qp, fetch_all=True) or []
            except Exception as login_error:
                error_msg = str(login_error).lower()
                if 'does not exist' in error_msg or 'student_login_logs' in error_msg:
                    print('[INFO] student_login_logs table not found, skipping login activities')
                elif 'action_type' in error_msg or 'column' in error_msg:
                    print('[INFO] action_type column not found, using default login type')
                    try:
                        login_results = execute_query(f'''
                            SELECT
                                s.name  AS student_name,
                                s.code  AS student_code,
                                l.logged_in_at AT TIME ZONE 'UTC' AS activity_date,
                                'login' AS activity_type
                            FROM student_login_logs l
                            JOIN students s ON l.student_id = s.id
                            WHERE 1=1
                              {date_c}
                              {stu_c}
                            ORDER BY l.logged_in_at DESC
                            LIMIT %(per_source)s
                        ''', qp, fetch_all=True) or []
                    except Exception:
                        login_results = []
                else:
                    print(f'[WARNING] Unexpected error fetching login logs: {login_error}')

            for row in login_results:
                ad = row['activity_date']
                all_activities.append({
                    'studentName': row['student_name'],
                    'studentCode': row['student_code'],
                    'date': ad.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z' if ad else None,
                    'type': row.get('activity_type', 'login')
                })

        # ── Ready / unready ───────────────────────────────────────────────────
        if activity_type in ('all', 'ready', 'unready'):
            date_c = _date_cond('rl.logged_at')
            stu_c = _student_cond()
            ready_c = ''
            if activity_type == 'ready':
                ready_c = 'AND rl.is_ready = TRUE'
            elif activity_type == 'unready':
                ready_c = 'AND rl.is_ready = FALSE'

            ready_results = []
            try:
                ready_results = execute_query(f'''
                    SELECT
                        s.name   AS student_name,
                        s.code   AS student_code,
                        rl.skill_name,
                        rl.is_ready,
                        rl.logged_at AT TIME ZONE 'UTC' AS activity_date
                    FROM student_ready_log rl
                    JOIN students s ON rl.student_id = s.id
                    WHERE 1=1
                      {ready_c}
                      {date_c}
                      {stu_c}
                    ORDER BY rl.logged_at DESC
                    LIMIT %(per_source)s
                ''', qp, fetch_all=True) or []
            except Exception as ready_err:
                err = str(ready_err).lower()
                if 'student_ready_log' not in err and 'does not exist' not in err:
                    print(f'[WARNING] Unexpected error fetching ready log: {ready_err}')

            for row in ready_results:
                ad = row['activity_date']
                all_activities.append({
                    'studentName': row['student_name'],
                    'studentCode': row['student_code'],
                    'skillName': row['skill_name'],
                    'date': ad.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z' if ad else None,
                    'type': 'ready' if row['is_ready'] else 'unready'
                })

        # ── Test attempts ─────────────────────────────────────────────────────
        if activity_type in ('all', 'test'):
            date_c = _date_cond('ta.created_at')
            stu_c = _student_cond()

            test_results = []
            try:
                test_results = execute_query(f'''
                    SELECT
                        s.name   AS student_name,
                        s.code   AS student_code,
                        sk.name  AS skill_name,
                        ta.score,
                        ta.passed,
                        ta.attempt_number,
                        ta.created_at AT TIME ZONE 'UTC' AS activity_date
                    FROM skill_test_attempts ta
                    JOIN students s  ON ta.student_id = s.id
                    JOIN skills   sk ON ta.skill_id   = sk.id
                    WHERE 1=1
                      {date_c}
                      {stu_c}
                    ORDER BY ta.created_at DESC
                    LIMIT %(per_source)s
                ''', qp, fetch_all=True) or []
            except Exception as test_err:
                err = str(test_err).lower()
                if 'skill_test_attempts' not in err and 'does not exist' not in err:
                    print(f'[WARNING] Unexpected error fetching test attempts: {test_err}')

            for row in test_results:
                ad = row['activity_date']
                all_activities.append({
                    'studentName': row['student_name'],
                    'studentCode': row['student_code'],
                    'skillName':   row['skill_name'],
                    'score':       row.get('score'),
                    'passed':      row.get('passed'),
                    'attemptNum':  row.get('attempt_number'),
                    'date':        ad.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z' if ad else None,
                    'type':        'test',
                })

        all_activities.sort(key=lambda x: x['date'] if x['date'] else '', reverse=True)
        all_activities = all_activities[:limit]

        return jsonify({'success': True, 'activities': all_activities, 'total': len(all_activities)})
    except Exception as e:
        print(f"[ERROR] get_recent_activities: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500
