# دليل استخدام API - نظام متابعة مهارات الطلاب

## 📚 المحتويات

1. [المقدمة](#مقدمة)
2. [أنماط الطلب](#أنماط-الطلب)
3. [نقاط نهاية الأدمن](#نقاط-نهاية-الأدمن)
4. [نقاط نهاية الطالب](#نقاط-نهاية-الطالب)
5. [أكواد الأخطاء](#أكواد-الأخطاء)
6. [أمثلة](#أمثلة)

---

## مقدمة

هذا API يستخدم Node.js/Express و PostgreSQL. جميع الطلبات يجب أن تكون HTTPS في الإنتاج.

### قاعدة الـ URL
```
Production: https://your-domain.com/api
Development: http://localhost:3000/api
```

### المصادقة
- تسجيل دخول الأدمن يرجع JWT token
- أضف الـ token في Header:
```
Authorization: Bearer YOUR_TOKEN_HERE
```

### Content-Type
جميع الطلبات والاستجابات يجب أن تكون:
```
Content-Type: application/json
```

---

## أنماط الطلب

### طلب نموذجي
```http
POST /api/admin/login
Content-Type: application/json

{
  "password": "admin123"
}
```

### استجابة نموذجية
```json
{
  "success": true,
  "message": "تم تسجيل الدخول بنجاح",
  "token": "eyJhbGc...",
  "user": {
    "role": "admin",
    "name": "المعلم"
  }
}
```

---

## نقاط نهاية الأدمن

### 🔐 تسجيل الدخول

**الطلب:**
```http
POST /api/admin/login
Content-Type: application/json

{
  "password": "admin123"
}
```

**الاستجابة (نجاح):**
```json
{
  "success": true,
  "message": "تم تسجيل الدخول بنجاح",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "role": "admin",
    "name": "المعلم"
  }
}
```

**الاستجابة (فشل):**
```json
{
  "success": false,
  "message": "كلمة المرور غير صحيحة"
}
```

---

### 👥 إدارة الطلاب

#### إضافة طالب جديد

**الطلب:**
```http
POST /api/admin/students
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "name": "أحمد محمد",
  "code": "1001",
  "email": "ahmed@school.edu",
  "class": "10A"
}
```

**الاستجابة:**
```json
{
  "success": true,
  "message": "تم إضافة الطالب بنجاح",
  "student": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "أحمد محمد",
    "code": "1001",
    "email": "ahmed@school.edu",
    "class": "10A",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

#### الحصول على جميع الطلاب

**الطلب:**
```http
GET /api/admin/students
Authorization: Bearer YOUR_TOKEN
```

**الاستجابة:**
```json
{
  "success": true,
  "students": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "أحمد محمد",
      "code": "1001",
      "email": "ahmed@school.edu",
      "class": "10A",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### تحديث بيانات الطالب

**الطلب:**
```http
PUT /api/admin/students/{studentId}
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "name": "أحمد محمد علي",
  "email": "ahmed.ali@school.edu",
  "class": "10B"
}
```

#### حذف طالب

**الطلب:**
```http
DELETE /api/admin/students/{studentId}
Authorization: Bearer YOUR_TOKEN
```

---

### 📚 إدارة المهارات

#### إضافة مهارة

**الطلب:**
```http
POST /api/admin/students/{studentId}/skills
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "name": "القراءة الفصحى",
  "level": 1,
  "description": "المهارة في قراءة النصوص الفصحى",
  "category": "القراءة",
  "notes": "الطالب يحتاج تركيز أكثر"
}
```

**الاستجابة:**
```json
{
  "success": true,
  "message": "تم إضافة المهارة بنجاح",
  "skill": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "student_id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "القراءة الفصحى",
    "level": 1,
    "description": "المهارة في قراءة النصوص الفصحى",
    "category": "القراءة",
    "notes": "الطالب يحتاج تركيز أكثر",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

#### تحديث مهارة

**الطلب:**
```http
PUT /api/admin/skills/{skillId}
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "name": "القراءة الفصحى",
  "level": 2,
  "description": "تقدم جيد في القراءة"
}
```

#### حذف مهارة

**الطلب:**
```http
DELETE /api/admin/skills/{skillId}
Authorization: Bearer YOUR_TOKEN
```

---

### ⭐ التقييمات

#### إضافة تقييم

**الطلب:**
```http
POST /api/admin/students/{studentId}/evaluations
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "overallScore": 85,
  "comments": "أداء ممتاز جداً"
}
```

**الاستجابة:**
```json
{
  "success": true,
  "message": "تم إضافة التقييم بنجاح",
  "evaluation": {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "student_id": "550e8400-e29b-41d4-a716-446655440000",
    "evaluation_date": "2024-01-15T10:30:00Z",
    "overall_score": 85,
    "comments": "أداء ممتاز جداً",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

---

### 📊 الإحصائيات

**الطلب:**
```http
GET /api/admin/stats
Authorization: Bearer YOUR_TOKEN
```

**الاستجابة:**
```json
{
  "success": true,
  "stats": {
    "studentsCount": 45,
    "skillsCount": 230,
    "evaluationsCount": 45,
    "logsCount": 892
  }
}
```

---

## نقاط نهاية الطالب

### 🔓 تسجيل الدخول

**الطلب:**
```http
POST /api/student/login
Content-Type: application/json

{
  "studentCode": "1001"
}
```

**الاستجابة (نجاح):**
```json
{
  "success": true,
  "message": "تم الدخول بنجاح",
  "student": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "أحمد محمد",
    "code": "1001",
    "class": "10A",
    "email": "ahmed@school.edu"
  }
}
```

---

### 👤 الحصول على بيانات الطالب

**الطلب:**
```http
GET /api/student/{studentId}
```

**الاستجابة:**
```json
{
  "success": true,
  "student": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "أحمد محمد",
    "code": "1001",
    "class": "10A",
    "email": "ahmed@school.edu",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z",
    "skills": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "name": "القراءة الفصحى",
        "level": 2,
        "category": "القراءة",
        "description": "المهارة في قراءة النصوص الفصحى",
        "created_at": "2024-01-15T10:30:00Z"
      }
    ]
  }
}
```

---

### 📚 الحصول على مهارات الطالب

**الطلب:**
```http
GET /api/student/{studentId}/skills
```

**الاستجابة:**
```json
{
  "success": true,
  "skills": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "student_id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "القراءة الفصحى",
      "level": 1,
      "description": "المهارة في قراءة النصوص الفصحى",
      "category": "القراءة",
      "notes": null,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

### ⭐ الحصول على التقييمات

**الطلب:**
```http
GET /api/student/{studentId}/evaluations
```

**الاستجابة:**
```json
{
  "success": true,
  "evaluations": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "student_id": "550e8400-e29b-41d4-a716-446655440000",
      "evaluation_date": "2024-01-15T10:30:00Z",
      "overall_score": 85,
      "comments": "أداء ممتاز جداً",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

### 🏥 فحص الصحة

**الطلب:**
```http
GET /api/health
```

**الاستجابة:**
```json
{
  "success": true,
  "message": "الخادم يعمل بشكل صحيح",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

### 📊 حالة قاعدة البيانات

**الطلب:**
```http
GET /api/db-status
```

**الاستجابة:**
```json
{
  "success": true,
  "message": "قاعدة البيانات تعمل بشكل صحيح",
  "timestamp": "2024-01-15T10:30:00.123Z"
}
```

---

## أكواد الأخطاء

| الالكود | المعنى | التفسير |
|--------|-----------|---------|
| 200 | OK | الطلب نجح بنجاح |
| 201 | Created | تم إنشاء مورد جديد |
| 400 | Bad Request | البيانات المرسلة غير صحيحة |
| 401 | Unauthorized | لا يوجد حق وصول / كلمة مرور خاطئة |
| 403 | Forbidden | الحق غير كافي |
| 404 | Not Found | المورد غير موجود |
| 500 | Server Error | خطأ في الخادم |

---

## أمثلة

### مثال كامل: إضافة طالب والمهارات الخاصة به

```javascript
// 1. تسجيل دخول الأدمن
const loginResponse = await fetch('/api/admin/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: 'admin123' })
});
const loginData = await loginResponse.json();
const token = loginData.token;

// 2. إضافة طالب جديد
const studentResponse = await fetch('/api/admin/students', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    name: 'فاطمة علي',
    code: '1002',
    email: 'fatima@school.edu',
    class: '10B'
  })
});
const studentData = await studentResponse.json();
const studentId = studentData.student.id;

// 3. إضافة مهارة للطالب
const skillResponse = await fetch(
  `/api/admin/students/${studentId}/skills`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'الكتابة والإملاء',
      level: 1,
      category: 'الكتابة',
      description: 'القدرة على الكتابة الصحيحة'
    })
  }
);
const skillData = await skillResponse.json();
console.log('تم إضافة المهارة:', skillData.skill);
```

---

## ملاحظات ختامية

- جميع الـ Timestamps بصيغة ISO 8601
- الـ UUID يُستخدم لجميع المعرفات (IDs)
- جميع الاستجابات JSON format
- الأخطاء تُعيد `success: false` مع `message`

للمزيد من التفاصيل، راجع [VERCEL_POSTGRES_SETUP.md](VERCEL_POSTGRES_SETUP.md)
