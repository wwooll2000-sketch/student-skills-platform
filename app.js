class SecurityManager {
    constructor() {
        this.loginAttempts = {};
        this.maxAttempts = 5;
        this.lockoutTime = 900000;
    }

    checkLoginAttempts(identifier) {
        const now = Date.now();
        
        if (!this.loginAttempts[identifier]) {
            this.loginAttempts[identifier] = [];
        }

        this.loginAttempts[identifier] = this.loginAttempts[identifier].filter(
            timestamp => now - timestamp < this.lockoutTime
        );

        if (this.loginAttempts[identifier].length >= this.maxAttempts) {
            return {
                allowed: false,
                message: "تم تجاوز عدد محاولات الدخول. يرجى المحاولة لاحقاً"
            };
        }

        return { allowed: true };
    }

    recordFailedAttempt(identifier) {
        if (!this.loginAttempts[identifier]) {
            this.loginAttempts[identifier] = [];
        }
        this.loginAttempts[identifier].push(Date.now());
    }

    resetLoginAttempts(identifier) {
        delete this.loginAttempts[identifier];
    }
}

const securityManager = new SecurityManager();

class DataBackup {
    constructor(apiEndpoint = "/api") {
        this.apiEndpoint = apiEndpoint;
    }

    async createBackup(data) {
        try {
            const backupData = {
                timestamp: new Date().toISOString(),
                data: data,
                version: "1.0"
            };

            const response = await fetch(`${this.apiEndpoint}/backups`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("admin_token")}`
                },
                body: JSON.stringify(backupData)
            });

            if (!response.ok) {
                throw new Error("فشل حفظ النسخة الاحتياطية");
            }

            return {
                success: true,
                message: "تم حفظ النسخة الاحتياطية بنجاح"
            };
        } catch (error) {
            console.error("خطأ في حفظ النسخة الاحتياطية:", error);
            return {
                success: false,
                message: "فشل حفظ النسخة الاحتياطية"
            };
        }
    }

    async restoreBackup(backupId) {
        try {
            const response = await fetch(`${this.apiEndpoint}/backups/${backupId}/restore`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("admin_token")}`
                }
            });

            if (!response.ok) {
                throw new Error("فشل استعادة البيانات");
            }

            const result = await response.json();
            return {
                success: true,
                data: result.backup
            };
        } catch (error) {
            console.error("خطأ في استعادة النسخة الاحتياطية:", error);
            return {
                success: false,
                message: "فشل استعادة البيانات"
            };
        }
    }

    exportToJSON(data, filename = "students_data.json") {
        try {
            const jsonString = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonString], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            return {
                success: true,
                message: "تم تصدير البيانات بنجاح"
            };
        } catch (error) {
            console.error("خطأ في تصدير البيانات:", error);
            return {
                success: false,
                message: "فشل تصدير البيانات"
            };
        }
    }
}

const dataBackup = new DataBackup();

class AdminAPI {
    constructor() {
        this.baseURL = "/api/admin";
        this.authToken = null;
        this.sessionTimeout = 86400000;
    }

    async login(password) {
        try {
            const response = await fetch(`${this.baseURL}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password })
            });

            const result = await response.json();

            if (result.success) {
                this.authToken = result.token;
                localStorage.setItem("admin_token", result.token);
                localStorage.setItem("admin_login_time", Date.now().toString());
            }

            return result;
        } catch (error) {
            console.error("خطأ في تسجيل الدخول:", error);
            return {
                success: false,
                message: "خطأ في الاتصال بالخادم: " + error.message
            };
        }
    }

    async logout() {
        try {
            this.authToken = null;
            localStorage.removeItem("admin_token");
            localStorage.removeItem("admin_login_time");
            return {
                success: true,
                message: "تم تسجيل الخروج بنجاح"
            };
        } catch (error) {
            return {
                success: false,
                message: "خطأ في تسجيل الخروج"
            };
        }
    }

    async addStudent(name, code, email, studentClass) {
        if (!this.isAuthorized()) {
            return {
                success: false,
                message: "غير مصرح - يرجى تسجيل الدخول"
            };
        }

        try {
            const response = await fetch(`${this.baseURL}/students`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.authToken}`
                },
                body: JSON.stringify({ name, code, email, class: studentClass })
            });

            return await response.json();
        } catch (error) {
            console.error("خطأ في إضافة الطالب:", error);
            return {
                success: false,
                message: "خطأ في الاتصال بالخادم"
            };
        }
    }

    async deleteStudent(studentId) {
        if (!this.isAuthorized()) {
            return { success: false, message: "غير مصرح" };
        }

        try {
            const response = await fetch(`${this.baseURL}/students/${studentId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${this.authToken}` }
            });

            return await response.json();
        } catch (error) {
            console.error("خطأ في حذف الطالب:", error);
            return {
                success: false,
                message: "خطأ في الاتصال بالخادم"
            };
        }
    }

    async addSkill(studentId, name, level, description, category, notes) {
        if (!this.isAuthorized()) {
            return { success: false, message: "غير مصرح" };
        }

        try {
            const response = await fetch(`${this.baseURL}/students/${studentId}/skills`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.authToken}`
                },
                body: JSON.stringify({ name, level, description, category, notes })
            });

            return await response.json();
        } catch (error) {
            console.error("خطأ في إضافة المهارة:", error);
            return {
                success: false,
                message: "خطأ في الاتصال بالخادم"
            };
        }
    }

    async updateSkill(skillId, name, level, description, category, notes) {
        if (!this.isAuthorized()) {
            return { success: false, message: "غير مصرح" };
        }

        try {
            const response = await fetch(`${this.baseURL}/skills/${skillId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.authToken}`
                },
                body: JSON.stringify({ name, level, description, category, notes })
            });

            return await response.json();
        } catch (error) {
            console.error("خطأ في تحديث المهارة:", error);
            return {
                success: false,
                message: "خطأ في الاتصال بالخادم"
            };
        }
    }

    async deleteSkill(skillId) {
        if (!this.isAuthorized()) {
            return { success: false, message: "غير مصرح" };
        }

        try {
            const response = await fetch(`${this.baseURL}/skills/${skillId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${this.authToken}` }
            });

            return await response.json();
        } catch (error) {
            console.error("خطأ في حذف المهارة:", error);
            return {
                success: false,
                message: "خطأ في الاتصال بالخادم"
            };
        }
    }

    async getAllStudents() {
        if (!this.isAuthorized()) {
            return { success: false, message: "غير مصرح" };
        }

        try {
            const response = await fetch(`${this.baseURL}/students`, {
                headers: { Authorization: `Bearer ${this.authToken}` }
            });

            return await response.json();
        } catch (error) {
            console.error("خطأ في جلب الطلاب:", error);
            return {
                success: false,
                message: "خطأ في الاتصال بالخادم"
            };
        }
    }

    isAuthorized() {
        const token = localStorage.getItem("admin_token");
        const loginTime = parseInt(localStorage.getItem("admin_login_time") || "0");
        const now = Date.now();

        if (!token || now - loginTime > this.sessionTimeout) {
            return false;
        }

        this.authToken = token;
        return true;
    }
}

class StudentAPI {
    constructor() {
        this.baseURL = "/api/student";
        this.studentId = null;
        this.studentCode = null;
    }

    async login(studentCode) {
        try {
            if (!studentCode || studentCode.length < 4) {
                return {
                    success: false,
                    message: "رقم الطالب غير صحيح"
                };
            }

            const response = await fetch(`${this.baseURL}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ studentCode })
            });

            const result = await response.json();

            if (result.success) {
                this.studentId = result.student.id;
                this.studentCode = studentCode;
                sessionStorage.setItem("student_id", result.student.id);
                sessionStorage.setItem("student_code", studentCode);
                sessionStorage.setItem("student_login_time", Date.now().toString());
            }

            return result;
        } catch (error) {
            console.error("خطأ في تسجيل الدخول:", error);
            return {
                success: false,
                message: "خطأ في الاتصال بالخادم"
            };
        }
    }

    async logout() {
        try {
            this.studentId = null;
            this.studentCode = null;
            sessionStorage.removeItem("student_id");
            sessionStorage.removeItem("student_code");
            sessionStorage.removeItem("student_login_time");
            return {
                success: true,
                message: "تم تسجيل الخروج بنجاح"
            };
        } catch (error) {
            return {
                success: false,
                message: "خطأ في تسجيل الخروج"
            };
        }
    }

    async getSkills() {
        if (!this.isAuthorized()) {
            return { success: false, message: "غير مصرح" };
        }

        try {
            const response = await fetch(`${this.baseURL}/${this.studentId}/skills`, {
                headers: { "Content-Type": "application/json" }
            });

            const result = await response.json();

            if (result.success) {
                const skills = result.skills.map(skill => ({
                    id: skill.id,
                    name: skill.name,
                    level: skill.level,
                    status: skill.level === 3 ? "مكتمل" : "قيد التطوير",
                    description: skill.description,
                    category: skill.category,
                    addedDate: skill.created_at,
                    completedDate: skill.updated_at
                }));

                const completedSkills = skills.filter(skill => skill.status === "مكتمل").length;

                return {
                    success: true,
                    data: {
                        totalSkills: skills.length,
                        completedSkills,
                        pendingSkills: skills.length - completedSkills,
                        skills,
                        completionRate: skills.length > 0 
                            ? ((completedSkills / skills.length) * 100).toFixed(2) 
                            : 0
                    }
                };
            }

            return result;
        } catch (error) {
            console.error("خطأ في جلب المهارات:", error);
            return {
                success: false,
                message: "خطأ في الاتصال بالخادم"
            };
        }
    }

    isAuthorized() {
        const studentId = sessionStorage.getItem("student_id");
        const loginTime = parseInt(sessionStorage.getItem("student_login_time") || "0");
        const now = Date.now();

        return !(!studentId || now - loginTime > 86400000);
    }
}
