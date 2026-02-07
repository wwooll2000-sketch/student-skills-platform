# دليل الإعداد والنشر - PostgreSQL و Vercel

## 1. إعداد قاعدة البيانات PostgreSQL (Neon)

### الخطوة 1: إنشاء حساب على Neon
1. توجه إلى https://neon.tech
2. قم بالتسجيل مجاناً
3. أكمل عملية التحقق من البريد الإلكتروني

### الخطوة 2: إنشاء مشروع جديد
1. في لوحة التحكم، اضغط "Create a new project"
2. اختر **PostgreSQL** كنوع القاعدة
3. ضع اسماً للمشروع: `student-skills-db`
4. اختر **Free tier** للخطة المجانية
5. اضغط "Create project"

### الخطوة 3: الحصول على رابط الاتصال
1. بعد إنشاء المشروع، انظر للقسم "Connection String"
2. انسخ رابط الاتصال:
   ```
   postgresql://username:password@host:5432/database
   ```
3. احفظ هذا الرابط بأمان

### الخطوة 4: تفعيل الامتدادات المطلوبة (اختياري)
```sql
-- في محرر SQL في لوحة Neon
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

---

## 2. إعداد المشروع محلياً

### المتطلبات
- Node.js 18.x أو أحدث
- npm أو yarn

### التثبيت
```bash
# تثبيت المكتبات
npm install

# أنشئ ملف .env محلي
cp .env.example .env.local
```

### تحديث .env.local
```env
DATABASE_URL=postgresql://your_user:your_password@your_host:5432/your_database
JWT_SECRET=your-secret-key-change-this-to-something-random
ADMIN_PASSWORD=admin123
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### التشغيل محلياً
```bash
# تشغيل الخادم
npm run dev

# سيفتح على
http://localhost:3000
```

---

## 3. التشغيل والاختبار المحلي

### اختبار صحة الاتصال بقاعدة البيانات
```bash
curl http://localhost:3000/api/db-status
```

### اختبار Health Check
```bash
curl http://localhost:3000/api/health
```

---

## 4. النشر على Vercel

### الخطوة 1: إنشاء حساب Vercel
1. توجه إلى https://vercel.com
2. سجل دخول باستخدام GitHub أو أنشئ حساباً جديداً

### الخطوة 2: دفع المشروع إلى GitHub
```bash
git add .
git commit -m "Setup PostgreSQL with Vercel"
git push origin main
```

### الخطوة 3: نشر المشروع على Vercel
1. في لوحة Vercel، اضغط "New Project"
2. اختر المستودع الخاص بك
3. اترك الإعدادات الافتراضية وانقر "Deploy"

### الخطوة 4: إضافة متغيرات البيئة في Vercel
1. اذهب إلى "Project Settings"
2. اختر "Environment Variables"
3. أضف المتغيرات التالية:

| المفتاح | القيمة |
|---------|--------|
| `DATABASE_URL` | رابط Neon الخاص بك |
| `JWT_SECRET` | مفتاح سري قوي (استخدم جنرتور) |
| `ADMIN_PASSWORD` | كلمة مرور آمنة |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | رابط موقعك على Vercel |

### الخطوة 5: إعادة النشر
1. اذهب إلى "Deployments"
2. اضغط على أحدث عملية نشر
3. اختر "Redeploy" لتطبيق المتغيرات الجديدة

---

## 5. إدارة قاعدة البيانات

### الاتصال عبر psql
```bash
psql postgresql://your_user:your_password@your_host:5432/your_database
```

### عرض الجداول
```sql
-- قائمة الجداول
\dt

-- معلومات الجدول
\d students
\d skills
\d student_evaluations
\d admin_logs
```

### استعادة البيانات
```bash
# نسخ احتياطية من Neon
pg_dump postgresql://your_user:your_password@your_host:5432/your_database > backup.sql

# استعادة من نسخة احتياطية
psql postgresql://your_user:your_password@your_host:5432/your_database < backup.sql
```

---

## 6. نقاط أمان مهمة

✅ **افعل دائماً:**
- استخدم متغيرات البيئة لله البيانات الحساسة
- لا تضع كلمات المرور في الكود
- استخدم HTTPS فقط في الإنتاج
- غير كلمة مرور الأدمن الافتراضية

❌ **لا تفعل أبداً:**
- لا تشارك رابط قاعدة البيانات على الملأ
- لا تضع المتغيرات الحساسة في الملفات
- لا تستخدم نفس كلمة المرور لحسابات متعددة

---

## 7. استكشاف الأخطاء

### خطأ: "Cannot connect to database"
- تحقق من أن رابط DATABASE_URL صحيح
- تأكد من أن عنوان IP الخاص بك مسموح في Neon
- تحقق من أن كلمة المرور صحيحة

### خطأ: "JWT verification failed"
- تأكد من أن JWT_SECRET متطابق في كل مكان
- تحقق من انتهاء الـ Token

### الخادم لا يستجيب
- تحقق من السجلات في Vercel (Logs)
- تأكد من أن جميع المتغيرات البيئية معرفة

---

## 8. قاعدة البيانات - الهيكل

### جدول Students
```sql
CREATE TABLE students (
  id UUID PRIMARY KEY,
  code VARCHAR(50) UNIQUE,
  name VARCHAR(255),
  email VARCHAR(255),
  class VARCHAR(50),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### جدول Skills
```sql
CREATE TABLE skills (
  id UUID PRIMARY KEY,
  student_id UUID REFERENCES students(id),
  name VARCHAR(255),
  level INTEGER (1-3),
  description TEXT,
  category VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### جدول Evaluations
```sql
CREATE TABLE student_evaluations (
  id UUID PRIMARY KEY,
  student_id UUID REFERENCES students(id),
  evaluation_date TIMESTAMP,
  overall_score INTEGER,
  comments TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

---

## 9. API Endpoints

### تسجيل دخول الأدمن
```
POST /api/admin/login
{
  "password": "admin123"
}
```

### تسجيل دخول الطالب
```
POST /api/student/login
{
  "studentCode": "1234"
}
```

### إضافة طالب جديد
```
POST /api/admin/students
Authorization: Bearer {token}
{
  "name": "أحمد",
  "code": "1001",
  "email": "ahmed@example.com",
  "class": "10A"
}
```

---

## 10. نصائح الأداء

- قاعدة البيانات المجانية في Neon تتضمن حد معقول للمتطلبات
- استخدم Vercel Edge Cache للملفات الثابتة
- أضف فهارس إضافية للاستعلامات البطيئة

---

## الدعم والمساعدة

- وثائق Neon: https://neon.tech/docs
- وثائق Vercel: https://vercel.com/docs
- API Documentation: [راجع API-DOCS.md](API-DOCS.md)
