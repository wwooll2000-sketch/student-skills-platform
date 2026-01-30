// نظام النسخ الاحتياطي والاستعادة للبيانات
class DataBackup {
  constructor() {
    this.backupKey = 'students_backup';
    this.backupHistoryKey = 'backup_history';
  }

  // إنشاء نسخة احتياطية من البيانات
  createBackup(data) {
    try {
      const backup = {
        timestamp: new Date().toISOString(),
        data: data,
        version: '1.0'
      };
      
      const backupStr = JSON.stringify(backup);
      localStorage.setItem(this.backupKey, backupStr);
      
      this.addToHistory(backup);
      return { success: true, message: 'تم حفظ النسخة الاحتياطية بنجاح' };
    } catch (error) {
      console.error('خطأ في حفظ النسخة الاحتياطية:', error);
      return { success: false, message: 'فشل حفظ النسخة الاحتياطية' };
    }
  }

  // استعادة البيانات من النسخة الاحتياطية
  restoreBackup() {
    try {
      const backupStr = localStorage.getItem(this.backupKey);
      if (!backupStr) {
        return { success: false, message: 'لا توجد نسخة احتياطية' };
      }
      
      const backup = JSON.parse(backupStr);
      return { success: true, data: backup.data };
    } catch (error) {
      console.error('خطأ في استعادة النسخة الاحتياطية:', error);
      return { success: false, message: 'فشل استعادة البيانات' };
    }
  }

  // إضافة النسخة للسجل
  addToHistory(backup) {
    try {
      let history = JSON.parse(localStorage.getItem(this.backupHistoryKey) || '[]');
      
      const historyEntry = {
        timestamp: backup.timestamp,
        recordCount: backup.data.length || 0
      };
      
      history.push(historyEntry);
      
      // الاحتفاظ بآخر 10 نسخ فقط
      if (history.length > 10) {
        history = history.slice(-10);
      }
      
      localStorage.setItem(this.backupHistoryKey, JSON.stringify(history));
    } catch (error) {
      console.error('خطأ في تحديث سجل النسخ:', error);
    }
  }

  // تصدير البيانات كملف JSON
  exportToJSON(data, filename = 'students_data.json') {
    try {
      const dataStr = JSON.stringify(data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      return { success: true, message: 'تم تصدير البيانات بنجاح' };
    } catch (error) {
      console.error('خطأ في تصدير البيانات:', error);
      return { success: false, message: 'فشل تصدير البيانات' };
    }
  }

  // استيراد البيانات من ملف
  importFromJSON(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          resolve({ success: true, data: data });
        } catch (error) {
          console.error('خطأ في استيراد البيانات:', error);
          resolve({ success: false, message: 'صيغة الملف غير صحيحة' });
        }
      };
      
      reader.onerror = () => {
        resolve({ success: false, message: 'خطأ في قراءة الملف' });
      };
      
      reader.readAsText(file);
    });
  }

  // الحصول على سجل النسخ الاحتياطية
  getBackupHistory() {
    try {
      return JSON.parse(localStorage.getItem(this.backupHistoryKey) || '[]');
    } catch (error) {
      return [];
    }
  }
}

// إنشاء نسخة واحدة من الكائن
const dataBackup = new DataBackup();
