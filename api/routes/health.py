# Health Check and Static Routes
from flask import Blueprint, jsonify, send_from_directory
from datetime import datetime
import os

health_bp = Blueprint('health', __name__)

@health_bp.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'success': True, 
        'message': 'الخادم يعمل بشكل صحيح', 
        'timestamp': datetime.now().isoformat()
    })

@health_bp.route('/api/debug', methods=['GET'])
def debug_info():
    """Debug endpoint to check environment"""
    return jsonify({
        'success': True,
        'has_database_url': bool(os.environ.get('DATABASE_URL')),
        'has_jwt_secret': bool(os.environ.get('JWT_SECRET')),
        'has_admin_password': bool(os.environ.get('ADMIN_PASSWORD')),
        'python_path': os.environ.get('PYTHONPATH', 'not set'),
        'cwd': os.getcwd(),
        'timestamp': datetime.now().isoformat()
    })

@health_bp.route('/api/init-db', methods=['POST'])
def init_db_endpoint():
    """Initialize database tables - call this once after deployment"""
    try:
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
        from database import init_database
        
        init_database()
        return jsonify({
            'success': True,
            'message': 'Database initialized successfully'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Database initialization failed: {str(e)}'
        }), 500

@health_bp.route('/api/settings/column-visibility', methods=['GET'])
def get_column_visibility():
    """Public endpoint: get teacher's column visibility settings (used by student view)"""
    try:
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from database import execute_query
        teacher = execute_query(
            'SELECT column_visibility FROM teacher LIMIT 1',
            fetch_one=True
        )
        visibility = {}
        if teacher and teacher.get('column_visibility'):
            visibility = teacher['column_visibility']
        return jsonify({'success': True, 'column_visibility': visibility})
    except Exception:
        return jsonify({'success': True, 'column_visibility': {}})


@health_bp.route('/api/settings/badge-display-mode', methods=['GET'])
def get_badge_display_mode():
    """Public endpoint: get badge display mode (used by student view)"""
    try:
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from database import execute_query
        teacher = execute_query(
            'SELECT badge_display_mode FROM teacher LIMIT 1',
            fetch_one=True
        )
        mode = 'show_all'
        if teacher and teacher.get('badge_display_mode'):
            mode = teacher['badge_display_mode']
        return jsonify({'success': True, 'mode': mode})
    except Exception:
        return jsonify({'success': True, 'mode': 'show_all'})


@health_bp.route('/')
def serve_index():
    """Serve index.html"""
    return send_from_directory('..', 'index.html')

@health_bp.route('/<path:path>')
def serve_static(path):
    """Serve static files"""
    return send_from_directory('..', path)
