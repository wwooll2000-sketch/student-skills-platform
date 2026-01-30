// API للأدمن - نظام إدارة شامل
class AdminAPI {
  constructor() {
    this.baseURL = '/api/admin';
    this.authToken = null;
    this.sessionTimeout = 3600000; // ساعة واحدة
  }

  // تسجيل الدخول
  async login(password) {
    try {
      // التحقق المحلي (في بيئة الإنتاج ستكون استدعاء API)
      if (password === "admin" || password === "admin123") {
        this.authToken = this.generateToken();
        localStorage.setItem('admin_token', this.authToken);
        localStorage.setItem('admin_login_time', Date.now().toString());
        
        return {
          success: true,
          message: 'تم تسجيل الدخول بنجاح',
          token: this.authToken,
          user: { role: 'admin', name: 'المعلم' }
        };
      } else {
        return { success: false, message: 'كلمة مرور غير صحيحة' };
      }
    } catch (error) {
      return { success: false, message: 'حدث خطأ في التسجيل: ' + error.message };
    }
  }

  // تسجيل الخروج
  async logout() {
    try {
      this.authToken = null;
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_login_time');
      return { success: true, message: 'تم تسجيل الخروج بنجاح' };
    } catch (error) {
      return { success: false, message: 'خطأ في تسجيل الخروج' };
    }
  }

  // إضافة طالب
  async addStudent(name) {
    if (!this.isAuthorized()) {
      return { success: false, message: 'غير مصرح - يرجى تسجيل الدخول' };
    }

    try {
      const newCode = this.generateStudentCode();
      const student = {
        id: Date.now(),
        name: name,
        code: newCode,
        skills: [],
        createdAt: new Date().toISOString(),
        createdBy: 'admin'
      };

      return { success: true, data: student, message: 'تم إضافة الطالب بنجاح' };
    } catch (error) {
      return { success: false, message: 'خطأ في إضافة الطالب: ' + error.message };
    }
  }

  // حذف طالب
  async deleteStudent(studentId) {
    if (!this.isAuthorized()) {
      return { success: false, message: 'غير مصرح' };
    }

    try {
      return { success: true, message: 'تم حذف الطالب بنجاح', deletedId: studentId };
    } catch (error) {
      return { success: false, message: 'خطأ في حذف الطالب' };
    }
  }

  // إضافة مهارة
  async addSkill(studentId, skillData) {
    if (!this.isAuthorized()) {
      return { success: false, message: 'غير مصرح' };
    }

    try {
      const skill = {
        id: Date.now(),
        missing: skillData.missing,
        url: skillData.url,
        done: false,
        addedAt: new Date().toISOString(),
        addedBy: 'admin'
      };

      return { success: true, data: skill, message: 'تم إضافة المهارة بنجاح' };
    } catch (error) {
      return { success: false, message: 'خطأ في إضافة المهارة' };
    }
  }

  // تحديث حالة المهارة
  async updateSkillStatus(studentId, skillId, status) {
    if (!this.isAuthorized()) {
      return { success: false, message: 'غير مصرح' };
    }

    try {
      return {
        success: true,
        message: 'تم تحديث حالة المهارة',
        data: { studentId, skillId, status }
      };
    } catch (error) {
      return { success: false, message: 'خطأ في التحديث' };
    }
  }

  // حذف مهارة
  async deleteSkill(studentId, skillId) {
    if (!this.isAuthorized()) {
      return { success: false, message: 'غير مصرح' };
    }

    try {
      return { success: true, message: 'تم حذف المهارة بنجاح' };
    } catch (error) {
      return { success: false, message: 'خطأ في حذف المهارة' };
    }
  }

  // الحصول على جميع الطلاب
  async getAllStudents() {
    if (!this.isAuthorized()) {
      return { success: false, message: 'غير مصرح' };
    }

    try {
      const students = JSON.parse(localStorage.getItem('students_data') || '[]');
      return { success: true, data: students };
    } catch (error) {
      return { success: false, message: 'خطأ في جلب البيانات' };
    }
  }

  // الحصول على تقارير
  async getReports() {
    if (!this.isAuthorized()) {
      return { success: false, message: 'غير مصرح' };
    }

    try {
      const students = JSON.parse(localStorage.getItem('students_data') || '[]');
      const totalStudents = students.length;
      const totalSkills = students.reduce((sum, s) => sum + s.skills.length, 0);
      const completedSkills = students.reduce((sum, s) => sum + s.skills.filter(sk => sk.done).length, 0);
      const completionRate = totalSkills > 0 ? (completedSkills / totalSkills * 100).toFixed(2) : 0;

      return {
        success: true,
        data: {
          totalStudents,
          totalSkills,
          completedSkills,
          completionRate,
          generatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      return { success: false, message: 'خطأ في إنشاء التقرير' };
    }
  }

  // تصدير البيانات
  async exportData() {
    if (!this.isAuthorized()) {
      return { success: false, message: 'غير مصرح' };
    }

    try {
      const students = JSON.parse(localStorage.getItem('students_data') || '[]');
      const exportData = {
        exportDate: new Date().toISOString(),
        version: '1.0',
        students: students,
        totalRecords: students.length
      };

      return { success: true, data: exportData };
    } catch (error) {
      return { success: false, message: 'خطأ في التصدير' };
    }
  }

  // استيراد البيانات
  async importData(data) {
    if (!this.isAuthorized()) {
      return { success: false, message: 'غير مصرح' };
    }

    try {
      if (!Array.isArray(data)) {
        return { success: false, message: 'صيغة البيانات غير صحيحة' };
      }

      localStorage.setItem('students_data', JSON.stringify(data));
      return { success: true, message: 'تم استيراد البيانات بنجاح' };
    } catch (error) {
      return { success: false, message: 'خطأ في الاستيراد' };
    }
  }

  // التحقق من الصلاحية
  isAuthorized() {
    const token = localStorage.getItem('admin_token');
    const loginTime = parseInt(localStorage.getItem('admin_login_time') || '0');
    const now = Date.now();

    if (!token || (now - loginTime) > this.sessionTimeout) {
      return false;
    }

    return true;
  }

  // توليد رمز
  generateToken() {
    return 'admin_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }

  // توليد رقم الطالب
  generateStudentCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }
}

// إنشاء نسخة من API الأدمن
const adminAPI = new AdminAPI();
