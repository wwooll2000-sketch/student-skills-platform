"""
Secure Flask Application Example
مثال لتطبيق Flask آمن مع جميع إجراءات الحماية
"""

import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# استيراد حزمة الأمان
from security_middleware import (
    JWTManager,
    RateLimiter,
    XSSProtection,
    CSRFProtection,
    WebApplicationFirewall,
    SecureFileUpload,
    SecurityLogger,
    SecurityHeaders,
    EncryptionManager,
    TwoFactorAuth,
    token_required,
    rate_limit
)

# تحميل متغيرات البيئة
load_dotenv()

# إنشاء التطبيق
app = Flask(__name__)

# الإعدادات الأساسية
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10MB
app.config['UPLOAD_FOLDER'] = 'uploads'

# تفعيل CORS بشكل آمن
CORS(app, resources={
    r"/api/*": {
        "origins": os.getenv('ALLOWED_ORIGINS', 'http://localhost:3000').split(','),
        "methods": ["GET", "POST", "PUT", "DELETE"],
        "allow_headers": ["Content-Type", "Authorization", "X-CSRF-Token"],
        "supports_credentials": True
    }
})

# تهيئة المكونات الأمنية
jwt_manager = JWTManager(os.getenv('JWT_SECRET_KEY'))
rate_limiter = RateLimiter()
encryption_manager = EncryptionManager(os.getenv('ENCRYPTION_KEY'))
security_logger = SecurityLogger()
two_factor_auth = TwoFactorAuth()


# ==================== Middleware ====================

@app.before_request
def before_request_handler():
    """معالج ما قبل الطلب"""
    
    # فحص WAF
    if request.method in ['POST', 'PUT', 'PATCH']:
        # فحص JSON
        if request.is_json:
            threat = WebApplicationFirewall.scan_request(request.get_json())
            if threat:
                security_logger.log_security_event(
                    'WAF_BLOCKED',
                    'unknown',
                    request.remote_addr,
                    {'threat': threat}
                )
                return jsonify({'error': 'Request blocked by security policy'}), 403
        
        # فحص Form Data
        if request.form:
            threat = WebApplicationFirewall.scan_request(dict(request.form))
            if threat:
                security_logger.log_security_event(
                    'WAF_BLOCKED',
                    'unknown',
                    request.remote_addr,
                    {'threat': threat}
                )
                return jsonify({'error': 'Request blocked by security policy'}), 403
    
    # فحص Query Parameters
    threat = WebApplicationFirewall.scan_request(dict(request.args))
    if threat:
        security_logger.log_security_event(
            'WAF_BLOCKED',
            'unknown',
            request.remote_addr,
            {'threat': threat}
        )
        return jsonify({'error': 'Request blocked by security policy'}), 403


@app.after_request
def after_request_handler(response):
    """معالج ما بعد الطلب"""
    
    # إضافة رؤوس الأمان
    response = SecurityHeaders.add_security_headers(response)
    
    # تسجيل الوصول
    user_id = getattr(request, 'current_user', {}).get('user_id', 'anonymous')
    security_logger.log_access(
        user_id,
        request.endpoint,
        request.method,
        response.status_code,
        request.remote_addr
    )
    
    return response


# ==================== Authentication Routes ====================

@app.route('/api/auth/register', methods=['POST'])
@rate_limit(max_requests=5, window_seconds=300)  # 5 طلبات كل 5 دقائق
def register():
    """تسجيل مستخدم جديد"""
    try:
        data = request.get_json()
        
        # التحقق من البيانات
        username, error = XSSProtection.validate_input(data.get('username'), max_length=50)
        if error:
            return jsonify({'error': f'Username: {error}'}), 400
        
        email = data.get('email')
        if not email or '@' not in email:
            return jsonify({'error': 'Invalid email'}), 400
        
        password = data.get('password')
        if not password or len(password) < 8:
            return jsonify({'error': 'Password must be at least 8 characters'}), 400
        
        # تشفير كلمة المرور
        hashed_password = encryption_manager.hash_password(password)
        
        # حفظ في قاعدة البيانات (مثال)
        # user_id = save_user_to_database(username, email, hashed_password)
        
        security_logger.log_security_event(
            'USER_REGISTERED',
            username,
            request.remote_addr,
            {'email': email}
        )
        
        return jsonify({
            'message': 'User registered successfully',
            'username': username
        }), 201
        
    except Exception as e:
        app.logger.error(f"Registration error: {str(e)}")
        return jsonify({'error': 'Registration failed'}), 500


@app.route('/api/auth/login', methods=['POST'])
@rate_limit(max_requests=10, window_seconds=300)  # 10 محاولات كل 5 دقائق
def login():
    """تسجيل الدخول"""
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({'error': 'Username and password are required'}), 400
        
        # التحقق من Rate Limiting
        allowed, ttl = rate_limiter.check_login_attempts(username)
        if not allowed:
            security_logger.log_security_event(
                'LOGIN_RATE_LIMITED',
                username,
                request.remote_addr,
                {'ttl': ttl}
            )
            return jsonify({
                'error': f'Too many login attempts. Try again in {ttl} seconds'
            }), 429
        
        # التحقق من المستخدم (مثال)
        # user = get_user_from_database(username)
        # if not user or not encryption_manager.verify_password(password, user.password):
        #     rate_limiter.record_failed_login(username)
        #     security_logger.log_security_event(
        #         'FAILED_LOGIN',
        #         username,
        #         request.remote_addr,
        #         {'reason': 'Invalid credentials'}
        #     )
        #     return jsonify({'error': 'Invalid credentials'}), 401
        
        # في حالة النجاح (مثال)
        user_id = 1  # استبدل بـ user.id الحقيقي
        user_role = 'student'  # استبدل بـ user.role الحقيقي
        
        rate_limiter.clear_login_attempts(username)
        
        # إنشاء Tokens
        access_token = jwt_manager.create_access_token(user_id, user_role)
        refresh_token = jwt_manager.create_refresh_token(user_id)
        
        security_logger.log_security_event(
            'SUCCESSFUL_LOGIN',
            user_id,
            request.remote_addr,
            {'username': username}
        )
        
        return jsonify({
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': {
                'id': user_id,
                'username': username,
                'role': user_role
            }
        }), 200
        
    except Exception as e:
        app.logger.error(f"Login error: {str(e)}")
        return jsonify({'error': 'Login failed'}), 500


@app.route('/api/auth/refresh', methods=['POST'])
def refresh_token():
    """تجديد Access Token"""
    try:
        data = request.get_json()
        refresh_token = data.get('refresh_token')
        
        if not refresh_token:
            return jsonify({'error': 'Refresh token is required'}), 400
        
        new_access_token = jwt_manager.refresh_access_token(refresh_token)
        
        if not new_access_token:
            return jsonify({'error': 'Invalid refresh token'}), 401
        
        return jsonify({
            'access_token': new_access_token
        }), 200
        
    except Exception as e:
        app.logger.error(f"Token refresh error: {str(e)}")
        return jsonify({'error': 'Token refresh failed'}), 500


@app.route('/api/auth/logout', methods=['POST'])
@token_required()
def logout():
    """تسجيل الخروج"""
    try:
        jti = request.current_user.get('jti')
        exp = request.current_user.get('exp')
        
        if jti and exp:
            # إضافة Token للقائمة السوداء
            expire_seconds = int(exp - datetime.utcnow().timestamp())
            if expire_seconds > 0:
                jwt_manager.blacklist_token(jti, expire_seconds)
        
        security_logger.log_security_event(
            'USER_LOGOUT',
            request.current_user.get('user_id'),
            request.remote_addr,
            {}
        )
        
        return jsonify({'message': 'Logged out successfully'}), 200
        
    except Exception as e:
        app.logger.error(f"Logout error: {str(e)}")
        return jsonify({'error': 'Logout failed'}), 500


# ==================== 2FA Routes ====================

@app.route('/api/auth/2fa/enable', methods=['POST'])
@token_required()
def enable_2fa():
    """تفعيل المصادقة الثنائية"""
    try:
        user_id = request.current_user['user_id']
        
        # إنشاء السر
        secret = two_factor_auth.generate_secret()
        
        # حفظ السر في قاعدة البيانات (مشفر)
        # encrypted_secret = encryption_manager.encrypt_data(secret)
        # save_2fa_secret(user_id, encrypted_secret)
        
        # إنشاء QR Code
        # username = get_username(user_id)
        qr_code = two_factor_auth.generate_qr_code('user@example.com', secret)
        
        # إنشاء رموز احتياطية
        backup_codes = two_factor_auth.generate_backup_codes()
        # save_backup_codes(user_id, backup_codes)
        
        return jsonify({
            'qr_code': qr_code,
            'secret': secret,  # أرسل السر للمستخدم ليحفظه يدوياً كنسخة احتياطية
            'backup_codes': backup_codes
        }), 200
        
    except Exception as e:
        app.logger.error(f"2FA enable error: {str(e)}")
        return jsonify({'error': 'Failed to enable 2FA'}), 500


@app.route('/api/auth/2fa/verify', methods=['POST'])
@token_required()
def verify_2fa():
    """التحقق من رمز 2FA"""
    try:
        data = request.get_json()
        otp_code = data.get('otp_code')
        user_id = request.current_user['user_id']
        
        if not otp_code:
            return jsonify({'error': 'OTP code is required'}), 400
        
        # الحصول على السر من قاعدة البيانات
        # encrypted_secret = get_2fa_secret(user_id)
        # secret = encryption_manager.decrypt_data(encrypted_secret)
        secret = "EXAMPLE_SECRET"  # استبدل بالسر الحقيقي
        
        if two_factor_auth.verify_otp(secret, otp_code):
            # تفعيل 2FA للمستخدم
            # enable_2fa_for_user(user_id)
            
            security_logger.log_security_event(
                '2FA_VERIFIED',
                user_id,
                request.remote_addr,
                {}
            )
            
            return jsonify({'message': '2FA verified and enabled'}), 200
        else:
            security_logger.log_security_event(
                '2FA_VERIFICATION_FAILED',
                user_id,
                request.remote_addr,
                {}
            )
            return jsonify({'error': 'Invalid OTP code'}), 400
        
    except Exception as e:
        app.logger.error(f"2FA verify error: {str(e)}")
        return jsonify({'error': 'Verification failed'}), 500


# ==================== File Upload Routes ====================

@app.route('/api/upload/image', methods=['POST'])
@token_required()
@rate_limit(max_requests=20, window_seconds=3600)  # 20 رفع في الساعة
def upload_image():
    """رفع صورة"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        user_id = request.current_user['user_id']
        
        # إنشاء مجلد للمستخدم
        upload_folder = os.path.join(app.config['UPLOAD_FOLDER'], 'images', str(user_id))
        
        # التحقق والحفظ
        filename, error = SecureFileUpload.validate_and_save(
            file,
            upload_folder,
            file_type='image'
        )
        
        if error:
            security_logger.log_security_event(
                'FILE_UPLOAD_REJECTED',
                user_id,
                request.remote_addr,
                {'error': error, 'filename': file.filename}
            )
            return jsonify({'error': error}), 400
        
        file_url = f"/uploads/images/{user_id}/{filename}"
        
        # حفظ معلومات الملف في قاعدة البيانات
        # save_file_info(user_id, filename, file_url)
        
        security_logger.log_security_event(
            'FILE_UPLOADED',
            user_id,
            request.remote_addr,
            {'filename': filename, 'type': 'image'}
        )
        
        return jsonify({
            'message': 'File uploaded successfully',
            'filename': filename,
            'url': file_url
        }), 201
        
    except Exception as e:
        app.logger.error(f"File upload error: {str(e)}")
        return jsonify({'error': 'Upload failed'}), 500


# ==================== Protected Routes ====================

@app.route('/api/profile', methods=['GET'])
@token_required()
def get_profile():
    """الحصول على الملف الشخصي"""
    try:
        user_id = request.current_user['user_id']
        
        # الحصول على بيانات المستخدم من قاعدة البيانات
        # user_data = get_user_profile(user_id)
        
        return jsonify({
            'user_id': user_id,
            'role': request.current_user['role'],
            # ...بيانات أخرى
        }), 200
        
    except Exception as e:
        app.logger.error(f"Profile error: {str(e)}")
        return jsonify({'error': 'Failed to get profile'}), 500


@app.route('/api/admin/users', methods=['GET'])
@token_required(roles=['admin'])  # فقط للمشرفين
def get_all_users():
    """الحصول على جميع المستخدمين (للمشرفين فقط)"""
    try:
        # الحصول على جميع المستخدمين من قاعدة البيانات
        # users = get_all_users_from_database()
        
        return jsonify({
            'users': []  # قائمة المستخدمين
        }), 200
        
    except Exception as e:
        app.logger.error(f"Admin users error: {str(e)}")
        return jsonify({'error': 'Failed to get users'}), 500


# ==================== Health Check ====================

@app.route('/health', methods=['GET'])
def health_check():
    """فحص صحة التطبيق"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat()
    }), 200


# ==================== Error Handlers ====================

@app.errorhandler(400)
def bad_request(error):
    return jsonify({'error': 'Bad request'}), 400


@app.errorhandler(401)
def unauthorized(error):
    return jsonify({'error': 'Unauthorized'}), 401


@app.errorhandler(403)
def forbidden(error):
    return jsonify({'error': 'Forbidden'}), 403


@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404


@app.errorhandler(429)
def rate_limit_exceeded(error):
    return jsonify({'error': 'Rate limit exceeded'}), 429


@app.errorhandler(500)
def internal_error(error):
    app.logger.error(f"Internal error: {str(error)}")
    return jsonify({'error': 'Internal server error'}), 500


# ==================== Main ====================

if __name__ == '__main__':
    # التأكد من وجود متغيرات البيئة
    required_vars = ['JWT_SECRET_KEY', 'SECRET_KEY', 'ENCRYPTION_KEY']
    missing = [var for var in required_vars if not os.getenv(var)]
    
    if missing:
        print(f"Error: Missing required environment variables: {', '.join(missing)}")
        exit(1)
    
    # تشغيل التطبيق
    # في الإنتاج، استخدم Gunicorn أو uWSGI
    app.run(
        host='0.0.0.0',
        port=int(os.getenv('PORT', 5000)),
        debug=os.getenv('FLASK_ENV') != 'production'
    )
