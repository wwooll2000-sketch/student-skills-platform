# Authentication Middleware
import jwt
from functools import wraps
from flask import request, jsonify
import os

JWT_SECRET = os.environ.get('JWT_SECRET', '81d2c2e604b17872e26e6ed8d57dcad56cd39b252a9099430411ed63a70af565')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')

def verify_admin(f):
    """Decorator to verify admin authentication"""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        token = auth_header.replace('Bearer ', '')
        
        if not token:
            return jsonify({'success': False, 'message': 'غير مصرح - لا يوجد رمز'}), 401
        
        try:
            decoded = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        except jwt.ExpiredSignatureError:
            return jsonify({'success': False, 'message': 'غير مصرح - انتهت صلاحية الرمز'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'success': False, 'message': 'غير مصرح - رمز غير صالح'}), 401
        
        # Token is valid, proceed with the route handler
        return f(*args, **kwargs)
    return decorated

def get_jwt_secret():
    """Get JWT secret key"""
    return JWT_SECRET

def get_admin_password():
    """Get admin password"""
    return ADMIN_PASSWORD
