// ملف التحديثات والإضافات الأمنية
// أضف هذا الملف بعد backup-data.js في الملف الرئيسي

// تحديث الدالة toggleSkill لإضافة تسجيل النشاط
const originalToggleSkill = window.toggleSkill;
window.toggleSkill = function(index) {
    const student = students.find(s => s.id === selectedStudentId);
    student.skills[index].done = !student.skills[index].done;
    student.skills[index].completedAt = student.skills[index].done ? new Date().toISOString() : null;
    renderSkillsTable(student);
    securityManager.logActivity('skill_toggled', { 
        student: student.name, 
        skill: student.skills[index].missing, 
        status: student.skills[index].done 
    });
    dataBackup.createBackup(students);
};

// تحديث الدالة deleteSkill لإضافة تسجيل النشاط
const originalDeleteSkill = window.deleteSkill;
window.deleteSkill = function(index) {
    if (!isAdmin) return;
    if (confirm("هل أنت متأكد من حذف هذه المهارة؟")) {
        const student = students.find(s => s.id === selectedStudentId);
        const deletedSkill = student.skills[index].missing;
        student.skills.splice(index, 1);
        renderSkillsTable(student);
        securityManager.logActivity('skill_deleted', { student: student.name, skill: deletedSkill });
        dataBackup.createBackup(students);
    }
};

// تحميل البيانات المحفوظة عند بدء التطبيق
window.addEventListener('DOMContentLoaded', function() {
    // تحميل من النسخة الاحتياطية
    const backup = dataBackup.restoreBackup();
    if (backup.success && backup.data && backup.data.length > 0) {
        students = backup.data;
        console.log('✅ تم تحميل البيانات المحفوظة');
    }
    
    // تسجيل بدء التطبيق
    securityManager.logActivity('app_started', { timestamp: new Date().toISOString() });
    
    console.log('🔐 نظام الأمان مفعل');
    console.log('💾 النسخ الاحتياطية مفعلة');
    console.log('📱 Service Worker جاهز');
});

// إضافة خيارات للمعلم في لوحة التحكم
console.log(`
╔════════════════════════════════════════╗
║   نظام مهارات الطلاب - جاهز للاستخدام   ║
╚════════════════════════════════════════╝

🔐 الأمان: محمي
💾 النسخ الاحتياطية: مفعلة  
📱 الوضع دون اتصال: مفعل
📊 التسجيل: نشط

كلمة المرور الافتراضية: admin
`);
