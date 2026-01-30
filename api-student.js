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

      // البحث عن الطالب
      const students = JSON.parse(localStorage.getItem('students_data') || '[]');
      const student = students.find(s => s.code === studentCode);

      if (!student) {
        return { success: false, message: 'رقم الطالب غير موجود' };
      }

      // حفظ بيانات الجلسة
      this.studentId = student.id;
      this.studentCode = studentCode;
      sessionStorage.setItem('student_id', student.id);
      sessionStorage.setItem('student_code', studentCode);
      sessionStorage.setItem('student_login_time', Date.now().toString());

      return {
        success: true,
        message: 'تم الدخول بنجاح',
        student: {
          id: student.id,
          name: student.name,
          code: studentCode,
          skillsCount: student.skills.length
        }
      };
    } catch (error) {
      return { success: false, message: 'خطأ في التسجيل: ' + error.message };
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
      const students = JSON.parse(localStorage.getItem('students_data') || '[]');
      const student = students.find(s => s.id === this.studentId);

      if (!student) {
        return { success: false, message: 'بيانات الطالب غير موجودة' };
      }

      return {
        success: true,
        data: {
          id: student.id,
          name: student.name,
          code: student.code,
          joinDate: student.createdAt,
          skillsCount: student.skills.length,
          completedSkills: student.skills.filter(s => s.done).length
        }
      };
    } catch (error) {
      return { success: false, message: 'خطأ في جلب البيانات' };
    }
  }

  // الحصول على المهارات المفقودة
  async getSkills() {
    if (!this.isAuthorized()) {
      return { success: false, message: 'غير مصرح' };
    }

    try {
      const students = JSON.parse(localStorage.getItem('students_data') || '[]');
      const student = students.find(s => s.id === this.studentId);

      if (!student) {
        return { success: false, message: 'لم يتم العثور على الطالب' };
      }

      const skills = student.skills.map(skill => ({
        id: skill.id,
        name: skill.missing,
        status: skill.done ? 'مكتمل' : 'قيد التطوير',
        url: skill.url,
        addedDate: skill.addedAt,
        completedDate: skill.completedAt || null
      }));

      return {
        success: true,
        data: {
          totalSkills: skills.length,
          completedSkills: skills.filter(s => s.status === 'مكتمل').length,
          pendingSkills: skills.filter(s => s.status === 'قيد التطوير').length,
          skills: skills,
          completionRate: skills.length > 0 ? 
            ((skills.filter(s => s.status === 'مكتمل').length / skills.length) * 100).toFixed(2) : 0
        }
      };
    } catch (error) {
      return { success: false, message: 'خطأ في جلب المهارات' };
    }
  }

  // الحصول على مهارة محددة
  async getSkillDetails(skillId) {
    if (!this.isAuthorized()) {
      return { success: false, message: 'غير مصرح' };
    }

    try {
      const students = JSON.parse(localStorage.getItem('students_data') || '[]');
      const student = students.find(s => s.id === this.studentId);

      if (!student) {
        return { success: false, message: 'لم يتم العثور على الطالب' };
      }

      const skill = student.skills.find(s => s.id === skillId);

      if (!skill) {
        return { success: false, message: 'المهارة غير موجودة' };
      }

      return {
        success: true,
        data: {
          id: skill.id,
          name: skill.missing,
          description: skill.missing,
          status: skill.done ? 'مكتمل' : 'قيد التطوير',
          fileURL: skill.url,
          addedDate: skill.addedAt,
          completedDate: skill.completedAt || null,
          notes: skill.notes || ''
        }
      };
    } catch (error) {
      return { success: false, message: 'خطأ في جلب تفاصيل المهارة' };
    }
  }

  // الحصول على إحصائيات الطالب
  async getStatistics() {
    if (!this.isAuthorized()) {
      return { success: false, message: 'غير مصرح' };
    }

    try {
      const students = JSON.parse(localStorage.getItem('students_data') || '[]');
      const student = students.find(s => s.id === this.studentId);

      if (!student) {
        return { success: false, message: 'لم يتم العثور على الطالب' };
      }

      const totalSkills = student.skills.length;
      const completedSkills = student.skills.filter(s => s.done).length;
      const pendingSkills = totalSkills - completedSkills;
      const completionRate = totalSkills > 0 ? (completedSkills / totalSkills * 100).toFixed(2) : 0;

      // حساب تقدم الطالب
      const joinDate = new Date(student.createdAt);
      const now = new Date();
      const daysActive = Math.floor((now - joinDate) / (1000 * 60 * 60 * 24));

      return {
        success: true,
        data: {
          studentName: student.name,
          joinDate: student.createdAt,
          daysActive: daysActive,
          totalSkills: totalSkills,
          completedSkills: completedSkills,
          pendingSkills: pendingSkills,
          completionRate: completionRate,
          lastUpdated: new Date().toISOString()
        }
      };
    } catch (error) {
      return { success: false, message: 'خطأ في حساب الإحصائيات' };
    }
  }

  // تحميل ملف/موارد
  async downloadResource(skillId) {
    if (!this.isAuthorized()) {
      return { success: false, message: 'غير مصرح' };
    }

    try {
      const students = JSON.parse(localStorage.getItem('students_data') || '[]');
      const student = students.find(s => s.id === this.studentId);

      if (!student) {
        return { success: false, message: 'لم يتم العثور على الطالب' };
      }

      const skill = student.skills.find(s => s.id === skillId);

      if (!skill) {
        return { success: false, message: 'المهارة غير موجودة' };
      }

      return {
        success: true,
        data: {
          skillName: skill.missing,
          resourceURL: skill.url,
          downloadedAt: new Date().toISOString()
        },
        message: 'تم تحضير الملف للتحميل'
      };
    } catch (error) {
      return { success: false, message: 'خطأ في تحميل الملف' };
    }
  }

  // الحصول على الرسائل والتنبيهات
  async getNotifications() {
    if (!this.isAuthorized()) {
      return { success: false, message: 'غير مصرح' };
    }

    try {
      const students = JSON.parse(localStorage.getItem('students_data') || '[]');
      const student = students.find(s => s.id === this.studentId);

      if (!student) {
        return { success: false, message: 'لم يتم العثور على الطالب' };
      }

      const notifications = [];

      // إضافة تنبيهات المهارات الجديدة
      const newSkills = student.skills.filter(s => {
        const addedDate = new Date(s.addedAt);
        const now = new Date();
        return (now - addedDate) < (24 * 60 * 60 * 1000); // آخر 24 ساعة
      });

      if (newSkills.length > 0) {
        notifications.push({
          type: 'new_skill',
          message: `تم إضافة ${newSkills.length} مهارة جديدة`,
          count: newSkills.length,
          timestamp: new Date().toISOString()
        });
      }

      // إضافة تنبيهات المهارات المتبقية
      const pendingSkills = student.skills.filter(s => !s.done);
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
    } catch (error) {
      return { success: false, message: 'خطأ في جلب التنبيهات' };
    }
  }

  // التحقق من الصلاحية
  isAuthorized() {
    const studentId = sessionStorage.getItem('student_id');
    const loginTime = parseInt(sessionStorage.getItem('student_login_time') || '0');
    const now = Date.now();
    const sessionTimeout = 3600000; // ساعة واحدة

    if (!studentId || (now - loginTime) > sessionTimeout) {
      return false;
    }

    return true;
  }
}

// إنشاء نسخة من API الطالب
const studentAPI = new StudentAPI();
