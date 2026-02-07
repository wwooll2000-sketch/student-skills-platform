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

  // تسجيل الأنشطة المهمة في قاعدة البيانات
  async logActivity(action, details) {
    const log = {
      timestamp: new Date().toISOString(),
      action: action,
      details: details
    };

    try {
      // محاولة إرسال السجل إلى قاعدة البيانات
      if (window.navigator.onLine) {
        const response = await fetch('/api/logs/activity', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionStorage.getItem('admin_token') || sessionStorage.getItem('student_id')}`
          },
          body: JSON.stringify(log)
        });

        if (!response.ok) {
          console.warn('تحذير: فشل إرسال السجل إلى قاعدة البيانات');
        }
      } else {
        console.warn('تحذير: الاتصال بالإنترنت مقطوع');
      }
    } catch (error) {
      console.error('خطأ في تسجيل النشاط:', error);
    }
  }

  // الحصول على السجلات من قاعدة البيانات
  async getActivityLogs() {
    try {
      const response = await fetch('/api/logs/activity', {
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('admin_token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.logs || [];
      }
    } catch (error) {
      console.error('خطأ في جلب السجلات:', error);
    }
    return [];
  }
}

// إنشاء نسخة واحدة من مدير الأمان
const securityManager = new SecurityManager();
