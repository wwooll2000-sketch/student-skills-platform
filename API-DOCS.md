# 📡 وثائق APIs

## مقدمة

تم تطوير نظامين من الـ APIs:
1. **AdminAPI** - لإدارة البيانات والطلاب
2. **StudentAPI** - للوصول لبيانات الطالب والمهارات

---

## 🔐 Admin API

### الدخول (Login)

```javascript
await adminAPI.login(password)
```

**المعاملات:**
- `password` (string) - كلمة المرور

**الاستجابة:**
```json
{
  "success": true,
  "message": "تم تسجيل الدخول بنجاح",
  "token": "admin_...",
  "user": { "role": "admin", "name": "المعلم" }
}
```

### الخروج (Logout)

```javascript
await adminAPI.logout()
```

**الاستجابة:**
```json
{
  "success": true,
  "message": "تم تسجيل الخروج بنجاح"
}
```

### إضافة طالب (Add Student)

```javascript
await adminAPI.addStudent(name)
```

**المعاملات:**
- `name` (string) - اسم الطالب

**الاستجابة:**
```json
{
  "success": true,
  "message": "تم إضافة الطالب بنجاح",
  "data": {
    "id": 1234567890,
    "name": "محمد أحمد",
    "code": "5432",
    "skills": [],
    "createdAt": "2026-01-27T10:00:00.000Z"
  }
}
```

### حذف طالب (Delete Student)

```javascript
await adminAPI.deleteStudent(studentId)
```

**المعاملات:**
- `studentId` (number) - معرف الطالب

**الاستجابة:**
```json
{
  "success": true,
  "message": "تم حذف الطالب بنجاح",
  "deletedId": 1234567890
}
```

### إضافة مهارة (Add Skill)

```javascript
await adminAPI.addSkill(studentId, skillData)
```

**المعاملات:**
- `studentId` (number) - معرف الطالب
- `skillData` (object) - البيانات:
  ```javascript
  {
    "missing": "اسم المهارة",
    "url": "رابط الملف"
  }
  ```

**الاستجابة:**
```json
{
  "success": true,
  "message": "تم إضافة المهارة بنجاح",
  "data": {
    "id": 1234567890,
    "missing": "التمييز بين ال الشمسية",
    "url": "https://...",
    "done": false,
    "addedAt": "2026-01-27T10:00:00.000Z"
  }
}
```

### تحديث حالة المهارة (Update Skill Status)

```javascript
await adminAPI.updateSkillStatus(studentId, skillId, status)
```

**المعاملات:**
- `studentId` (number) - معرف الطالب
- `skillId` (number) - معرف المهارة
- `status` (boolean) - الحالة (true/false)

**الاستجابة:**
```json
{
  "success": true,
  "message": "تم تحديث حالة المهارة",
  "data": { "studentId": 1234567890, "skillId": 9876543210, "status": true }
}
```

### حذف مهارة (Delete Skill)

```javascript
await adminAPI.deleteSkill(studentId, skillId)
```

**المعاملات:**
- `studentId` (number) - معرف الطالب
- `skillId` (number) - معرف المهارة

**الاستجابة:**
```json
{
  "success": true,
  "message": "تم حذف المهارة بنجاح"
}
```

### الحصول على جميع الطلاب (Get All Students)

```javascript
await adminAPI.getAllStudents()
```

**الاستجابة:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "محمد", "code": "1234", "skills": [] },
    { "id": 2, "name": "فاطمة", "code": "5678", "skills": [] }
  ]
}
```

### الحصول على التقارير (Get Reports)

```javascript
await adminAPI.getReports()
```

**الاستجابة:**
```json
{
  "success": true,
  "data": {
    "totalStudents": 25,
    "totalSkills": 150,
    "completedSkills": 85,
    "completionRate": "56.67",
    "generatedAt": "2026-01-27T10:00:00.000Z"
  }
}
```

### تصدير البيانات (Export Data)

```javascript
await adminAPI.exportData()
```

**الاستجابة:**
```json
{
  "success": true,
  "data": {
    "exportDate": "2026-01-27T10:00:00.000Z",
    "version": "1.0",
    "students": [...],
    "totalRecords": 25
  }
}
```

### استيراد البيانات (Import Data)

```javascript
await adminAPI.importData(data)
```

**المعاملات:**
- `data` (array) - مصفوفة البيانات المراد استيرادها

**الاستجابة:**
```json
{
  "success": true,
  "message": "تم استيراد البيانات بنجاح"
}
```

---

## 📚 Student API

### دخول الطالب (Login)

```javascript
await studentAPI.login(studentCode)
```

**المعاملات:**
- `studentCode` (string) - رقم الطالب

**الاستجابة:**
```json
{
  "success": true,
  "message": "تم الدخول بنجاح",
  "student": {
    "id": 1234567890,
    "name": "محمد أحمد",
    "code": "5432",
    "skillsCount": 5
  }
}
```

### خروج الطالب (Logout)

```javascript
await studentAPI.logout()
```

**الاستجابة:**
```json
{
  "success": true,
  "message": "تم تسجيل الخروج بنجاح"
}
```

### الحصول على بيانات الطالب (Get Student Data)

```javascript
await studentAPI.getStudentData()
```

**الاستجابة:**
```json
{
  "success": true,
  "data": {
    "id": 1234567890,
    "name": "محمد أحمد",
    "code": "5432",
    "joinDate": "2026-01-20T10:00:00.000Z",
    "skillsCount": 5,
    "completedSkills": 2
  }
}
```

### الحصول على المهارات (Get Skills)

```javascript
await studentAPI.getSkills()
```

**الاستجابة:**
```json
{
  "success": true,
  "data": {
    "totalSkills": 5,
    "completedSkills": 2,
    "pendingSkills": 3,
    "completionRate": "40.00",
    "skills": [
      {
        "id": 9876543210,
        "name": "التمييز بين ال الشمسية",
        "status": "مكتمل",
        "url": "https://...",
        "addedDate": "2026-01-20T10:00:00.000Z",
        "completedDate": "2026-01-25T10:00:00.000Z"
      }
    ]
  }
}
```

### الحصول على تفاصيل مهارة (Get Skill Details)

```javascript
await studentAPI.getSkillDetails(skillId)
```

**المعاملات:**
- `skillId` (number) - معرف المهارة

**الاستجابة:**
```json
{
  "success": true,
  "data": {
    "id": 9876543210,
    "name": "التمييز بين ال الشمسية",
    "description": "التمييز بين ال الشمسية",
    "status": "مكتمل",
    "fileURL": "https://...",
    "addedDate": "2026-01-20T10:00:00.000Z",
    "completedDate": "2026-01-25T10:00:00.000Z",
    "notes": ""
  }
}
```

### الحصول على الإحصائيات (Get Statistics)

```javascript
await studentAPI.getStatistics()
```

**الاستجابة:**
```json
{
  "success": true,
  "data": {
    "studentName": "محمد أحمد",
    "joinDate": "2026-01-20T10:00:00.000Z",
    "daysActive": 7,
    "totalSkills": 5,
    "completedSkills": 2,
    "pendingSkills": 3,
    "completionRate": "40.00",
    "lastUpdated": "2026-01-27T10:00:00.000Z"
  }
}
```

### تحميل ملف (Download Resource)

```javascript
await studentAPI.downloadResource(skillId)
```

**المعاملات:**
- `skillId` (number) - معرف المهارة

**الاستجابة:**
```json
{
  "success": true,
  "message": "تم تحضير الملف للتحميل",
  "data": {
    "skillName": "التمييز بين ال الشمسية",
    "resourceURL": "https://...",
    "downloadedAt": "2026-01-27T10:00:00.000Z"
  }
}
```

### الحصول على التنبيهات (Get Notifications)

```javascript
await studentAPI.getNotifications()
```

**الاستجابة:**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "type": "new_skill",
        "message": "تم إضافة 2 مهارة جديدة",
        "count": 2,
        "timestamp": "2026-01-27T10:00:00.000Z"
      },
      {
        "type": "pending_skills",
        "message": "لديك 3 مهارات قيد الإنجاز",
        "count": 3,
        "timestamp": "2026-01-27T10:00:00.000Z"
      }
    ],
    "unreadCount": 2
  }
}
```

---

## ✅ أمثلة الاستخدام

### مثال 1: دخول الأدمن وإضافة طالب

```javascript
// دخول الأدمن
const loginResult = await adminAPI.login("admin");

if (loginResult.success) {
  // إضافة طالب
  const studentResult = await adminAPI.addStudent("محمد أحمد");
  
  if (studentResult.success) {
    console.log(`تم إضافة الطالب برقم: ${studentResult.data.code}`);
  }
}
```

### مثال 2: دخول الطالب وعرض المهارات

```javascript
// دخول الطالب
const loginResult = await studentAPI.login("1234");

if (loginResult.success) {
  // الحصول على المهارات
  const skillsResult = await studentAPI.getSkills();
  
  if (skillsResult.success) {
    console.log(`لديك ${skillsResult.data.totalSkills} مهارة`);
    console.log(`مكتمل: ${skillsResult.data.completedSkills}`);
    console.log(`قيد الإنجاز: ${skillsResult.data.pendingSkills}`);
  }
}
```

### مثال 3: الأدمن يضيف مهارة

```javascript
const skillData = {
  missing: "التنوين",
  url: "https://example.com/skill1"
};

const result = await adminAPI.addSkill(studentId, skillData);

if (result.success) {
  console.log("تم إضافة المهارة بنجاح");
}
```

---

## 🔒 معلومات الأمان

### التفويض (Authorization)
- الأدمن: يتم التفويض عبر كلمة المرور
- الطالب: يتم التفويض عبر رقم الطالب

### جلسة العمل (Session)
- مدة جلسة الأدمن: ساعة واحدة
- مدة جلسة الطالب: ساعة واحدة
- يتم تخزين الرمز في SessionStorage فقط (جلسات مؤقتة)
- جميع البيانات الأخرى تُحفظ في قاعدة البيانات

### التشفير (Encryption)
- تشفير البيانات الحساسة
- تنظيف المدخلات من XSS
- التحقق من الصلاحيات قبل كل عملية

---

## 🚀 الأخطاء والاستثناءات

### رموز الأخطاء الشائعة:

| الخطأ | المعنى | الحل |
|------|--------|------|
| `غير مصرح` | بدون صلاحية | قم بتسجيل الدخول أولاً |
| `رقم الطالب غير موجود` | الرقم خاطئ | تحقق من الرقم |
| `بيانات غير صحيحة` | صيغة خاطئة | أعد صيغة البيانات |
| `خطأ في الخادم` | خطأ عام | حاول لاحقاً |

---

**آخر تحديث**: 27/01/2026
**الإصدار**: 1.0.0
**الحالة**: جاهز للاستخدام
