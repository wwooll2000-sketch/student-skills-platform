// Admin API
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

            const result = await response.json();
            return result;
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

    async updateStudent(studentId, name, code, email, studentClass) {
        if (!this.isAuthorized()) {
            return { success: false, message: "غير مصرح" };
        }

        try {
            const response = await fetch(`${this.baseURL}/students/${studentId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.authToken}`
                },
                body: JSON.stringify({ name, code, email, class: studentClass })
            });

            return await response.json();
        } catch (error) {
            console.error("خطأ في تحديث الطالب:", error);
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

    async getStudentSkills(studentId) {
        if (!this.isAuthorized()) {
            return { success: false, message: "غير مصرح" };
        }

        try {
            const response = await fetch(`/api/student/${studentId}/skills`, {
                headers: { "Content-Type": "application/json" }
            });

            const result = await response.json();

            if (result.success) {
                // Transform the data to match the expected format
                const completedSkills = result.skills.filter(s => s.level === 3 || s.level === 2).length;
                const totalSkills = result.skills.length;
                const completionRate = totalSkills > 0 ? ((completedSkills / totalSkills) * 100).toFixed(1) : 0;

                return {
                    success: true,
                    data: {
                        skills: result.skills,
                        completionRate: completionRate
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

    async getRecentActivities() {
        if (!this.isAuthorized()) {
            return { success: false, message: "غير مصرح" };
        }

        try {
            const response = await fetch(`${this.baseURL}/recent-activities`, {
                headers: { Authorization: `Bearer ${this.authToken}` }
            });

            return await response.json();
        } catch (error) {
            console.error("خطأ في جلب النشاطات:", error);
            return {
                success: false,
                message: "خطأ في الاتصال بالخادم"
            };
        }
    }

    async getStatistics() {
        if (!this.isAuthorized()) {
            return { success: false, message: "غير مصرح" };
        }

        try {
            const response = await fetch(`${this.baseURL}/statistics`, {
                headers: { Authorization: `Bearer ${this.authToken}` }
            });

            return await response.json();
        } catch (error) {
            console.error("خطأ في جلب الإحصائيات:", error);
            return {
                success: false,
                message: "خطأ في الاتصال بالخادم"
            };
        }
    }

    async getStudentsWithSkills() {
        if (!this.isAuthorized()) {
            return { success: false, message: "غير مصرح" };
        }

        try {
            const response = await fetch(`${this.baseURL}/students-with-skills`, {
                headers: { Authorization: `Bearer ${this.authToken}` }
            });

            return await response.json();
        } catch (error) {
            console.error("خطأ في جلب الطلاب والمهارات:", error);
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
            this.authToken = null;
            return false;
        }

        this.authToken = token;
        return true;
    }
}

const adminAPI = new AdminAPI();
