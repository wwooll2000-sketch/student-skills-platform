// نظام الأمان والتشفير الأساسي
class SecurityManager {
  constructor() {
    this.loginAttempts = {};
    this.maxAttempts = 5;
    this.lockoutTime = 15 * 60 * 1000; // 15 دقيقة
  }

  // التحقق من محاولات الدخول الفاشلة
  checkLoginAttempts(identifier) {
    const now = Date.now();
    
    if (!this.loginAttempts[identifier]) {
      this.loginAttempts[identifier] = [];
    }

    // إزالة محاولات قديمة
    this.loginAttempts[identifier] = this.loginAttempts[identifier]
      .filter(time => now - time < this.lockoutTime);

    if (this.loginAttempts[identifier].length >= this.maxAttempts) {
      return {
        allowed: false,
        message: 'تم تجاوز عدد محاولات الدخول. يرجى المحاولة لاحقاً'
      };
    }

    return { allowed: true };
  }

  // تسجيل محاولة دخول فاشلة
  recordFailedAttempt(identifier) {
    if (!this.loginAttempts[identifier]) {
      this.loginAttempts[identifier] = [];
    }
    this.loginAttempts[identifier].push(Date.now());
  }

  // إعادة تعيين محاولات الدخول بعد نجاح
  resetLoginAttempts(identifier) {
    delete this.loginAttempts[identifier];
  }

  // تشفير بسيط (Base64) للبيانات الحساسة
  encryptData(data) {
    try {
      return btoa(JSON.stringify(data));
    } catch (error) {
      console.error('خطأ في تشفير البيانات:', error);
      return null;
    }
  }

  // فك تشفير البيانات
  decryptData(encryptedData) {
    try {
      return JSON.parse(atob(encryptedData));
    } catch (error) {
      console.error('خطأ في فك تشفير البيانات:', error);
      return null;
    }
  }

  // التحقق من صحة البيانات
  validateInput(input, type = 'text') {
    const trimmed = input.trim();

    switch (type) {
      case 'text':
        return trimmed.length > 0 && trimmed.length <= 500;
      
      case 'number':
        return /^\d+$/.test(trimmed);
      
      case 'url':
        try {
          new URL(trimmed);
          return true;
        } catch {
          return false;
        }
      
      case 'password':
        // كلمة المرور يجب أن تكون 4 أحرف على الأقل
        return trimmed.length >= 4;
      
      default:
        return trimmed.length > 0;
    }
  }

  // تنظيف HTML لمنع XSS
  sanitizeHTML(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }

  // تسجيل الأنشطة المهمة
  logActivity(action, details) {
    const log = {
      timestamp: new Date().toISOString(),
      action: action,
      details: details
    };

    try {
      let logs = JSON.parse(localStorage.getItem('activity_logs') || '[]');
      logs.push(log);
      
      // الاحتفاظ بآخر 1000 سجل فقط
      if (logs.length > 1000) {
        logs = logs.slice(-1000);
      }
      
      localStorage.setItem('activity_logs', JSON.stringify(logs));
    } catch (error) {
      console.error('خطأ في تسجيل النشاط:', error);
    }
  }

  // الحصول على السجلات
  getActivityLogs() {
    try {
      return JSON.parse(localStorage.getItem('activity_logs') || '[]');
    } catch (error) {
      return [];
    }
  }
}

// إنشاء نسخة واحدة من مدير الأمان
const securityManager = new SecurityManager();
