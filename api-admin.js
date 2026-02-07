// API للأدمن - نظام إدارة شامل
class AdminAPI {
  constructor() {
    this.baseURL = '/api/admin';
    this.authToken = null;
    this.sessionTimeout = 86400000; // 24 ساعة
  }

  // تسجيل الدخول
  async login(password) {
    try {
      const response = await fetch(`${this.baseURL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const data = await response.json();
      
      if (data.success) {
        this.authToken = data.token;
        sessionStorage.setItem('admin_token', data.token);
        sessionStorage.setItem('admin_login_time', Date.now().toString());
      }

      return data;
    } catch (error) {
      console.error('خطأ في تسجيل الدخول:', error);
      return { success: false, message: 'خطأ في الاتصال بالخادم: ' + error.message };
    }
  }

  // تسجيل الخروج
  async logout() {
    try {
      this.authToken = null;
      sessionStorage.removeItem('admin_token');
      sessionStorage.removeItem('admin_login_time');
      return { success: true, message: 'تم تسجيل الخروج بنجاح' };
    } catch (error) {
      return { success: false, message: 'خطأ في تسجيل الخروج' };
    }
  }

  // إضافة طالب
  async addStudent(name, code, email, studentClass) {
    if (!this.isAuthorized()) {
      return { success: false, message: 'غير مصرح - يرجى تسجيل الدخول' };
    }

    try {
      const response = await fetch(`${this.baseURL}/students`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        },
        body: JSON.stringify({ name, code, email, class: studentClass })
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('خطأ في إضافة الطالب:', error);
      return { success: false, message: 'خطأ في الاتصال بالخادم' };
    }
  }

  // حذف طالب
  async deleteStudent(studentId) {
    if (!this.isAuthorized()) {
      return { success: false, message: 'غير مصرح' };
    }

    try {
      const response = await fetch(`${this.baseURL}/students/${studentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${this.authToken}` }
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('خطأ في حذف الطالب:', error);
      return { success: false, message: 'خطأ في الاتصال بالخادم' };
    }
  }

  // إضافة مهارة
  async addSkill(studentId, name, level, description, category, notes) {
    if (!this.isAuthorized()) {
      return { success: false, message: 'غير مصرح' };
    }

    try {
      const response = await fetch(`${this.baseURL}/students/${studentId}/skills`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        },
        body: JSON.stringify({ name, level, description, category, notes })
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('خطأ في إضافة المهارة:', error);
      return { success: false, message: 'خطأ في الاتصال بالخادم' };
    }
  }

  // تحديث مهارة
  async updateSkill(skillId, name, level, description, category, notes) {
    if (!this.isAuthorized()) {
      return { success: false, message: 'غير مصرح' };
    }

    try {
      const response = await fetch(`${this.baseURL}/skills/${skillId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        },
        body: JSON.stringify({ name, level, description, category, notes })
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('خطأ في تحديث المهارة:', error);
      return { success: false, message: 'خطأ في الاتصال بالخادم' };
    }
  }

  // حذف مهارة
  async deleteSkill(skillId) {
    if (!this.isAuthorized()) {
      return { success: false, message: 'غير مصرح' };
    }

    try {
      const response = await fetch(`${this.baseURL}/skills/${skillId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${this.authToken}` }
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('خطأ في حذف المهارة:', error);
      return { success: false, message: 'خطأ في الاتصال بالخادم' };
    }
  }

  // الحصول على جميع الطلاب
  async getAllStudents() {
    if (!this.isAuthorized()) {
      return { success: false, message: 'غير مصرح' };
    }

    try {
      const response = await fetch(`${this.baseURL}/students`, {
        headers: { 'Authorization': `Bearer ${this.authToken}` }
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('خطأ في جلب الطلاب:', error);
      return { success: false, message: 'خطأ في الاتصال بالخادم' };
    }
  }

  // الحصول على الإحصائيات
  async getStats() {
    if (!this.isAuthorized()) {
      return { success: false, message: 'غير مصرح' };
    }

    try {
      const response = await fetch(`${this.baseURL}/stats`, {
        headers: { 'Authorization': `Bearer ${this.authToken}` }
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('خطأ في جلب الإحصائيات:', error);
      return { success: false, message: 'خطأ في الاتصال بالخادم' };
    }
  }

  // تصدير البيانات
  async exportData() {
    if (!this.isAuthorized()) {
      return { success: false, message: 'غير مصرح' };
    }

    try {
      const studentsResponse = await this.getAllStudents();
      
      if (!studentsResponse.success) {
        return { success: false, message: 'خطأ في جلب البيانات' };
      }

      const exportData = {
        exportDate: new Date().toISOString(),
        version: '2.0',
        students: studentsResponse.students,
        totalRecords: studentsResponse.students.length
      };

      return { success: true, data: exportData };
    } catch (error) {
      console.error('خطأ في التصدير:', error);
      return { success: false, message: 'خطأ في التصدير' };
    }
  }

  // التحقق من الصلاحية
  isAuthorized() {
    const token = sessionStorage.getItem('admin_token');
    const loginTime = parseInt(sessionStorage.getItem('admin_login_time') || '0');
    const now = Date.now();

    if (!token || (now - loginTime) > this.sessionTimeout) {
      return false;
    }

    return true;
  }
}

// إنشاء نسخة من API الأدمن
const adminAPI = new AdminAPI();
