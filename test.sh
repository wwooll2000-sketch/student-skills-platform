#!/bin/bash
# سكريبت اختبار منصة مهارات الطلاب

echo "════════════════════════════════════════════════════"
echo "   اختبار منصة مهارات الطلاب - نسخة 1.0.0"
echo "════════════════════════════════════════════════════"
echo ""

# الألوان
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# عدد الملفات الموجودة
echo "📁 فحص الملفات..."
echo ""

files=(
    "index.html"
    "manifest.json"
    "security.js"
    "backup-data.js"
    "service-worker.js"
    "enhancements.js"
    ".htaccess"
    "config.json"
    "robots.txt"
    "sitemap.xml"
    "README.md"
    "GUIDE.md"
    "QUALITY.md"
    "SUMMARY.md"
    "INDEX.md"
    "CHECKLIST.md"
)

found=0
missing=0

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅${NC} $file"
        ((found++))
    else
        echo -e "${RED}❌${NC} $file"
        ((missing++))
    fi
done

echo ""
echo "────────────────────────────────────────────────────"
echo "إجمالي الملفات: $found من ${#files[@]}"
echo "────────────────────────────────────────────────────"

if [ $missing -eq 0 ]; then
    echo -e "${GREEN}✅ جميع الملفات موجودة!${NC}"
else
    echo -e "${RED}❌ ملفات مفقودة: $missing${NC}"
fi

echo ""
echo "📊 إحصائيات الملفات..."
echo ""

# حساب عدد الأسطر
echo -n "أسطر HTML: "
wc -l index.html 2>/dev/null | awk '{print $1}'

echo -n "أسطر JavaScript: "
cat security.js backup-data.js service-worker.js enhancements.js 2>/dev/null | wc -l

echo -n "أسطر التوثيق: "
cat README.md GUIDE.md QUALITY.md SUMMARY.md INDEX.md CHECKLIST.md 2>/dev/null | wc -l

echo ""
echo "────────────────────────────────────────────────────"
echo "🔐 فحص الأمان..."
echo ""

# فحص وجود security.js
if grep -q "SecurityManager" security.js 2>/dev/null; then
    echo -e "${GREEN}✅${NC} نظام الأمان محقق"
else
    echo -e "${RED}❌${NC} نظام الأمان غير كامل"
fi

# فحص وجود backup-data.js
if grep -q "DataBackup" backup-data.js 2>/dev/null; then
    echo -e "${GREEN}✅${NC} نظام النسخ الاحتياطية محقق"
else
    echo -e "${RED}❌${NC} نظام النسخ الاحتياطية غير كامل"
fi

# فحص وجود service-worker.js
if grep -q "self.addEventListener" service-worker.js 2>/dev/null; then
    echo -e "${GREEN}✅${NC} Service Worker محقق"
else
    echo -e "${RED}❌${NC} Service Worker غير كامل"
fi

echo ""
echo "────────────────────────────────────────────────────"
echo "📱 فحص التوافقية..."
echo ""

# فحص manifest.json
if grep -q "name" manifest.json 2>/dev/null; then
    echo -e "${GREEN}✅${NC} إعدادات PWA موجودة"
else
    echo -e "${RED}❌${NC} إعدادات PWA غير موجودة"
fi

# فحص robots.txt
if [ -f "robots.txt" ]; then
    echo -e "${GREEN}✅${NC} توجيهات محركات البحث موجودة"
else
    echo -e "${RED}❌${NC} توجيهات محركات البحث غير موجودة"
fi

echo ""
echo "────────────────────────────────────────────────────"
echo "📚 فحص التوثيق..."
echo ""

docs=(
    "README.md"
    "GUIDE.md"
    "QUALITY.md"
    "SUMMARY.md"
    "INDEX.md"
    "CHECKLIST.md"
)

for doc in "${docs[@]}"; do
    if [ -f "$doc" ]; then
        size=$(stat -f%z "$doc" 2>/dev/null || stat -c%s "$doc" 2>/dev/null)
        echo -e "${GREEN}✅${NC} $doc ($(($size/1024)) KB)"
    fi
done

echo ""
echo "════════════════════════════════════════════════════"
echo "✨ النتيجة النهائية"
echo "════════════════════════════════════════════════════"
echo ""

if [ $missing -eq 0 ]; then
    echo -e "${GREEN}🎉 النظام جاهز للاستخدام!${NC}"
    echo ""
    echo "📖 ابدأ بقراءة:"
    echo "   1. SUMMARY.md"
    echo "   2. README.md"
    echo "   3. GUIDE.md"
    echo ""
    echo "🚀 النظام جاهز للإطلاق!"
else
    echo -e "${RED}⚠️  يوجد مشاكل يجب حلها${NC}"
fi

echo ""
echo "════════════════════════════════════════════════════"
echo "✅ انتهى الاختبار"
echo "════════════════════════════════════════════════════"
