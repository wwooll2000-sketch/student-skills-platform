"""
Security Middleware for Student Skills Platform
حزمة الأمان الشاملة لمنصة مهارات الطلاب
"""

import os
import secrets
import hashlib
import redis
import bcrypt
import jwt
import pyotp
import qrcode
import bleach
import magic
from datetime import datetime, timedelta
from functools import wraps
from io import BytesIO
import base64
from flask import request, jsonify
from sqlalchemy import create_engine, text
from cryptography.fernet import Fernet
from werkzeug.utils import secure_filename
from PIL import Image
import re
import logging
from logging.handlers import RotatingFileHandler


# ==================== Database Security ====================

class SecureDatabase:
    """إدارة قاعدة البيانات الآمنة"""
    
    def __init__(self, connection_string):
        self.engine = create_engine(
            connection_string,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
            pool_recycle=3600,
            echo=False
        )
    
    def execute_safe_query(self, query, params=None):
        """تنفيذ استعلام آمن باستخدام المعاملات"""
        with self.engine.connect() as conn:
            if params:
                result = conn.execute(text(query), params)
            else:
                result = conn.execute(text(query))
            conn.commit()
            return result


class EncryptionManager:
    """إدارة التشفير"""
    
    def __init__(self, encryption_key=None):
        if encryption_key:
            self.cipher = Fernet(encryption_key.encode())
        else:
            self.cipher = Fernet(Fernet.generate_key())
    
    def hash_password(self, password):
        """تشفير كلمة المرور"""
        salt = bcrypt.gensalt(rounds=12)
        return bcrypt.hashpw(password.encode(), salt)
    
    def verify_password(self, password, hashed):
        """التحقق من كلمة المرور"""
        return bcrypt.checkpw(password.encode(), hashed)
    
    def encrypt_data(self, data):
        """تشفير البيانات"""
        if isinstance(data, str):
            data = data.encode()
        return self.cipher.encrypt(data)
    
    def decrypt_data(self, encrypted_data):
        """فك تشفير البيانات"""
        return self.cipher.decrypt(encrypted_data).decode()


# ==================== Authentication & Authorization ====================

class JWTManager:
    """إدارة JWT Tokens"""
    
    def __init__(self, secret_key, algorithm='HS256'):
        self.secret_key = secret_key
        self.algorithm = algorithm
        self.access_token_expire = timedelta(minutes=15)
        self.refresh_token_expire = timedelta(days=7)
        self.redis_client = redis.Redis(
            host=os.getenv('REDIS_HOST', 'localhost'),
            port=int(os.getenv('REDIS_PORT', 6379)),
            password=os.getenv('REDIS_PASSWORD'),
            decode_responses=True
        )
    
    def create_access_token(self, user_id, user_role):
        """إنشاء Access Token"""
        jti = secrets.token_urlsafe(32)
        payload = {
            'user_id': user_id,
            'role': user_role,
            'type': 'access',
            'exp': datetime.utcnow() + self.access_token_expire,
            'iat': datetime.utcnow(),
            'jti': jti
        }
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
    
    def create_refresh_token(self, user_id):
        """إنشاء Refresh Token"""
        jti = secrets.token_urlsafe(32)
        payload = {
            'user_id': user_id,
            'type': 'refresh',
            'exp': datetime.utcnow() + self.refresh_token_expire,
            'iat': datetime.utcnow(),
            'jti': jti
        }
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
    
    def verify_token(self, token):
        """التحقق من صحة Token"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            
            # تحقق من القائمة السوداء
            if self.redis_client.exists(f"blacklist:{payload['jti']}"):
                return None
            
            return payload
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None
    
    def blacklist_token(self, jti, expire_seconds):
        """إضافة Token للقائمة السوداء"""
        self.redis_client.setex(f"blacklist:{jti}", expire_seconds, "1")
    
    def refresh_access_token(self, refresh_token):
        """تجديد Access Token"""
        payload = self.verify_token(refresh_token)
        
        if not payload or payload.get('type') != 'refresh':
            return None
        
        # إنشاء access token جديد
        return self.create_access_token(
            payload['user_id'],
            payload.get('role', 'user')
        )


class RateLimiter:
    """حماية من Brute Force والطلبات المتكررة"""
    
    def __init__(self):
        self.redis_client = redis.Redis(
            host=os.getenv('REDIS_HOST', 'localhost'),
            port=int(os.getenv('REDIS_PORT', 6379)),
            password=os.getenv('REDIS_PASSWORD'),
            decode_responses=True
        )
    
    def check_login_attempts(self, username, max_attempts=5, window_minutes=15):
        """تحقق من محاولات تسجيل الدخول"""
        key = f"login_attempts:{username}"
        attempts = self.redis_client.get(key)
        
        if attempts and int(attempts) >= max_attempts:
            ttl = self.redis_client.ttl(key)
            return False, ttl
        
        return True, 0
    
    def record_failed_login(self, username, window_minutes=15):
        """تسجيل محاولة فاشلة"""
        key = f"login_attempts:{username}"
        pipe = self.redis_client.pipeline()
        pipe.incr(key)
        pipe.expire(key, window_minutes * 60)
        pipe.execute()
    
    def clear_login_attempts(self, username):
        """مسح المحاولات عند النجاح"""
        key = f"login_attempts:{username}"
        self.redis_client.delete(key)
    
    def check_rate_limit(self, identifier, max_requests=100, window_seconds=60):
        """فحص معدل الطلبات"""
        key = f"rate_limit:{identifier}"
        current = self.redis_client.get(key)
        
        if current and int(current) >= max_requests:
            return False
        
        pipe = self.redis_client.pipeline()
        pipe.incr(key)
        pipe.expire(key, window_seconds)
        pipe.execute()
        return True


class TwoFactorAuth:
    """المصادقة الثنائية"""
    
    def generate_secret(self):
        """إنشاء مفتاح سري"""
        return pyotp.random_base32()
    
    def generate_qr_code(self, username, secret, issuer_name="Student Skills Platform"):
        """إنشاء QR Code"""
        totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
            name=username,
            issuer_name=issuer_name
        )
        
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(totp_uri)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        buffered = BytesIO()
        img.save(buffered, format="PNG")
        
        return base64.b64encode(buffered.getvalue()).decode()
    
    def verify_otp(self, secret, otp_code):
        """التحقق من رمز OTP"""
        totp = pyotp.TOTP(secret)
        return totp.verify(otp_code, valid_window=1)
    
    def generate_backup_codes(self, count=10):
        """إنشاء رموز احتياطية"""
        return [secrets.token_hex(4).upper() for _ in range(count)]


# ==================== Application Security ====================

class XSSProtection:
    """حماية من XSS"""
    
    ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3']
    ALLOWED_ATTRIBUTES = {'a': ['href', 'title']}
    
    @staticmethod
    def sanitize_html(content):
        """تنظيف HTML"""
        return bleach.clean(
            content,
            tags=XSSProtection.ALLOWED_TAGS,
            attributes=XSSProtection.ALLOWED_ATTRIBUTES,
            strip=True
        )
    
    @staticmethod
    def validate_input(data, max_length=1000):
        """التحقق من المدخلات"""
        if not data:
            return None, "Input is required"
        
        if len(data) > max_length:
            return None, f"Input exceeds maximum length of {max_length}"
        
        cleaned = XSSProtection.sanitize_html(str(data))
        return cleaned, None


class CSRFProtection:
    """حماية من CSRF"""
    
    @staticmethod
    def generate_token():
        """إنشاء CSRF Token"""
        return secrets.token_urlsafe(32)
    
    @staticmethod
    def validate_token(token, session_token):
        """التحقق من CSRF Token"""
        return secrets.compare_digest(token, session_token)


class WebApplicationFirewall:
    """جدار حماية التطبيق"""
    
    SQL_INJECTION_PATTERNS = [
        r"(\bUNION\b.*\bSELECT\b)",
        r"(\bOR\b\s+\d+\s*=\s*\d+)",
        r"(--|\#|\/\*)",
        r"(\bDROP\b|\bDELETE\b|\bINSERT\b|\bUPDATE\b).*\bTABLE\b",
        r"(\bEXEC\b|\bEXECUTE\b)",
    ]
    
    XSS_PATTERNS = [
        r"<script[^>]*>.*?</script>",
        r"javascript:",
        r"onerror\s*=",
        r"onload\s*=",
        r"onclick\s*=",
    ]
    
    PATH_TRAVERSAL_PATTERNS = [
        r"\.\./",
        r"\.\.\\",
        r"%2e%2e",
    ]
    
    @staticmethod
    def check_sql_injection(value):
        """فحص SQL Injection"""
        if not isinstance(value, str):
            return False
        
        for pattern in WebApplicationFirewall.SQL_INJECTION_PATTERNS:
            if re.search(pattern, value, re.IGNORECASE):
                return True
        return False
    
    @staticmethod
    def check_xss(value):
        """فحص XSS"""
        if not isinstance(value, str):
            return False
        
        for pattern in WebApplicationFirewall.XSS_PATTERNS:
            if re.search(pattern, value, re.IGNORECASE):
                return True
        return False
    
    @staticmethod
    def check_path_traversal(value):
        """فحص Path Traversal"""
        if not isinstance(value, str):
            return False
        
        for pattern in WebApplicationFirewall.PATH_TRAVERSAL_PATTERNS:
            if re.search(pattern, value, re.IGNORECASE):
                return True
        return False
    
    @staticmethod
    def scan_request(data):
        """فحص الطلب"""
        if isinstance(data, dict):
            for key, value in data.items():
                str_value = str(value)
                if WebApplicationFirewall.check_sql_injection(str_value):
                    return 'SQL Injection attempt detected'
                if WebApplicationFirewall.check_xss(str_value):
                    return 'XSS attempt detected'
                if WebApplicationFirewall.check_path_traversal(str_value):
                    return 'Path Traversal attempt detected'
        return None


# ==================== File Upload Security ====================

class SecureFileUpload:
    """أمان رفع الملفات"""
    
    ALLOWED_EXTENSIONS = {
        'image': {'png', 'jpg', 'jpeg', 'gif'},
        'document': {'pdf', 'doc', 'docx', 'txt'},
    }
    
    ALLOWED_MIME_TYPES = {
        'image/png', 'image/jpeg', 'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
    }
    
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
    
    @staticmethod
    def allowed_file(filename, file_type='image'):
        """فحص امتداد الملف"""
        return '.' in filename and \
               filename.rsplit('.', 1)[1].lower() in SecureFileUpload.ALLOWED_EXTENSIONS.get(file_type, set())
    
    @staticmethod
    def verify_mime_type(file_path):
        """فحص نوع MIME الحقيقي"""
        try:
            mime = magic.Magic(mime=True)
            file_mime = mime.from_file(file_path)
            return file_mime in SecureFileUpload.ALLOWED_MIME_TYPES
        except:
            return False
    
    @staticmethod
    def generate_safe_filename(original_filename):
        """إنشاء اسم ملف آمن"""
        safe_name = secure_filename(original_filename)
        timestamp = str(datetime.now().timestamp())
        hash_value = hashlib.sha256(timestamp.encode()).hexdigest()[:12]
        
        name, ext = os.path.splitext(safe_name)
        return f"{name}_{hash_value}{ext}"
    
    @staticmethod
    def sanitize_image(file_path):
        """تنظيف الصور من البيانات الوصفية"""
        try:
            img = Image.open(file_path)
            data = list(img.getdata())
            image_without_exif = Image.new(img.mode, img.size)
            image_without_exif.putdata(data)
            image_without_exif.save(file_path)
            return True
        except:
            return False
    
    @staticmethod
    def validate_and_save(file, upload_folder, file_type='image'):
        """التحقق والحفظ"""
        if not file or file.filename == '':
            return None, "No file provided"
        
        if not SecureFileUpload.allowed_file(file.filename, file_type):
            return None, "File type not allowed"
        
        # فحص الحجم
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        if file_size > SecureFileUpload.MAX_FILE_SIZE:
            return None, f"File size exceeds {SecureFileUpload.MAX_FILE_SIZE / 1024 / 1024}MB"
        
        # حفظ الملف
        safe_filename = SecureFileUpload.generate_safe_filename(file.filename)
        file_path = os.path.join(upload_folder, safe_filename)
        
        os.makedirs(upload_folder, exist_ok=True)
        file.save(file_path)
        
        # فحص MIME
        if not SecureFileUpload.verify_mime_type(file_path):
            os.remove(file_path)
            return None, "Invalid file type"
        
        # تنظيف الصورة
        if file_type == 'image':
            if not SecureFileUpload.sanitize_image(file_path):
                os.remove(file_path)
                return None, "Failed to process image"
        
        os.chmod(file_path, 0o644)
        return safe_filename, None


# ==================== Security Logger ====================

class SecurityLogger:
    """نظام السجلات الأمني"""
    
    def __init__(self, app_name='student-skills-platform'):
        self.app_name = app_name
        self.setup_loggers()
    
    def setup_loggers(self):
        """إعداد السجلات"""
        os.makedirs('logs', exist_ok=True)
        
        # سجل الأمان
        security_handler = RotatingFileHandler(
            'logs/security.log',
            maxBytes=10 * 1024 * 1024,
            backupCount=10
        )
        security_handler.setLevel(logging.WARNING)
        security_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        security_handler.setFormatter(security_formatter)
        
        self.security_logger = logging.getLogger('security')
        self.security_logger.addHandler(security_handler)
        self.security_logger.setLevel(logging.WARNING)
        
        # سجل الوصول
        access_handler = RotatingFileHandler(
            'logs/access.log',
            maxBytes=10 * 1024 * 1024,
            backupCount=10
        )
        access_handler.setLevel(logging.INFO)
        access_formatter = logging.Formatter('%(asctime)s - %(message)s')
        access_handler.setFormatter(access_formatter)
        
        self.access_logger = logging.getLogger('access')
        self.access_logger.addHandler(access_handler)
        self.access_logger.setLevel(logging.INFO)
    
    def log_security_event(self, event_type, user_id, ip_address, details):
        """تسجيل حدث أمني"""
        import json
        log_data = {
            'timestamp': datetime.utcnow().isoformat(),
            'event_type': event_type,
            'user_id': user_id,
            'ip_address': ip_address,
            'details': details
        }
        self.security_logger.warning(json.dumps(log_data))
    
    def log_access(self, user_id, endpoint, method, status_code, ip_address):
        """تسجيل وصول"""
        import json
        log_data = {
            'timestamp': datetime.utcnow().isoformat(),
            'user_id': user_id,
            'endpoint': endpoint,
            'method': method,
            'status_code': status_code,
            'ip_address': ip_address
        }
        self.access_logger.info(json.dumps(log_data))


# ==================== Flask Decorators ====================

def token_required(roles=None):
    """ديكوريتر للتحقق من Token"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            token = request.headers.get('Authorization')
            
            if not token:
                return jsonify({'error': 'Token is missing'}), 401
            
            if token.startswith('Bearer '):
                token = token[7:]
            
            jwt_manager = JWTManager(os.getenv('JWT_SECRET_KEY'))
            payload = jwt_manager.verify_token(token)
            
            if not payload:
                return jsonify({'error': 'Token is invalid or expired'}), 401
            
            if roles and payload.get('role') not in roles:
                return jsonify({'error': 'Insufficient permissions'}), 403
            
            request.current_user = payload
            return f(*args, **kwargs)
        
        return decorated_function
    return decorator


def rate_limit(max_requests=100, window_seconds=60):
    """ديكوريتر لتحديد معدل الطلبات"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            identifier = request.remote_addr
            limiter = RateLimiter()
            
            if not limiter.check_rate_limit(identifier, max_requests, window_seconds):
                return jsonify({'error': 'Rate limit exceeded'}), 429
            
            return f(*args, **kwargs)
        
        return decorated_function
    return decorator


# ==================== Security Headers ====================

class SecurityHeaders:
    """رؤوس الأمان"""
    
    @staticmethod
    def add_security_headers(response):
        """إضافة رؤوس الأمان"""
        response.headers['Content-Security-Policy'] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self'; "
            "connect-src 'self'; "
            "frame-ancestors 'none';"
        )
        
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        
        return response
