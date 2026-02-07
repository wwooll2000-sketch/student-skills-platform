# قائمة المراجعة الأمنية قبل النشر
# Security Deployment Checklist

## 📋 قائمة المراجعة الشاملة

### ✅ 1. إعدادات البيئة

- [ ] **تم تغيير جميع المفاتيح الافتراضية**
  - SECRET_KEY
  - JWT_SECRET_KEY
  - ENCRYPTION_KEY
  - DB_PASSWORD
  - REDIS_PASSWORD

- [ ] **ملف .env غير موجود في Git**
  ```bash
  # تأكد من وجود .env في .gitignore
  echo ".env" >> .gitignore
  ```

- [ ] **FLASK_ENV مضبوط على production**
  ```bash
  FLASK_ENV=production
  DEBUG=False
  ```

- [ ] **تم توليد مفاتيح قوية**
  ```bash
  # توليد SECRET_KEY
  python -c "import secrets; print(secrets.token_hex(32))"
  
  # توليد ENCRYPTION_KEY
  python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
  ```

---

### ✅ 2. قاعدة البيانات

- [ ] **استخدام Parameterized Queries في كل مكان**
- [ ] **لا يوجد SQL مباشر مع بيانات المستخدم**
- [ ] **تشفير البيانات الحساسة**
  - كلمات المرور (bcrypt)
  - معلومات بطاقات الائتمان
  - معلومات شخصية حساسة

- [ ] **إعدادات قاعدة البيانات الآمنة**
  ```sql
  -- إنشاء مستخدم بصلاحيات محدودة
  CREATE USER app_user WITH PASSWORD 'strong_password';
  GRANT CONNECT ON DATABASE student_skills_platform TO app_user;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
  
  -- عدم منح صلاحيات DROP أو ALTER
  ```

- [ ] **تفعيل SSL للاتصال بقاعدة البيانات**
  ```python
  engine = create_engine(
      connection_string,
      connect_args={'sslmode': 'require'}
  )
  ```

- [ ] **نسخ احتياطي يومي مفعل**
- [ ] **اختبار استعادة النسخ الاحتياطية**

---

### ✅ 3. المصادقة والتفويض

- [ ] **تشفير كلمات المرور باستخدام bcrypt**
  ```python
  # تأكد من استخدام rounds كافية (12 أو أكثر)
  bcrypt.gensalt(rounds=12)
  ```

- [ ] **JWT Tokens بانتهاء صلاحية قصير**
  - Access Token: 15 دقيقة
  - Refresh Token: 7 أيام

- [ ] **نظام Refresh Token مطبق**
- [ ] **قائمة سوداء للـ Tokens عند تسجيل الخروج**
- [ ] **Rate Limiting على تسجيل الدخول**
  - 5 محاولات كحد أقصى كل 15 دقيقة

- [ ] **التحقق من الصلاحيات في كل endpoint**
- [ ] **المصادقة الثنائية متاحة (اختياري)**

---

### ✅ 4. أمان التطبيق

- [ ] **حماية من XSS**
  - تنظيف جميع المدخلات
  - استخدام bleach لـ HTML
  - Output encoding

- [ ] **حماية من CSRF**
  - CSRF tokens على جميع النماذج
  - التحقق من Origin/Referer headers

- [ ] **حماية من SQL Injection**
  - لا استعلامات SQL مباشرة
  - استخدام ORM أو prepared statements

- [ ] **WAF (Web Application Firewall) مفعل**
  - فحص جميع الطلبات
  - منع الأنماط الخبيثة

- [ ] **Input Validation على جميع المدخلات**
  ```python
  # تحقق من النوع والطول
  if not isinstance(data, str) or len(data) > MAX_LENGTH:
      return error
  ```

- [ ] **Content Security Policy مفعلة**

---

### ✅ 5. رؤوس الأمان (Security Headers)

تأكد من وجود هذه الرؤوس في كل response:

```python
# Security Headers Checklist
headers = {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; ...",
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
}
```

اختبر باستخدام: https://securityheaders.com

---

### ✅ 6. HTTPS/SSL

- [ ] **شهادة SSL صالحة مثبتة**
  ```bash
  # استخدم Let's Encrypt
  sudo certbot --nginx -d yourdomain.com
  ```

- [ ] **إعادة توجيه HTTP إلى HTTPS**
  ```nginx
  server {
      listen 80;
      return 301 https://$server_name$request_uri;
  }
  ```

- [ ] **HSTS مفعل**
- [ ] **بروتوكولات SSL آمنة فقط (TLS 1.2, 1.3)**
  ```nginx
  ssl_protocols TLSv1.2 TLSv1.3;
  ```

- [ ] **اختبار SSL**: https://www.ssllabs.com/ssltest/

---

### ✅ 7. الملفات المرفوعة

- [ ] **التحقق من نوع الملف (MIME type)**
- [ ] **التحقق من امتداد الملف**
- [ ] **حد أقصى لحجم الملف (10MB)**
- [ ] **تنظيف البيانات الوصفية (EXIF)**
- [ ] **فحص الفيروسات (ClamAV) اختياري**
- [ ] **تخزين الملفات خارج المسار العام**
- [ ] **أسماء ملفات عشوائية آمنة**
- [ ] **صلاحيات الملفات محدودة (644)**

---

### ✅ 8. Rate Limiting

- [ ] **حد على تسجيل الدخول**
- [ ] **حد على رفع الملفات**
- [ ] **حد على API endpoints**
- [ ] **استخدام Redis للتخزين المؤقت**

```python
# مثال على Rate Limiting
@rate_limit(max_requests=100, window_seconds=60)
def api_endpoint():
    pass
```

---

### ✅ 9. السجلات والمراقبة

- [ ] **سجلات الأمان مفعلة**
  - محاولات تسجيل الدخول الفاشلة
  - الأنشطة المشبوهة
  - تغييرات الصلاحيات

- [ ] **سجلات الوصول مفعلة**
- [ ] **دوران السجلات (log rotation)**
  ```python
  RotatingFileHandler(
      'logs/security.log',
      maxBytes=10*1024*1024,
      backupCount=10
  )
  ```

- [ ] **نظام التنبيهات للأحداث المهمة**
- [ ] **مراقبة الأداء والموارد**

---

### ✅ 10. النسخ الاحتياطي

- [ ] **نسخ احتياطي يومي تلقائي**
- [ ] **تخزين خارجي (AWS S3 أو مشابه)**
- [ ] **تشفير النسخ الاحتياطية**
- [ ] **اختبار الاستعادة شهرياً**
- [ ] **الاحتفاظ بـ 30 يوم من النسخ**
- [ ] **حذف النسخ القديمة تلقائياً**

```bash
# جدولة النسخ الاحتياطي
0 2 * * * /path/to/backup_script.sh
```

---

### ✅ 11. إعدادات CORS

- [ ] **CORS محدد للنطاقات المحددة فقط**
  ```python
  CORS(app, resources={
      r"/api/*": {
          "origins": ["https://yourdomain.com"],
          "methods": ["GET", "POST", "PUT", "DELETE"],
          "supports_credentials": True
      }
  })
  ```

- [ ] **لا تستخدم `*` في الإنتاج**

---

### ✅ 12. التبعيات والمكتبات

- [ ] **تحديث جميع المكتبات**
  ```bash
  pip list --outdated
  pip install --upgrade -r requirements.txt
  ```

- [ ] **فحص الثغرات الأمنية**
  ```bash
  pip install safety
  safety check
  ```

- [ ] **استخدام نسخ محددة في requirements.txt**
  ```
  Flask==3.0.0  # بدلاً من Flask>=2.0
  ```

---

### ✅ 13. الخادم والبنية التحتية

- [ ] **استخدام Gunicorn أو uWSGI في الإنتاج**
  ```bash
  gunicorn -w 4 -b 0.0.0.0:5000 secure_app:app
  ```

- [ ] **Nginx كـ reverse proxy**
- [ ] **جدار حماية مفعل**
  ```bash
  # UFW مثال
  sudo ufw allow 22/tcp
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw enable
  ```

- [ ] **تعطيل المنافذ غير الضرورية**
- [ ] **SSH بمفتاح فقط (لا كلمة مرور)**
- [ ] **تحديث نظام التشغيل**
  ```bash
  sudo apt update && sudo apt upgrade -y
  ```

---

### ✅ 14. اختبار الأمان

قم بتشغيل هذه الاختبارات قبل النشر:

```bash
# 1. فحص الثغرات
pip install bandit
bandit -r . -f json -o security-report.json

# 2. اختبار SQL Injection
sqlmap -u "https://yourdomain.com/api/login" --data="username=test&password=test"

# 3. فحص OWASP Top 10
# استخدم OWASP ZAP
zap-cli quick-scan https://yourdomain.com

# 4. فحص SSL
testssl.sh yourdomain.com

# 5. فحص الرؤوس الأمنية
curl -I https://yourdomain.com
```

---

### ✅ 15. قائمة مراجعة البيئة

**التطوير (Development)**
- [ ] DEBUG=True
- [ ] سجلات مفصلة
- [ ] بدون HTTPS (محلياً)

**الإنتاج (Production)**
- [ ] DEBUG=False
- [ ] HTTPS إجباري
- [ ] سجلات محدودة (INFO أو WARNING)
- [ ] متغيرات بيئة آمنة
- [ ] مفاتيح مختلفة عن التطوير

---

## 🧪 سكريبت اختبار شامل

احفظ هذا كـ `security_test.sh`:

```bash
#!/bin/bash

echo "=== Security Testing Suite ==="
echo ""

# 1. فحص المنافذ
echo "1. Port Scanning..."
nmap -sV localhost

# 2. فحص SSL
echo "2. SSL Testing..."
testssl.sh yourdomain.com

# 3. فحص رؤوس الأمان
echo "3. Security Headers..."
curl -I https://yourdomain.com | grep -E "Strict-Transport|X-Frame|X-Content|CSP"

# 4. فحص الثغرات في المكتبات
echo "4. Dependency Vulnerabilities..."
safety check

# 5. تحليل الكود
echo "5. Code Analysis..."
bandit -r . -ll

# 6. اختبار معدل الطلبات
echo "6. Rate Limiting Test..."
for i in {1..20}; do
  curl -s -o /dev/null -w "%{http_code}\n" https://yourdomain.com/api/login
done

echo ""
echo "=== Testing Complete ==="
```

---

## 📊 مراقبة مستمرة

بعد النشر، راقب:

1. **السجلات الأمنية يومياً**
2. **محاولات تسجيل الدخول الفاشلة**
3. **الأنشطة غير الاعتيادية**
4. **استخدام الموارد (CPU, Memory, Disk)**
5. **صحة قاعدة البيانات**

---

## 🚨 خطة الاستجابة للحوادث

في حالة اختراق أمني:

1. **عزل النظام فوراً**
2. **تغيير جميع كلمات المرور والمفاتيح**
3. **مراجعة السجلات**
4. **إبلاغ المستخدمين المتأثرين**
5. **استعادة من نسخة احتياطية نظيفة**
6. **تحليل السبب وإصلاحه**

---

## ✅ النشر النهائي

عندما تكتمل جميع النقاط:

```bash
# 1. تشغيل الاختبارات
./security_test.sh

# 2. إنشاء نسخة احتياطية
python backup_manager.py

# 3. النشر
git pull origin main
pip install -r requirements.txt
systemctl restart your-app
systemctl restart nginx

# 4. التحقق
curl https://yourdomain.com/health
```

---

## 📚 موارد إضافية

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [Flask Security](https://flask.palletsprojects.com/security/)
- [Mozilla SSL Configuration](https://ssl-config.mozilla.org/)

---

**ملاحظة:** هذه القائمة شاملة ولكنها ليست نهائية. الأمان عملية مستمرة تتطلب يقظة دائمة وتحديثات منتظمة.
