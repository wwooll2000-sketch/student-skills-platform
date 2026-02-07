# قائمة فحص النشر على Vercel مع PostgreSQL

## ✅ المتطلبات الأساسية قبل النشر

### قاعدة البيانات (Neon PostgreSQL)
- [ ] حساب Neon نشط ومتحقق منه
- [ ] مشروع PostgreSQL تم إنشاؤه
- [ ] رابط اتصال Database URL تم الحصول عليه
- [ ] اختبار الاتصال من الآلة المحلية
- [ ] النسخة الاحتياطية الأولى من البيانات (إن وجدت)

### Vercel
- [ ] حساب Vercel مُنشأ
- [ ] مستودع GitHub متصل
- [ ] Project Settings مُعدة
- [ ] جميع Environment Variables مأضفة

### التطبيق المحلي
- [ ] `npm install` تم تنفيذه بنجاح
- [ ] `.env.local` معرّف وصحيح
- [ ] `npm run dev` يعمل بدون أخطاء
- [ ] Database test endpoints تستجيب

---

## 📋 قائمة فحص الكود

### Backend API
- [ ] `api/index.js` موجود ومُعدّ
- [ ] `api/db.js` مع طلب الاتصال صحيح
- [ ] `api/auth.js` لديه JWT وتشفير آمن
- [ ] `api/routes/student.js` يحتوي جميع نقاط النهاية
- [ ] `api/routes/admin.js` محمي بـ verifyAdminToken

### Frontend
- [ ] `api-student.js` يستخدم API الجديد
- [ ] `api-admin.js` يستخدم API الجديد
- [ ] Firebase imports تم الاستغناء عنها
- [ ] localStorage يُستخدم فقط للـ tokens

### ملفات الإعدادات
- [ ] `package.json` مع جميع المكتبات
- [ ] `vercel.json` صحيح ومفصل
- [ ] `.env.example` معرّف جميع المتغيرات
- [ ] `.gitignore` يستبعد الملفات الحساسة

---

## 🔒 قائمة فحص الأمان

- [ ] كلمة مرور الأدمن تم تغييرها من الافتراضية
- [ ] JWT_SECRET مفتاح قوي وعشوائي
- [ ] رابط DATABASE_URL لم يتم مشاركته أبداً
- [ ] جميع المتغيرات الحساسة في Environment Variables
- [ ] لا توجد credentials في الكود أو التعليقات
- [ ] HTTPS مفعل في جميع الاتصالات
- [ ] CORS مُعدَّ بشكل صحيح
- [ ] Security headers مُفعلة

---

## 📊 قائمة فحص الأداء

- [ ] الاستعلامات التالية مختبرة:
  - [ ] جلب جميع الطلاب (يجب أن يكون < 1s)
  - [ ] جلب مهارات الطالب (يجب أن يكون < 500ms)
  - [ ] إضافة طالب جديد (يجب أن يكون < 500ms)
- [ ] الفهارس الموجودة على الخانات المهمة
- [ ] Connection pooling مُعدّ صحيح

---

## 🚀 خطوات النشر

### 1. الإعداد الأخير المحلي
```bash
# تحديث جميع المكتبات
npm install

# الاختبار النهائي
npm run dev

# اختبار endpoints
curl http://localhost:3000/api/health
curl http://localhost:3000/api/db-status
```

- [ ] جميع الاختبارات نجحت

### 2. Git الأخير
```bash
# التحقق من الملفات
git status

# إضافة جميع التغييرات
git add .

# Commit مع رسالة واضحة
git commit -m "Setup PostgreSQL with Vercel deployment"

# دفع إلى GitHub
git push origin main
```

- [ ] Push نجح بدون أخطاء

### 3. Vercel Deployment
```bash
# في لوحة Vercel
# - اضغط "Deploy"
# - تحقق من البناء (Build logs)
# - تحقق من دخول الدالات (Function logs)
```

- [ ] Build نجح
- [ ] Functions تعمل بدون أخطاء
- [ ] Environment Variables تم تطبيقها

### 4. الاختبار بعد النشر
```bash
# استبدل YOUR_VERCEL_URL برابل موقعك
curl https://YOUR_VERCEL_URL/api/health
curl https://YOUR_VERCEL_URL/api/db-status

# اختبر تسجيل دخول الأدمن
curl -X POST https://YOUR_VERCEL_URL/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password":"admin123"}'
```

- [ ] Health check يرد بـ 200
- [ ] Database status يرد بـ 200
- [ ] Admin login يرد بـ token

---

## 📱 الاختبار على الجهاز

### تسجيل دخول الأدمن
1. [ ] افتح الموقع
2. [ ] اختر "Admin Login"
3. [ ] أدخل كلمة المرور
4. [ ] يجب أن تشاهد لوحة التحكم

### تسجيل دخول الطالب
1. [ ] انقر "Student Login"
2. [ ] أدخل رقم طالب موجود
3. [ ] يجب أن تشاهد بيانات الطالب

### العمليات الأساسية
- [ ] إضافة طالب
- [ ] إضافة مهارة
- [ ] عرض الإحصائيات
- [ ] تحديث البيانات

---

## 🔍 استكشاف الأخطاء

### إذا فشل Build
```bash
# تحقق من السجلات في Vercel
# اضغط على "View Function Logs"

# الأسباب الشائعة:
# - خطأ في npm install
# - متغيرات بيئية ناقصة
# - خطأ في الكود
```

- [ ] تم فحص والبناء الثاني نجح

### إذا كانت قاعدة البيانات لا تعمل
```bash
# تحقق من رابط الاتصال
echo $DATABASE_URL

# اختبر الاتصال المحلي
psql $DATABASE_URL

# تحقق من الأذونات في Neon
```

- [ ] الاتصال يعمل

### إذا كان الموقع بطيء
- [ ] تحقق من الفهارس في قاعدة البيانات
- [ ] تحقق من وقت response في Function logs
- [ ] أضف caching إذا لزم الأمر

---

## 📞 خطوات المتابعة

بعد النشر الناجح:

1. **راقب الأداء**
   - [ ] افتح Vercel Analytics
   - [ ] تحقق من Core Web Vitals
   - [ ] راقب نسبة الأخطاء

2. **نسخ احتياطية**
   - [ ] استخدم `api/migrate.js export` يومياً
   - [ ] احفظ الملفات في مكان آمن
   - [ ] اختبر الاستعادة شهرياً

3. **الصيانة**
   - [ ] حدّث المكتبات شهرياً
   - [ ] راجع السجلات أسبوعياً
   - [ ] اختبر الاستعادة من النسخة الاحتياطية

4. **الأمان**
   - [ ] غير كلمات المرور كل 3 أشهر
   - [ ] راقب محاولات الدخول الفاشلة
   - [ ] استخدم 2FA على Vercel و Neon

---

## ✨ ملاحظات إضافية

- يمكنك استخدام `vercel logs` لفحص السجلات
- استخدم `vercel env ls` لرؤية جميع المتغيرات
- للدعم: وثائق Vercel على https://vercel.com/docs

---

## 📝 توقيع الإكمال

- [ ] تم إكمال جميع الخطوات
- [ ] الموقع يعمل بدون مشاكل
- [ ] النسخة الاحتياطية الأولى موجودة
- [ ] جميع الفريق على اطلاع بالعملية

**تاريخ الانتهاء:** _______________

**المسؤول:** _______________
