/**
 * تكامل شامل - مثال عملي كامل
 * Complete Integration Example
 * 
 * انسخ هذا الملف في مشروعك واستخدمه مباشرة
 */

// ===================== التهيئة الأساسية =====================
class StudentSkillsApp {
    constructor() {
        this.currentStudentId = null;
        this.syncManager = window.syncManager || new DatabaseSyncManager('/api');
        this.init();
    }

    init() {
        console.log('🚀 جاري تهيئة تطبيق إدارة مهارات الطلاب...');
        
        // إضافة المستمعين للأحداث
        this.setupEventListeners();
        
        console.log('✅ تم تهيئة التطبيق بنجاح');
    }

    setupEventListeners() {
        // الاستماع لتغييرات الاتصال
        window.addEventListener('online', () => {
            console.log('🟢 تم الاتصال بالإنترنت');
            this.showNotification('تم الاتصال بالإنترنت', 'success');
        });

        window.addEventListener('offline', () => {
            console.log('🔴 تم قطع الاتصال بالإنترنت');
            this.showNotification('تم قطع الاتصال بالإنترنت', 'warning');
        });
    }

    loadSavedData() {
        // لا يتم استعادة البيانات محليًا - يتم جلبها من قاعدة البيانات عند الحاجة
        console.log('جميع البيانات تُحفظ في قاعدة البيانات');
    }

    // ===================== إدارة الطلاب =====================

    /**
     * إضافة طالب جديد
     */
    async addNewStudent(name, email = null, className = null) {
        if (!name || name.trim() === '') {
            this.showNotification('يرجى إدخال اسم الطالب', 'error');
            return false;
        }

        const studentCode = this.generateStudentCode();
        const studentData = {
            code: studentCode,
            name: name.trim(),
            email: email,
            class: className,
            createdAt: new Date().toISOString()
        };

        try {
            // حفظ مباشرة في قاعدة البيانات
            const result = await this.saveStudentToDatabase(studentData);
            if (result) {
                this.showNotification(`✅ تم إضافة الطالب: ${name}`, 'success');
                return studentCode;
            } else {
                throw new Error('فشل الحفظ');
            }
        } catch (error) {
            console.error('❌ خطأ في إضافة الطالب:', error);
            this.showNotification('خطأ في إضافة الطالب', 'error');
            return false;
        }
    }

    /**
     * الحصول على بيانات الطالب من قاعدة البيانات
     */
    async getStudentData(studentId) {
        try {
            const response = await fetch(`/api/students/${studentId}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`
                }
            });

            if (!response.ok) {
                throw new Error('فشل جلب بيانات الطالب');
            }

            const data = await response.json();
            return data.success ? data.student : null;
        } catch (error) {
            console.error('❌ خطأ في جلب بيانات الطالب:', error);
            return null;
        }
    }

    /**
     * عرض لوحة التحكم الخاصة بالطالب
     */
    async displayStudentDashboard(studentId) {
        this.currentStudentId = studentId;
        
        const studentData = await this.getStudentData(studentId);
        if (!studentData) {
            console.warn('لم يتم العثور على بيانات الطالب');
            this.showNotification('لم يتم العثور على بيانات الطالب', 'error');
            return;
        }

        console.log('📊 عرض لوحة تحكم الطالب:', studentData.name);
        
        // تحديث الواجهة
        this.updateUI(studentData, studentId);
    }

    /**
     * حفظ الطالب في قاعدة البيانات
     */
    async saveStudentToDatabase(studentData) {
        try {
            const response = await fetch('/api/sync/student', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(studentData)
            });
            
            if (!response.ok) throw new Error('فشل الحفظ في قاعدة البيانات');
            
            console.log('✅ تم حفظ الطالب في قاعدة البيانات');
            return true;
        } catch (error) {
            console.warn('⚠️ لم يتمكن من حفظ في قاعدة البيانات (الاتصال مقطوع):', error);
            return false;
        }
    }

    // ===================== إدارة المهارات =====================

    /**
     * إضافة أو تحديث مهارة
     */
    async addOrUpdateSkill(skillName, skillLevel, category = 'عام', notes = '') {
        if (!this.currentStudentId) {
            this.showNotification('يرجى اختيار طالب أولاً', 'error');
            return false;
        }

        if (!skillName || skillLevel < 1 || skillLevel > 5) {
            this.showNotification('بيانات المهارة غير صحيحة', 'error');
            return false;
        }

        const skillData = {
            name: skillName,
            level: skillLevel,
            category: category,
            notes: notes,
            updatedAt: new Date().toISOString()
        };

        try {
            const response = await fetch(`/api/students/${this.currentStudentId}/skills`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`
                },
                body: JSON.stringify(skillData)
            });

            if (!response.ok) {
                throw new Error('فشل حفظ المهارة');
            }

            this.showNotification(`✅ تم تحديث المهارة: ${skillName}`, 'success');
            
            // تحديث الواجهة
            this.displaySkills(this.currentStudentId);
            
            return true;
        } catch (error) {
            console.error('❌ خطأ في تحديث المهارة:', error);
            this.showNotification('خطأ في تحديث المهارة', 'error');
            return false;
        }
    }

    /**
     * الحصول على مهارات الطالب من قاعدة البيانات
     */
    async getStudentSkills(studentId) {
        try {
            const response = await fetch(`/api/students/${studentId}/skills`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`
                }
            });

            if (!response.ok) {
                throw new Error('فشل جلب المهارات');
            }

            const data = await response.json();
            return data.success ? (data.skills || []) : [];
        } catch (error) {
            console.error('❌ خطأ في جلب المهارات:', error);
            return [];
        }
    }

    /**
     * حذف مهارة
     */
    async deleteSkill(studentId, skillName) {
        try {
            const response = await fetch(`/api/students/${studentId}/skills/${encodeURIComponent(skillName)}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`
                }
            });

            if (!response.ok) {
                throw new Error('فشل حذف المهارة');
            }

            this.showNotification(`✅ تم حذف المهارة: ${skillName}`, 'success');
            this.displaySkills(studentId);
            return true;
        } catch (error) {
            console.error('❌ خطأ في حذف المهارة:', error);
            this.showNotification('خطأ في حذف المهارة', 'error');
            return false;
        }
    }

    /**
     * تحديث درجة المهارة
     */
    async updateSkillLevel(skillName, newLevel) {
        if (!this.currentStudentId) return false;

        if (newLevel < 1 || newLevel > 5) {
            this.showNotification('الدرجة يجب أن تكون بين 1 و 5', 'error');
            return false;
        }

        try {
            const response = await fetch(`/api/students/${this.currentStudentId}/skills/${encodeURIComponent(skillName)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`
                },
                body: JSON.stringify({
                    level: newLevel,
                    updatedAt: new Date().toISOString()
                })
            });

            if (!response.ok) {
                throw new Error('فشل تحديث المهارة');
            }

            this.displaySkills(this.currentStudentId);
            return true;
        } catch (error) {
            console.error('❌ خطأ في تحديث المهارة:', error);
            this.showNotification('خطأ في تحديث المهارة', 'error');
            return false;
        }
    }

    /**
     * عرض المهارات في الواجهة
     */
    async displaySkills(studentId) {
        const skills = await this.getStudentSkills(studentId);
        const container = document.getElementById('skillsList');

        if (!container) return;

        container.innerHTML = '';

        if (skills.length === 0) {
            container.innerHTML = '<div class="empty-state">لا توجد مهارات مضافة بعد</div>';
            return;
        }

        skills.forEach(skill => {
            const skillCard = this.createSkillCard(studentId, skill);
            container.appendChild(skillCard);
        });
    }

    /**
     * إنشاء بطاقة مهارة
     */
    createSkillCard(studentId, skill) {
        const card = document.createElement('div');
        card.className = 'skill-card';
        card.innerHTML = `
            <div class="skill-header">
                <h4>${skill.name}</h4>
                <span class="skill-category">${skill.category}</span>
            </div>
            <div class="skill-level-display">
                <div class="level-bar">
                    <div class="level-fill" style="width: ${skill.level * 20}%"></div>
                </div>
                <span class="level-text">${skill.level}/5</span>
            </div>
            ${skill.notes ? `<p class="skill-notes">${skill.notes}</p>` : ''}
            <div class="skill-meta">
                <small>آخر تحديث: ${new Date(skill.updatedAt || skill.createdAt).toLocaleDateString('ar-SA')}</small>
            </div>
            <div class="skill-actions">
                <button onclick="app.updateSkillLevel('${skill.name}', ${Math.min(skill.level + 1, 5)})">
                    ⬆️ زيادة
                </button>
                <button onclick="app.updateSkillLevel('${skill.name}', ${Math.max(skill.level - 1, 1)})">
                    ⬇️ تقليل
                </button>
                <button onclick="app.deleteSkill('${studentId}', '${skill.name}')">
                    🗑️ حذف
                </button>
            </div>
        `;
        return card;
    }

    // ===================== الملاحظات =====================

    /**
     * حفظ ملاحظات الطالب
     */
    async saveStudentNotes(notes) {
        if (!this.currentStudentId) return false;

        const notesData = {
            content: notes,
            lastModified: new Date().toISOString()
        };

        try {
            const response = await fetch(`/api/students/${this.currentStudentId}/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`
                },
                body: JSON.stringify(notesData)
            });

            if (!response.ok) {
                throw new Error('فشل حفظ الملاحظات');
            }

            this.showNotification('✅ تم حفظ الملاحظات', 'success');
            return true;
        } catch (error) {
            console.error('❌ خطأ في حفظ الملاحظات:', error);
            this.showNotification('خطأ في حفظ الملاحظات', 'error');
            return false;
        }
    }

    /**
     * الحصول على ملاحظات الطالب
     */
    async getStudentNotes(studentId) {
        try {
            const response = await fetch(`/api/students/${studentId}/notes`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`
                }
            });

            if (!response.ok) {
                throw new Error('فشل جلب الملاحظات');
            }

            const data = await response.json();
            return data.success ? (data.notes?.content || '') : '';
        } catch (error) {
            console.error('❌ خطأ في جلب الملاحظات:', error);
            return '';
        }
    }

    // ===================== الإحصائيات =====================

    /**
     * الحصول على إحصائيات الطالب
     */
    getStatistics(studentId) {
        const skills = this.getStudentSkills(studentId);

        if (skills.length === 0) {
            return {
                totalSkills: 0,
                averageLevel: 0,
                skillsByCategory: {},
                skillsByLevel: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
            };
        }

        const skillsByCategory = {};
        const skillsByLevel = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        let totalLevel = 0;

        skills.forEach(skill => {
            // حسب الفئة
            if (!skillsByCategory[skill.category]) {
                skillsByCategory[skill.category] = [];
            }
            skillsByCategory[skill.category].push(skill);

            // حسب المستوى
            skillsByLevel[skill.level]++;
            totalLevel += skill.level;
        });

        return {
            totalSkills: skills.length,
            averageLevel: (totalLevel / skills.length).toFixed(2),
            skillsByCategory,
            skillsByLevel
        };
    }

    /**
     * عرض الإحصائيات
     */
    displayStatistics(studentId) {
        const stats = this.getStatistics(studentId);
        const container = document.getElementById('statisticsContainer');

        if (!container) return;

        const html = `
            <div class="statistics">
                <div class="stat-item">
                    <h5>عدد المهارات</h5>
                    <p class="stat-value">${stats.totalSkills}</p>
                </div>
                <div class="stat-item">
                    <h5>متوسط الدرجات</h5>
                    <p class="stat-value">${stats.averageLevel}/5</p>
                </div>
                <div class="stat-item">
                    <h5>توزيع المهارات</h5>
                    <div class="level-distribution">
                        ${[1, 2, 3, 4, 5].map(level => `
                            <div class="level-bar">
                                <span>${level}</span>
                                <div class="count">${stats.skillsByLevel[level]}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    // ===================== النسخ الاحتياطية =====================

    /**
     * تصدير جميع البيانات من قاعدة البيانات
     */
    async exportAllData() {
        try {
            const response = await fetch('/api/students', {
                headers: {
                    'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`
                }
            });

            if (!response.ok) {
                throw new Error('فشل جلب البيانات');
            }

            const data = await response.json();
            const dataString = JSON.stringify(data.students || [], null, 2);
            
            const blob = new Blob([dataString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `skills-backup-${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            
            this.showNotification('✅ تم تحميل النسخة الاحتياطية', 'success');
        } catch (error) {
            console.error('❌ خطأ في التصدير:', error);
            this.showNotification('خطأ في التصدير', 'error');
        }
    }

    /**
     * استيراد البيانات من ملف
     */
    async importData(file) {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                
                // إرسال البيانات إلى قاعدة البيانات
                for (const student of importedData) {
                    await this.saveStudentToDatabase(student);
                }
                
                this.showNotification('✅ تم استيراد البيانات بنجاح', 'success');
            } catch (error) {
                console.error('❌ خطأ في استيراد البيانات:', error);
                this.showNotification('خطأ في استيراد البيانات', 'error');
            }
        };
        
        reader.readAsText(file);
    }

    /**
     * حذف جميع البيانات
     */
    async clearAllData() {
        if (confirm('هل أنت متأكد من حذف جميع البيانات؟ هذا الإجراء لا يمكن التراجع عنه.')) {
            try {
                const response = await fetch('/api/students/clear-all', {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`
                    }
                });

                if (!response.ok) {
                    throw new Error('فشل حذف البيانات');
                }

                this.showNotification('✅ تم حذف جميع البيانات', 'success');
                this.currentStudentId = null;
            } catch (error) {
                console.error('❌ خطأ في حذف البيانات:', error);
                this.showNotification('خطأ في حذف البيانات', 'error');
            }
        }
    }

    // ===================== دوال مساعدة الواجهة =====================

    /**
     * تحديث الواجهة
     */
    async updateUI(studentData, studentId) {
        // تحديث عنوان الطالب
        const titleElement = document.getElementById('studentName');
        if (titleElement) {
            titleElement.textContent = studentData.name;
        }

        // عرض المهارات
        await this.displaySkills(studentId);

        // عرض الإحصائيات
        this.displayStatistics(studentId);

        // تحميل الملاحظات
        const notesElement = document.getElementById('studentNotes');
        if (notesElement) {
            notesElement.value = await this.getStudentNotes(studentId);
        }
    }

    /**
     * عرض إشعار
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 5px;
            background: ${this.getNotificationColor(type)};
            color: white;
            z-index: 9999;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    /**
     * الحصول على لون الإشعار
     */
    getNotificationColor(type) {
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };
        return colors[type] || colors.info;
    }

    // ===================== دوال إنشاء الرموز =====================

    /**
     * توليد رقم الطالب
     */
    generateStudentCode() {
        return 'STU' + Date.now() + Math.random().toString(36).substr(2, 5);
    }

    /**
     * توليد معرف فريد
     */
    generateId() {
        return 'ID' + Date.now() + Math.random().toString(36).substr(2, 9);
    }
}

// ===================== التهيئة العامة =====================

// إنشاء النسخة الرئيسية من التطبيق
let app;

document.addEventListener('DOMContentLoaded', function() {
    console.log('📱 جاري تهيئة تطبيق الويب...');
    app = new StudentSkillsApp();
});

// تصدير للاستخدام الخارجي
window.StudentSkillsApp = StudentSkillsApp;
window.app = app || new StudentSkillsApp();
