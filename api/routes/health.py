# Health Check and Static Routes
from flask import Blueprint, jsonify, send_from_directory
from datetime import datetime
import sys
import os

# Add parent directory to path to import database module
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from database import init_database

health_bp = Blueprint('health', __name__)

# Track if database has been initialized
_db_initialized = False

@health_bp.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    global _db_initialized
    
    # Lazy database initialization on first health check
    if not _db_initialized:
        try:
            init_database()
            _db_initialized = True
        except Exception as e:
            print(f"⚠️ Database initialization skipped or failed: {e}")
            # Continue anyway - tables might already exist
    
    return jsonify({
        'success': True, 
        'message': 'الخادم يعمل بشكل صحيح', 
        'timestamp': datetime.now().isoformat()
    })

@health_bp.route('/')
def serve_index():
    """Serve index.html"""
    return send_from_directory('..', 'index.html')

@health_bp.route('/<path:path>')
def serve_static(path):
    """Serve static files"""
    return send_from_directory('..', path)
