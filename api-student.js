// API للطلاب - نظام الوصول والمتابعة
class StudentAPI {
  constructor() {
    this.baseURL = '/api/student';
    this.studentId = null;
    this.studentCode = null;
  }

  // تسجيل الدخول برقم الطالب
  async login(studentCode) {
    try {
      if (!studentCode || studentCode.length < 4) {
        return { success: false, message: 'رقم الطالب غير صحيح' };
      }

      const response = await fetch(`${this.baseURL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentCode })
      });

      const data = await response.json();

      if (data.success) {
        this.studentId = data.student.id;
        this.studentCode = studentCode;
        sessionStorage.setItem('student_id', data.student.id);
        sessionStorage.setItem('student_code', studentCode);
        sessionStorage.setItem('student_login_time', Date.now().toString());
      }

      return data;
    } catch (error) {
      console.error('خطأ في تسجيل الدخول:', error);
      return { success: false, message: 'خطأ في الاتصال بالخادم' };
    }
  }

  // تسجيل الخروج
  async logout() {
    try {
      this.studentId = null;
      this.studentCode = null;
      sessionStorage.removeItem('student_id');
      sessionStorage.removeItem('student_code');
      sessionStorage.removeItem('student_login_time');
      return { success: true, message: 'تم تسجيل الخروج بنجاح' };
    } catch (error) {
      return { success: false, message: 'خطأ في تسجيل الخروج' };
    }
  }

  // الحصول على بيانات الطالب
  async getStudentData() {
    if (!this.isAuthorized()) {
      return { success: false, message: 'غير مصرح - يرجى تسجيل الدخول' };
    }

    try {
      const response = await fetch(`${this.baseURL}/${this.studentId}`, {
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.success) {
        return {
          success: true,
          data: {
            id: data.student.id,
            name: data.student.name,
            code: data.student.code,
            joinDate: data.student.created_at,
            skillsCount: data.student.skills ? data.student.skills.length : 0,
            completedSkills: data.student.skills ? data.student.skills.filter(s => s.level === 3).length : 0
          }
        };
      }

      return data;
    } catch (error) {
      console.error('خطأ في جلب بيانات الطالب:', error);
      return { success: false, message: 'خطأ في الاتصال بالخادم' };
    }
  }

  // الحصول على المهارات
  async getSkills() {
    if (!this.isAuthorized()) {
      return { success: false, message: 'غير مصرح' };
    }

    try {
      const response = await fetch(`${this.baseURL}/${this.studentId}/skills`, {
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.success) {
        const skills = data.skills.map(skill => ({
          id: skill.id,
          name: skill.name,
          level: skill.level,
          status: skill.level === 3 ? 'مكتمل' : 'قيد التطوير',
          description: skill.description,
          category: skill.category,
          addedDate: skill.created_at,
          completedDate: skill.updated_at
        }));

        const completedSkills = skills.filter(s => s.status === 'مكتمل').length;

        return {
          success: true,
          data: {
            totalSkills: skills.length,
            completedSkills: completedSkills,
            pendingSkills: skills.length - completedSkills,
            skills: skills,
            completionRate: skills.length > 0 ? ((completedSkills / skills.length) * 100).toFixed(2) : 0
          }
        };
      }

      return data;
    } catch (error) {
      console.error('خطأ في جلب المهارات:', error);
      return { success: false, message: 'خطأ في الاتصال بالخادم' };
    }
  }

  // الحصول على مهارة محددة
  async getSkillDetails(skillId) {
    if (!this.isAuthorized()) {
      return { success: false, message: 'غير مصرح' };
    }

    try {
      const response = await fetch(`${this.baseURL}/${this.studentId}/skills`, {
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.success) {
        const skill = data.skills.find(s => s.id === skillId);

        if (!skill) {
          return { success: false, message: 'المهارة غير موجودة' };
        }

        return {
          success: true,
          data: {
            id: skill.id,
            name: skill.name,
            level: skill.level,
            description: skill.description,
            category: skill.category,
            notes: skill.notes || '',
            status: skill.level === 3 ? 'مكتمل' : 'قيد التطوير',
            addedDate: skill.created_at,
            updatedDate: skill.updated_at
          }
        };
      }

      return data;
    } catch (error) {
      console.error('خطأ في جلب تفاصيل المهارة:', error);
      return { success: false, message: 'خطأ في الاتصال بالخادم' };
    }
  }

  // الحصول على الإحصائيات
  async getStatistics() {
    if (!this.isAuthorized()) {
      return { success: false, message: 'غير مصرح' };
    }

    try {
      const response = await fetch(`${this.baseURL}/${this.studentId}`, {
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.success) {
        const student = data.student;
        const skills = data.student.skills || [];
        const totalSkills = skills.length;
        const completedSkills = skills.filter(s => s.level === 3).length;
        const pendingSkills = totalSkills - completedSkills;
        const completionRate = totalSkills > 0 ? ((completedSkills / totalSkills) * 100).toFixed(2) : 0;

        const joinDate = new Date(student.created_at);
        const now = new Date();
        const daysActive = Math.floor((now - joinDate) / (1000 * 60 * 60 * 24));

        return {
          success: true,
          data: {
            studentName: student.name,
            studentCode: student.code,
            joinDate: student.created_at,
            daysActive: daysActive,
            totalSkills: totalSkills,
            completedSkills: completedSkills,
            pendingSkills: pendingSkills,
            completionRate: completionRate,
            lastUpdated: new Date().toISOString()
          }
        };
      }

      return data;
    } catch (error) {
      console.error('خطأ في حساب الإحصائيات:', error);
      return { success: false, message: 'خطأ في الاتصال بالخادم' };
    }
  }

  // الحصول على التقييمات
  async getEvaluations() {
    if (!this.isAuthorized()) {
      return { success: false, message: 'غير مصرح' };
    }

    try {
      const response = await fetch(`${this.baseURL}/${this.studentId}/evaluations`, {
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('خطأ في جلب التقييمات:', error);
      return { success: false, message: 'خطأ في الاتصال بالخادم' };
    }
  }

  // الحصول على الرسائل والتنبيهات
  async getNotifications() {
    if (!this.isAuthorized()) {
      return { success: false, message: 'غير مصرح' };
    }

    try {
      const response = await fetch(`${this.baseURL}/${this.studentId}/skills`, {
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.success) {
        const skills = data.skills;
        const pendingSkills = skills.filter(s => s.level < 3);
        const notifications = [];

        if (pendingSkills.length > 0) {
          notifications.push({
            type: 'pending_skills',
            message: `لديك ${pendingSkills.length} مهارات قيد الإنجاز`,
            count: pendingSkills.length,
            timestamp: new Date().toISOString()
          });
        }

        return {
          success: true,
          data: {
            notifications: notifications,
            unreadCount: notifications.length
          }
        };
      }

      return data;
    } catch (error) {
      console.error('خطأ في جلب التنبيهات:', error);
      return { success: false, message: 'خطأ في الاتصال بالخادم' };
    }
  }

  // التحقق من الصلاحية
  isAuthorized() {
    const studentId = sessionStorage.getItem('student_id');
    const loginTime = parseInt(sessionStorage.getItem('student_login_time') || '0');
    const now = Date.now();
    const sessionTimeout = 86400000; // 24 ساعة

    if (!studentId || (now - loginTime) > sessionTimeout) {
      return false;
    }

    return true;
  }
}

// إنشاء نسخة من API الطالب
const studentAPI = new StudentAPI();
