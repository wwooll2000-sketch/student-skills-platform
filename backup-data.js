// نظام النسخ الاحتياطي والاستعادة للبيانات
// جميع النسخ الاحتياطية يتم تخزينها في قاعدة البيانات
class DataBackup {
  constructor(apiEndpoint = '/api') {
    this.apiEndpoint = apiEndpoint;
  }

  // إنشاء نسخة احتياطية من البيانات في قاعدة البيانات
  async createBackup(data) {
    try {
      const backup = {
        timestamp: new Date().toISOString(),
        data: data,
        version: '1.0'
      };
      
      const response = await fetch(`${this.apiEndpoint}/backups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('admin_token')}`
        },
        body: JSON.stringify(backup)
      });

      if (!response.ok) {
        throw new Error('فشل حفظ النسخة الاحتياطية');
      }

      return { success: true, message: 'تم حفظ النسخة الاحتياطية بنجاح' };
    } catch (error) {
      console.error('خطأ في حفظ النسخة الاحتياطية:', error);
      return { success: false, message: 'فشل حفظ النسخة الاحتياطية' };
    }
  }

  // استعادة البيانات من النسخة الاحتياطية
  async restoreBackup(backupId) {
    try {
      const response = await fetch(`${this.apiEndpoint}/backups/${backupId}/restore`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('admin_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('فشل استعادة البيانات');
      }

      const data = await response.json();
      return { success: true, data: data.backup };
    } catch (error) {
      console.error('خطأ في استعادة النسخة الاحتياطية:', error);
      return { success: false, message: 'فشل استعادة البيانات' };
    }
  }

  // الحصول على سجل النسخ الاحتياطية
  async getBackupHistory() {
    try {
      const response = await fetch(`${this.apiEndpoint}/backups`, {
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('admin_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('فشل جلب سجل النسخ');
      }

      const data = await response.json();
      return data.backups || [];
    } catch (error) {
      console.error('خطأ في جلب سجل النسخ:', error);
      return [];
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

  // حذف نسخة احتياطية
  async deleteBackup(backupId) {
    try {
      const response = await fetch(`${this.apiEndpoint}/backups/${backupId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('admin_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('فشل حذف النسخة الاحتياطية');
      }

      return { success: true, message: 'تم حذف النسخة الاحتياطية بنجاح' };
    } catch (error) {
      console.error('خطأ في حذف النسخة:', error);
      return { success: false, message: 'فشل حذف النسخة الاحتياطية' };
    }
  }
}

// إنشاء نسخة واحدة من الكائن
const dataBackup = new DataBackup();

