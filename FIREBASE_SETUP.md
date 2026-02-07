# إعداد Firebase لحفظ البيانات 🔥

## الخطوة 1: إنشاء مشروع Firebase

1. اذهب إلى [Firebase Console](https://console.firebase.google.com)
2. اضغط **"Add project"** أو **"إضافة مشروع"**
3. اكتب اسم المشروع (مثل: `student-skills-platform`)
4. اضغط "Continue"
5. اختر البلد واضغط "Create project"

## الخطوة 2: إضافة تطبيق الويب

1. في صفحة المشروع، اضغط أيقونة الويب `</>`
2. اكتب اسم التطبيق
3. اضغط "Register app"
4. **نسخ كود Firebase** الذي سيظهر لك

## الخطوة 3: إضافة بيانات الاعتماد

في ملف `firebase-config.js`، استبدل:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

بالقيم من Firebase Console (انسخ من **Project settings** → **Your apps**)

## الخطوة 4: تفعيل Firestore

1. في Firebase Console، اذهب إلى **Build** → **Firestore Database**
2. اضغط **"Create database"**
3. اختر **"Start in production mode"**
4. اختر المنطقة (الأقرب إليك)
5. اضغط "Enable"

## الخطوة 5: تعديل قواعد الأمان (Security Rules)

في **Firestore Database** → **Rules**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /students/{document=**} {
      allow read, write: if request.auth == null || request.auth != null;
    }
  }
}
```

⚠️ **ملاحظة أمان**: هذا يسمح بالقراءة والكتابة للجميع. للأمان أفضل، استخدم المصادقة.

## الخطوة 6: اختبار الاتصال

1. احفظ `firebase-config.js` ببيانات صحيحة
2. افتح الموقع
3. أضف طالب جديد
4. اذهب إلى Firestore Console وتحقق من وجود البيانات

## الميزات التي أضفناها:

✅ حفظ تلقائي للبيانات على Firebase  
✅ تحميل البيانات من السحابة عند فتح الموقع  
✅ احتفاظ بـ localStorage كنسخة احتياطية  
✅ مزامنة حقيقية بين الأجهزة  

## استكشاف الأخطاء:

**المشكلة**: "Firebase is not defined"
**الحل**: تأكد من ترتيب السكريبتات في HTML

**المشكلة**: "Permission denied"
**الحل**: تحقق من قواعد الأمان في Firestore

**المشكلة**: لا يتم حفظ البيانات
**الحل**: تأكد من بيانات Firebase صحيحة وتفعيل Firestore

---

للدعم: [Firebase Documentation](https://firebase.google.com/docs)
