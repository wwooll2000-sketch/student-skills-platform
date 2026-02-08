# Health Check and Static Routes
from flask import Blueprint, jsonify, send_from_directory
from datetime import datetime

health_bp = Blueprint('health', __name__)

@health_bp.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
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
