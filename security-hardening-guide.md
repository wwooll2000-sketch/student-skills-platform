# دليل تقوية الأمان الشامل لمنصة مهارات الطلاب
## Security Hardening Guide for Student Skills Platform

---

## 📋 فهرس المحتويات

1. [أمان قاعدة البيانات](#database-security)
2. [أمان المصادقة والتفويض](#authentication-authorization)
3. [أمان التطبيق](#application-security)
4. [أمان الشبكة](#network-security)
5. [أمان الملفات المرفوعة](#file-upload-security)
6. [الحماية من الهجمات الشائعة](#common-attacks-protection)
7. [المراقبة والسجلات](#monitoring-logging)
8. [النسخ الاحتياطي والاستعادة](#backup-recovery)

---

## 🔐 1. أمان قاعدة البيانات {#database-security}

### 1.1 منع SQL Injection

**الثغرة:** استخدام استعلامات SQL مباشرة مع بيانات المستخدم

**الحل:**
```python
# ❌ خطأ - عرضة لـ SQL Injection
query = f"SELECT * FROM users WHERE username = '{username}'"

# ✅ صحيح - استخدام Parameterized Queries
query = "SELECT * FROM users WHERE username = %s"
cursor.execute(query, (username,))

# ✅ أو استخدام ORM
from sqlalchemy import text
result = session.execute(text("SELECT * FROM users WHERE username = :username"), 
                        {"username": username})
```

### 1.2 تشفير البيانات الحساسة

```python
from cryptography.fernet import Fernet
import hashlib
import secrets

class SecureDataHandler:
    def __init__(self):
        # استخدم متغير بيئة للمفتاح
        self.encryption_key = os.getenv('ENCRYPTION_KEY').encode()
        self.cipher = Fernet(self.encryption_key)
    
    def hash_password(self, password):
        """تشفير كلمة المرور باستخدام bcrypt"""
        import bcrypt
        salt = bcrypt.gensalt(rounds=12)
        return bcrypt.hashpw(password.encode(), salt)
    
    def verify_password(self, password, hashed):
        """التحقق من كلمة المرور"""
        import bcrypt
        return bcrypt.checkpw(password.encode(), hashed)
    
    def encrypt_sensitive_data(self, data):
        """تشفير البيانات الحساسة"""
        return self.cipher.encrypt(data.encode())
    
    def decrypt_sensitive_data(self, encrypted_data):
        """فك تشفير البيانات"""
        return self.cipher.decrypt(encrypted_data).decode()
```

### 1.3 إعدادات قاعدة البيانات الآمنة

```python
# config/database.py
import os
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool

DATABASE_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 5432)),
    'database': os.getenv('DB_NAME'),
    'user': os.getenv('DB_USER'),
    'password': os.getenv('DB_PASSWORD'),
    'sslmode': 'require',  # فرض SSL
    'connect_timeout': 10,
    'options': '-c statement_timeout=30000'  # حد زمني للاستعلامات
}

# إنشاء محرك قاعدة البيانات بشكل آمن
engine = create_engine(
    f"postgresql://{DATABASE_CONFIG['user']}:{DATABASE_CONFIG['password']}@"
    f"{DATABASE_CONFIG['host']}:{DATABASE_CONFIG['port']}/{DATABASE_CONFIG['database']}",
    pool_pre_ping=True,  # التحقق من الاتصال قبل الاستخدام
    pool_size=5,
    max_overflow=10,
    pool_recycle=3600,  # إعادة تدوير الاتصالات كل ساعة
    echo=False  # تعطيل طباعة SQL في الإنتاج
)
```

---

## 🔑 2. أمان المصادقة والتفويض {#authentication-authorization}

### 2.1 نظام JWT آمن

```python
from datetime import datetime, timedelta
import jwt
from functools import wraps
from flask import request, jsonify

class SecureAuthManager:
    def __init__(self, secret_key, algorithm='HS256'):
        self.secret_key = secret_key
        self.algorithm = algorithm
        self.access_token_expire = timedelta(minutes=15)
        self.refresh_token_expire = timedelta(days=7)
    
    def create_access_token(self, user_id, user_role):
        """إنشاء Access Token"""
        payload = {
            'user_id': user_id,
            'role': user_role,
            'type': 'access',
            'exp': datetime.utcnow() + self.access_token_expire,
            'iat': datetime.utcnow(),
            'jti': secrets.token_urlsafe(32)  # معرف فريد للتوكن
        }
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
    
    def create_refresh_token(self, user_id):
        """إنشاء Refresh Token"""
        payload = {
            'user_id': user_id,
            'type': 'refresh',
            'exp': datetime.utcnow() + self.refresh_token_expire,
            'iat': datetime.utcnow(),
            'jti': secrets.token_urlsafe(32)
        }
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
    
    def verify_token(self, token):
        """التحقق من صحة التوكن"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            # تحقق من أن التوكن ليس في القائمة السوداء
            if self.is_token_blacklisted(payload['jti']):
                return None
            return payload
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None
    
    def is_token_blacklisted(self, jti):
        """تحقق من القائمة السوداء للتوكنات (استخدم Redis)"""
        # تنفيذ مع Redis
        import redis
        r = redis.Redis(host='localhost', port=6379, db=0)
        return r.exists(f"blacklist:{jti}")
    
    def blacklist_token(self, jti, expire_time):
        """إضافة توكن للقائمة السوداء"""
        import redis
        r = redis.Redis(host='localhost', port=6379, db=0)
        r.setex(f"blacklist:{jti}", expire_time, "1")

def token_required(roles=None):
    """ديكوريتر للتحقق من التوكن والصلاحيات"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            token = request.headers.get('Authorization')
            
            if not token:
                return jsonify({'error': 'Token is missing'}), 401
            
            try:
                # إزالة "Bearer " من بداية التوكن
                if token.startswith('Bearer '):
                    token = token[7:]
                
                auth_manager = SecureAuthManager(os.getenv('JWT_SECRET_KEY'))
                payload = auth_manager.verify_token(token)
                
                if not payload:
                    return jsonify({'error': 'Token is invalid or expired'}), 401
                
                # التحقق من الصلاحيات
                if roles and payload['role'] not in roles:
                    return jsonify({'error': 'Insufficient permissions'}), 403
                
                # إضافة معلومات المستخدم للطلب
                request.current_user = payload
                
            except Exception as e:
                return jsonify({'error': 'Authentication failed'}), 401
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator
```

### 2.2 حماية ضد Brute Force

```python
from datetime import datetime, timedelta
from flask import request
import redis

class RateLimiter:
    def __init__(self, redis_client):
        self.redis = redis_client
    
    def check_login_attempts(self, username, max_attempts=5, window_minutes=15):
        """تحقق من عدد محاولات تسجيل الدخول"""
        key = f"login_attempts:{username}"
        attempts = self.redis.get(key)
        
        if attempts and int(attempts) >= max_attempts:
            ttl = self.redis.ttl(key)
            return False, ttl  # الحساب محظور
        
        return True, 0
    
    def record_failed_login(self, username, window_minutes=15):
        """تسجيل محاولة فاشلة"""
        key = f"login_attempts:{username}"
        pipe = self.redis.pipeline()
        pipe.incr(key)
        pipe.expire(key, window_minutes * 60)
        pipe.execute()
    
    def clear_login_attempts(self, username):
        """مسح محاولات تسجيل الدخول عند النجاح"""
        key = f"login_attempts:{username}"
        self.redis.delete(key)
    
    def check_rate_limit(self, identifier, max_requests=100, window_seconds=60):
        """حد معدل الطلبات العام"""
        key = f"rate_limit:{identifier}"
        current = self.redis.get(key)
        
        if current and int(current) >= max_requests:
            return False
        
        pipe = self.redis.pipeline()
        pipe.incr(key)
        pipe.expire(key, window_seconds)
        pipe.execute()
        return True

# استخدام في Flask
@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    # التحقق من Rate Limiting
    rate_limiter = RateLimiter(redis_client)
    allowed, ttl = rate_limiter.check_login_attempts(username)
    
    if not allowed:
        return jsonify({
            'error': f'Too many login attempts. Try again in {ttl} seconds'
        }), 429
    
    # محاولة تسجيل الدخول
    user = authenticate_user(username, password)
    
    if not user:
        rate_limiter.record_failed_login(username)
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # نجح تسجيل الدخول
    rate_limiter.clear_login_attempts(username)
    
    # إنشاء التوكنات
    auth_manager = SecureAuthManager(os.getenv('JWT_SECRET_KEY'))
    access_token = auth_manager.create_access_token(user.id, user.role)
    refresh_token = auth_manager.create_refresh_token(user.id)
    
    return jsonify({
        'access_token': access_token,
        'refresh_token': refresh_token
    }), 200
```

### 2.3 المصادقة الثنائية (2FA)

```python
import pyotp
import qrcode
from io import BytesIO
import base64

class TwoFactorAuth:
    def generate_secret(self):
        """إنشاء مفتاح سري للمستخدم"""
        return pyotp.random_base32()
    
    def generate_qr_code(self, username, secret, issuer_name="Student Skills Platform"):
        """إنشاء QR Code للمصادقة الثنائية"""
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
        return [secrets.token_hex(4) for _ in range(count)]

# استخدام في التطبيق
@app.route('/enable-2fa', methods=['POST'])
@token_required()
def enable_2fa():
    user_id = request.current_user['user_id']
    
    tfa = TwoFactorAuth()
    secret = tfa.generate_secret()
    
    # حفظ السر في قاعدة البيانات (مشفر)
    save_2fa_secret(user_id, secret)
    
    # إنشاء QR Code
    qr_code = tfa.generate_qr_code(get_username(user_id), secret)
    
    # إنشاء رموز احتياطية
    backup_codes = tfa.generate_backup_codes()
    save_backup_codes(user_id, backup_codes)
    
    return jsonify({
        'qr_code': qr_code,
        'backup_codes': backup_codes
    }), 200
```

---

## 🛡️ 3. أمان التطبيق {#application-security}

### 3.1 الحماية من XSS (Cross-Site Scripting)

```python
import html
import bleach
from markupsafe import escape

class XSSProtection:
    # القائمة البيضاء للوسوم المسموحة
    ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li']
    ALLOWED_ATTRIBUTES = {'a': ['href', 'title']}
    
    @staticmethod
    def sanitize_html(content):
        """تنظيف HTML من أكواد خبيثة"""
        cleaned = bleach.clean(
            content,
            tags=XSSProtection.ALLOWED_TAGS,
            attributes=XSSProtection.ALLOWED_ATTRIBUTES,
            strip=True
        )
        return cleaned
    
    @staticmethod
    def escape_output(text):
        """تحويل الأحرف الخاصة إلى HTML entities"""
        return escape(text)
    
    @staticmethod
    def validate_input(data, field_name, max_length=1000):
        """التحقق من صحة المدخلات"""
        if not data:
            return None, "Field is required"
        
        if len(data) > max_length:
            return None, f"Field exceeds maximum length of {max_length}"
        
        # إزالة الأحرف الخبيثة
        cleaned = XSSProtection.sanitize_html(data)
        return cleaned, None

# استخدام في Flask
from flask import Flask, render_template_string

app = Flask(__name__)

@app.route('/post/create', methods=['POST'])
@token_required()
def create_post():
    data = request.get_json()
    content = data.get('content', '')
    
    # تنظيف المحتوى
    cleaned_content, error = XSSProtection.validate_input(content, 'content', 5000)
    
    if error:
        return jsonify({'error': error}), 400
    
    # حفظ في قاعدة البيانات
    save_post(cleaned_content)
    
    return jsonify({'message': 'Post created successfully'}), 201
```

### 3.2 الحماية من CSRF (Cross-Site Request Forgery)

```python
from flask_wtf.csrf import CSRFProtect, generate_csrf
import secrets

# تفعيل CSRF Protection
csrf = CSRFProtect(app)

class CSRFTokenManager:
    @staticmethod
    def generate_token():
        """إنشاء توكن CSRF"""
        return secrets.token_urlsafe(32)
    
    @staticmethod
    def validate_token(token, session_token):
        """التحقق من صحة توكن CSRF"""
        return secrets.compare_digest(token, session_token)

# إضافة CSRF token للردود
@app.after_request
def add_csrf_token(response):
    if request.method in ['GET', 'HEAD', 'OPTIONS', 'TRACE']:
        response.set_cookie(
            'csrf_token',
            generate_csrf(),
            secure=True,
            httponly=True,
            samesite='Strict'
        )
    return response

# التحقق من CSRF في الطلبات
@app.before_request
def check_csrf_token():
    if request.method not in ['GET', 'HEAD', 'OPTIONS', 'TRACE']:
        token = request.headers.get('X-CSRF-Token')
        cookie_token = request.cookies.get('csrf_token')
        
        if not token or not cookie_token:
            return jsonify({'error': 'CSRF token missing'}), 403
        
        if not CSRFTokenManager.validate_token(token, cookie_token):
            return jsonify({'error': 'Invalid CSRF token'}), 403
```

### 3.3 Content Security Policy (CSP)

```python
from flask import Response

class SecurityHeaders:
    @staticmethod
    def add_security_headers(response):
        """إضافة رؤوس الأمان"""
        # Content Security Policy
        response.headers['Content-Security-Policy'] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: https:; "
            "connect-src 'self'; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self';"
        )
        
        # منع Clickjacking
        response.headers['X-Frame-Options'] = 'DENY'
        
        # منع MIME type sniffing
        response.headers['X-Content-Type-Options'] = 'nosniff'
        
        # تفعيل XSS Protection
        response.headers['X-XSS-Protection'] = '1; mode=block'
        
        # HTTPS فقط
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        
        # التحكم في Referrer
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        
        # Permissions Policy
        response.headers['Permissions-Policy'] = (
            "geolocation=(), "
            "microphone=(), "
            "camera=(), "
            "payment=(), "
            "usb=()"
        )
        
        return response

# تطبيق على جميع الردود
@app.after_request
def apply_security_headers(response):
    return SecurityHeaders.add_security_headers(response)
```

---

## 📁 4. أمان الملفات المرفوعة {#file-upload-security}

```python
import os
import magic
from werkzeug.utils import secure_filename
from PIL import Image
import hashlib

class SecureFileUpload:
    # أنواع الملفات المسموحة
    ALLOWED_EXTENSIONS = {
        'image': {'png', 'jpg', 'jpeg', 'gif'},
        'document': {'pdf', 'doc', 'docx', 'txt'},
        'archive': {'zip'}
    }
    
    # أنواع MIME المسموحة
    ALLOWED_MIME_TYPES = {
        'image/png', 'image/jpeg', 'image/gif',
        'application/pdf', 
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }
    
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
    
    @staticmethod
    def allowed_file(filename, file_type='image'):
        """التحقق من امتداد الملف"""
        return '.' in filename and \
               filename.rsplit('.', 1)[1].lower() in SecureFileUpload.ALLOWED_EXTENSIONS[file_type]
    
    @staticmethod
    def verify_mime_type(file_path):
        """التحقق من نوع MIME الحقيقي"""
        mime = magic.Magic(mime=True)
        file_mime = mime.from_file(file_path)
        return file_mime in SecureFileUpload.ALLOWED_MIME_TYPES
    
    @staticmethod
    def generate_safe_filename(original_filename):
        """إنشاء اسم ملف آمن"""
        # استخدام secure_filename لتنظيف الاسم
        safe_name = secure_filename(original_filename)
        
        # إضافة hash فريد
        timestamp = str(datetime.now().timestamp())
        hash_value = hashlib.sha256(timestamp.encode()).hexdigest()[:12]
        
        name, ext = os.path.splitext(safe_name)
        return f"{name}_{hash_value}{ext}"
    
    @staticmethod
    def scan_for_malware(file_path):
        """فحص الملف من الفيروسات (يتطلب ClamAV)"""
        try:
            import pyclamd
            cd = pyclamd.ClamdUnixSocket()
            scan_result = cd.scan_file(file_path)
            return scan_result is None  # None يعني نظيف
        except:
            # إذا لم يكن ClamAV متاحاً، ارجع True
            return True
    
    @staticmethod
    def sanitize_image(file_path):
        """تنظيف الصور من البيانات الوصفية الخطرة"""
        try:
            img = Image.open(file_path)
            
            # إزالة EXIF data
            data = list(img.getdata())
            image_without_exif = Image.new(img.mode, img.size)
            image_without_exif.putdata(data)
            
            # حفظ الصورة المنظفة
            image_without_exif.save(file_path)
            return True
        except Exception as e:
            return False
    
    @staticmethod
    def validate_and_save_file(file, upload_folder, file_type='image'):
        """التحقق وحفظ الملف بشكل آمن"""
        # التحقق من وجود الملف
        if not file or file.filename == '':
            return None, "No file provided"
        
        # التحقق من الامتداد
        if not SecureFileUpload.allowed_file(file.filename, file_type):
            return None, "File type not allowed"
        
        # التحقق من الحجم
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        if file_size > SecureFileUpload.MAX_FILE_SIZE:
            return None, f"File size exceeds {SecureFileUpload.MAX_FILE_SIZE / 1024 / 1024}MB"
        
        # إنشاء اسم ملف آمن
        safe_filename = SecureFileUpload.generate_safe_filename(file.filename)
        file_path = os.path.join(upload_folder, safe_filename)
        
        # حفظ الملف مؤقتاً
        file.save(file_path)
        
        # التحقق من نوع MIME الحقيقي
        if not SecureFileUpload.verify_mime_type(file_path):
            os.remove(file_path)
            return None, "Invalid file type"
        
        # فحص الفيروسات
        if not SecureFileUpload.scan_for_malware(file_path):
            os.remove(file_path)
            return None, "File contains malware"
        
        # تنظيف الصورة إذا كانت صورة
        if file_type == 'image':
            if not SecureFileUpload.sanitize_image(file_path):
                os.remove(file_path)
                return None, "Failed to process image"
        
        # تعيين الصلاحيات المناسبة
        os.chmod(file_path, 0o644)
        
        return safe_filename, None

# استخدام في Flask
@app.route('/upload', methods=['POST'])
@token_required()
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    upload_folder = os.path.join(app.config['UPLOAD_FOLDER'], 'images')
    
    # إنشاء المجلد إذا لم يكن موجوداً
    os.makedirs(upload_folder, exist_ok=True)
    
    # التحقق والحفظ
    filename, error = SecureFileUpload.validate_and_save_file(
        file, upload_folder, file_type='image'
    )
    
    if error:
        return jsonify({'error': error}), 400
    
    # حفظ معلومات الملف في قاعدة البيانات
    file_url = f"/uploads/images/{filename}"
    save_file_info(request.current_user['user_id'], filename, file_url)
    
    return jsonify({
        'message': 'File uploaded successfully',
        'filename': filename,
        'url': file_url
    }), 201
```

---

## 🌐 5. أمان الشبكة {#network-security}

### 5.1 إعدادات HTTPS

```nginx
# nginx.conf
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # شهادات SSL
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # بروتوكولات SSL آمنة
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # معدل الطلبات
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req zone=api_limit burst=20 nodelay;

    # حجم الطلب
    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5.2 جدار حماية التطبيق (WAF)

```python
from flask import request, jsonify
import re

class WebApplicationFirewall:
    # أنماط الهجمات الشائعة
    SQL_INJECTION_PATTERNS = [
        r"(\bUNION\b.*\bSELECT\b)",
        r"(\bOR\b\s+\d+\s*=\s*\d+)",
        r"(--|\#|\/\*)",
        r"(\bDROP\b|\bDELETE\b|\bINSERT\b|\bUPDATE\b).*\bTABLE\b",
    ]
    
    XSS_PATTERNS = [
        r"<script[^>]*>.*?</script>",
        r"javascript:",
        r"onerror\s*=",
        r"onload\s*=",
    ]
    
    PATH_TRAVERSAL_PATTERNS = [
        r"\.\./",
        r"\.\.\\",
        r"%2e%2e",
    ]
    
    @staticmethod
    def check_sql_injection(value):
        """التحقق من محاولات SQL Injection"""
        if not isinstance(value, str):
            return False
        
        for pattern in WebApplicationFirewall.SQL_INJECTION_PATTERNS:
            if re.search(pattern, value, re.IGNORECASE):
                return True
        return False
    
    @staticmethod
    def check_xss(value):
        """التحقق من محاولات XSS"""
        if not isinstance(value, str):
            return False
        
        for pattern in WebApplicationFirewall.XSS_PATTERNS:
            if re.search(pattern, value, re.IGNORECASE):
                return True
        return False
    
    @staticmethod
    def check_path_traversal(value):
        """التحقق من محاولات Path Traversal"""
        if not isinstance(value, str):
            return False
        
        for pattern in WebApplicationFirewall.PATH_TRAVERSAL_PATTERNS:
            if re.search(pattern, value, re.IGNORECASE):
                return True
        return False
    
    @staticmethod
    def scan_request(data):
        """فحص الطلب بالكامل"""
        if isinstance(data, dict):
            for key, value in data.items():
                if WebApplicationFirewall.check_sql_injection(str(value)):
                    return 'SQL Injection attempt detected'
                if WebApplicationFirewall.check_xss(str(value)):
                    return 'XSS attempt detected'
                if WebApplicationFirewall.check_path_traversal(str(value)):
                    return 'Path Traversal attempt detected'
        return None

# Middleware للتحقق من جميع الطلبات
@app.before_request
def waf_protection():
    # فحص معاملات URL
    threat = WebApplicationFirewall.scan_request(dict(request.args))
    if threat:
        app.logger.warning(f"WAF blocked request: {threat} from IP: {request.remote_addr}")
        return jsonify({'error': 'Request blocked by WAF'}), 403
    
    # فحص بيانات JSON
    if request.is_json:
        threat = WebApplicationFirewall.scan_request(request.get_json())
        if threat:
            app.logger.warning(f"WAF blocked request: {threat} from IP: {request.remote_addr}")
            return jsonify({'error': 'Request blocked by WAF'}), 403
    
    # فحص بيانات النموذج
    if request.form:
        threat = WebApplicationFirewall.scan_request(dict(request.form))
        if threat:
            app.logger.warning(f"WAF blocked request: {threat} from IP: {request.remote_addr}")
            return jsonify({'error': 'Request blocked by WAF'}), 403
```

---

## 📊 6. المراقبة والسجلات {#monitoring-logging}

```python
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime
import json

class SecurityLogger:
    def __init__(self, app_name):
        self.app_name = app_name
        self.setup_loggers()
    
    def setup_loggers(self):
        """إعداد نظام السجلات"""
        # سجل الأمان
        security_handler = RotatingFileHandler(
            'logs/security.log',
            maxBytes=10 * 1024 * 1024,  # 10MB
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
        access_formatter = logging.Formatter(
            '%(asctime)s - %(message)s'
        )
        access_handler.setFormatter(access_formatter)
        
        self.access_logger = logging.getLogger('access')
        self.access_logger.addHandler(access_handler)
        self.access_logger.setLevel(logging.INFO)
    
    def log_security_event(self, event_type, user_id, ip_address, details):
        """تسجيل حدث أمني"""
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
        log_data = {
            'timestamp': datetime.utcnow().isoformat(),
            'user_id': user_id,
            'endpoint': endpoint,
            'method': method,
            'status_code': status_code,
            'ip_address': ip_address
        }
        self.access_logger.info(json.dumps(log_data))
    
    def log_failed_login(self, username, ip_address, reason):
        """تسجيل محاولة دخول فاشلة"""
        self.log_security_event(
            'FAILED_LOGIN',
            username,
            ip_address,
            {'reason': reason}
        )
    
    def log_suspicious_activity(self, user_id, ip_address, activity_type, details):
        """تسجيل نشاط مشبوه"""
        self.log_security_event(
            f'SUSPICIOUS_{activity_type}',
            user_id,
            ip_address,
            details
        )

# استخدام في التطبيق
security_logger = SecurityLogger('student-skills-platform')

@app.after_request
def log_request(response):
    """تسجيل كل طلب"""
    user_id = getattr(request, 'current_user', {}).get('user_id', 'anonymous')
    
    security_logger.log_access(
        user_id,
        request.endpoint,
        request.method,
        response.status_code,
        request.remote_addr
    )
    
    return response

# نظام الإنذار للأحداث الأمنية
class SecurityAlertSystem:
    def __init__(self):
        self.alert_thresholds = {
            'failed_logins': 5,
            'suspicious_activities': 3
        }
    
    def check_and_alert(self, event_type, user_id):
        """التحقق وإرسال تنبيه إذا لزم الأمر"""
        # حساب عدد الأحداث في آخر 10 دقائق
        recent_events = self.count_recent_events(event_type, user_id, minutes=10)
        
        threshold = self.alert_thresholds.get(event_type, 10)
        
        if recent_events >= threshold:
            self.send_alert(event_type, user_id, recent_events)
    
    def send_alert(self, event_type, user_id, count):
        """إرسال تنبيه (عبر البريد الإلكتروني، SMS، إلخ)"""
        # تنفيذ إرسال التنبيه
        print(f"ALERT: {event_type} for user {user_id}: {count} events")
        # يمكن إرسال بريد إلكتروني أو رسالة SMS هنا
```

---

## 💾 7. النسخ الاحتياطي والاستعادة {#backup-recovery}

```python
import subprocess
import os
from datetime import datetime
import boto3

class BackupManager:
    def __init__(self, db_config, backup_dir='/backups'):
        self.db_config = db_config
        self.backup_dir = backup_dir
        os.makedirs(backup_dir, exist_ok=True)
    
    def create_database_backup(self):
        """إنشاء نسخة احتياطية من قاعدة البيانات"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_file = f"{self.backup_dir}/db_backup_{timestamp}.sql"
        
        # استخدام pg_dump لـ PostgreSQL
        cmd = [
            'pg_dump',
            '-h', self.db_config['host'],
            '-U', self.db_config['user'],
            '-d', self.db_config['database'],
            '-f', backup_file
        ]
        
        env = os.environ.copy()
        env['PGPASSWORD'] = self.db_config['password']
        
        try:
            subprocess.run(cmd, env=env, check=True)
            
            # ضغط النسخة الاحتياطية
            compressed_file = f"{backup_file}.gz"
            subprocess.run(['gzip', backup_file], check=True)
            
            return compressed_file
        except subprocess.CalledProcessError as e:
            print(f"Backup failed: {e}")
            return None
    
    def upload_to_s3(self, file_path, bucket_name):
        """رفع النسخة الاحتياطية إلى S3"""
        s3_client = boto3.client(
            's3',
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
        )
        
        file_name = os.path.basename(file_path)
        
        try:
            s3_client.upload_file(
                file_path,
                bucket_name,
                f"backups/{file_name}",
                ExtraArgs={'ServerSideEncryption': 'AES256'}
            )
            return True
        except Exception as e:
            print(f"S3 upload failed: {e}")
            return False
    
    def cleanup_old_backups(self, days=30):
        """حذف النسخ الاحتياطية القديمة"""
        cutoff_time = datetime.now().timestamp() - (days * 24 * 60 * 60)
        
        for filename in os.listdir(self.backup_dir):
            file_path = os.path.join(self.backup_dir, filename)
            if os.path.isfile(file_path):
                if os.path.getmtime(file_path) < cutoff_time:
                    os.remove(file_path)
                    print(f"Deleted old backup: {filename}")
    
    def restore_database(self, backup_file):
        """استعادة قاعدة البيانات من نسخة احتياطية"""
        # فك الضغط أولاً
        if backup_file.endswith('.gz'):
            subprocess.run(['gunzip', backup_file], check=True)
            backup_file = backup_file[:-3]  # إزالة .gz
        
        cmd = [
            'psql',
            '-h', self.db_config['host'],
            '-U', self.db_config['user'],
            '-d', self.db_config['database'],
            '-f', backup_file
        ]
        
        env = os.environ.copy()
        env['PGPASSWORD'] = self.db_config['password']
        
        try:
            subprocess.run(cmd, env=env, check=True)
            return True
        except subprocess.CalledProcessError as e:
            print(f"Restore failed: {e}")
            return False

# جدولة النسخ الاحتياطي التلقائي
from apscheduler.schedulers.background import BackgroundScheduler

def schedule_backups():
    backup_manager = BackupManager(DATABASE_CONFIG)
    
    def daily_backup():
        backup_file = backup_manager.create_database_backup()
        if backup_file:
            backup_manager.upload_to_s3(backup_file, 'your-backup-bucket')
            backup_manager.cleanup_old_backups(days=30)
    
    scheduler = BackgroundScheduler()
    scheduler.add_job(daily_backup, 'cron', hour=2, minute=0)  # كل يوم الساعة 2 صباحاً
    scheduler.start()
```

---

## 🔒 8. متغيرات البيئة الآمنة

```python
# .env.example (لا تضع قيم حقيقية هنا)
"""
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=student_skills_platform
DB_USER=app_user
DB_PASSWORD=change_this_secure_password

# JWT
JWT_SECRET_KEY=change_this_to_a_random_string_at_least_32_chars
JWT_ALGORITHM=HS256

# Encryption
ENCRYPTION_KEY=generate_with_Fernet.generate_key()

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=change_this_redis_password

# AWS S3
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_BUCKET_NAME=your_bucket_name

# Email (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password

# Application
FLASK_ENV=production
SECRET_KEY=generate_random_secret_key
MAX_CONTENT_LENGTH=10485760  # 10MB

# Security
ALLOWED_ORIGINS=https://yourdomain.com
SESSION_COOKIE_SECURE=True
SESSION_COOKIE_HTTPONLY=True
SESSION_COOKIE_SAMESITE=Strict
"""

# config.py
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # التحقق من وجود المتغيرات المطلوبة
    REQUIRED_ENV_VARS = [
        'DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD',
        'JWT_SECRET_KEY', 'ENCRYPTION_KEY', 'SECRET_KEY'
    ]
    
    @classmethod
    def validate_environment(cls):
        """التحقق من وجود جميع المتغيرات المطلوبة"""
        missing = [var for var in cls.REQUIRED_ENV_VARS if not os.getenv(var)]
        if missing:
            raise EnvironmentError(f"Missing required environment variables: {', '.join(missing)}")
    
    # قاعدة البيانات
    DATABASE_URI = os.getenv('DATABASE_URI')
    
    # JWT
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
    JWT_ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256')
    
    # Flask
    SECRET_KEY = os.getenv('SECRET_KEY')
    MAX_CONTENT_LENGTH = int(os.getenv('MAX_CONTENT_LENGTH', 10485760))
    
    # Security
    SESSION_COOKIE_SECURE = os.getenv('SESSION_COOKIE_SECURE', 'True') == 'True'
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Strict'
    
    # CORS
    ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', '').split(',')

# التحقق عند بدء التطبيق
Config.validate_environment()
```

---

## 📋 قائمة المراجعة النهائية

### ✅ قاعدة البيانات
- [ ] استخدام Parameterized Queries
- [ ] تشفير البيانات الحساسة
- [ ] تفعيل SSL للاتصالات
- [ ] نسخ احتياطي يومي
- [ ] صلاحيات محدودة لمستخدمي قاعدة البيانات

### ✅ المصادقة والتفويض
- [ ] تشفير كلمات المرور (bcrypt)
- [ ] JWT مع انتهاء صلاحية قصير
- [ ] Refresh Tokens
- [ ] Rate limiting لمحاولات تسجيل الدخول
- [ ] مصادقة ثنائية اختيارية
- [ ] قائمة سوداء للتوكنات

### ✅ أمان التطبيق
- [ ] حماية من XSS
- [ ] حماية من CSRF
- [ ] حماية من SQL Injection
- [ ] Content Security Policy
- [ ] Security Headers
- [ ] Input Validation
- [ ] Output Encoding

### ✅ الملفات المرفوعة
- [ ] التحقق من نوع الملف
- [ ] التحقق من حجم الملف
- [ ] فحص الفيروسات
- [ ] تنظيف البيانات الوصفية
- [ ] أسماء ملفات آمنة
- [ ] تخزين خارج المسار العام

### ✅ الشبكة
- [ ] HTTPS إجباري
- [ ] شهادات SSL صالحة
- [ ] WAF مفعل
- [ ] Rate Limiting
- [ ] CORS محدد
- [ ] Firewall مهيأ

### ✅ المراقبة
- [ ] سجلات الأمان
- [ ] سجلات الوصول
- [ ] نظام إنذار
- [ ] مراقبة الأداء
- [ ] تنبيهات الأنشطة المشبوهة

### ✅ النسخ الاحتياطي
- [ ] نسخ احتياطي يومي تلقائي
- [ ] تخزين خارجي (S3)
- [ ] تشفير النسخ الاحتياطية
- [ ] اختبار الاستعادة
- [ ] حذف النسخ القديمة

### ✅ الإعدادات العامة
- [ ] متغيرات بيئة آمنة
- [ ] عدم عرض أخطاء في الإنتاج
- [ ] تحديث المكتبات باستمرار
- [ ] فحص الثغرات الأمنية
- [ ] مراجعة الكود الأمنية

---

## 🚀 البدء في التطبيق

### 1. تثبيت المكتبات المطلوبة

```bash
pip install flask flask-cors flask-wtf
pip install sqlalchemy psycopg2-binary
pip install bcrypt pyjwt python-dotenv
pip install cryptography bleach
pip install python-magic pillow
pip install redis
pip install pyotp qrcode
pip install boto3  # للنسخ الاحتياطي على S3
pip install apscheduler
```

### 2. إنشاء ملف .env

انسخ `.env.example` إلى `.env` وقم بتعبئة القيم الحقيقية.

### 3. تطبيق الإعدادات الأمنية

قم بدمج الأكواد المذكورة أعلاه في مشروعك بشكل تدريجي، مع اختبار كل جزء على حدة.

### 4. الاختبار الأمني

استخدم أدوات مثل:
- **OWASP ZAP** - لفحص الثغرات
- **Burp Suite** - لاختبار الاختراق
- **SQLMap** - لاختبار SQL Injection
- **Nmap** - لفحص المنافذ

### 5. المراقبة المستمرة

- راقب السجلات بانتظام
- قم بتحديث المكتبات
- راجع سياسات الأمان دورياً
- اختبر النسخ الاحتياطية شهرياً

---

## 📞 موارد إضافية

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Flask Security Best Practices](https://flask.palletsprojects.com/en/latest/security/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

---

## ⚠️ ملاحظات مهمة

1. **لا تخزن أسرار في الكود المصدري أبداً**
2. **استخدم HTTPS في كل مكان**
3. **قم بتحديث المكتبات بانتظام**
4. **اختبر الأمان بشكل دوري**
5. **احتفظ بنسخ احتياطية متعددة**
6. **راقب السجلات باستمرار**
7. **درب فريقك على الممارسات الأمنية**

---

تم إنشاء هذا الدليل لمساعدتك في تأمين منصة مهارات الطلاب الخاصة بك. يرجى تطبيق هذه الإجراءات بعناية واختبارها جيداً قبل النشر في الإنتاج.
