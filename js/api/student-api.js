// Student API
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
                sessionStorage.setItem("student_name", result.student.name);
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
            sessionStorage.removeItem("student_name");
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
            
            // Check if student was deleted
            if (result.student_deleted) {
                return {
                    success: false,
                    student_deleted: true,
                    message: result.message || "تم حذف حسابك من قبل المعلم"
                };
            }

            if (result.success) {
                const skills = result.skills.map(skill => ({
                    id: skill.id,
                    name: skill.name,
                    level: skill.level,
                    status: skill.level === 3 ? "مكتمل" : "قيد التطوير",
                    description: skill.description,
                    category: skill.category,
                    evidence_url: skill.evidence_url,
                    evidence_count: skill.evidence_count || 0,
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

    async getSkillEvidence(skillId) {
        if (!this.isAuthorized()) {
            return { success: false, message: "غير مصرح" };
        }

        try {
            const response = await fetch(`${this.baseURL}/skills/${skillId}/evidence`, {
                headers: { "Content-Type": "application/json" }
            });

            const result = await response.json();
            return result;
        } catch (error) {
            console.error("خطأ في جلب الشواهد:", error);
            return {
                success: false,
                message: "خطأ في الاتصال بالخادم"
            };
        }
    }

    async restoreSession() {
        const studentId = sessionStorage.getItem("student_id");
        const studentCode = sessionStorage.getItem("student_code");
        const studentName = sessionStorage.getItem("student_name");
        
        if (this.isAuthorized() && studentId && studentCode && studentName) {
            this.studentId = studentId;
            this.studentCode = studentCode;
            return {
                success: true,
                student: {
                    id: studentId,
                    code: studentCode,
                    name: studentName
                }
            };
        }
        
        return { success: false };
    }

    async validateSession() {
        if (!this.isAuthorized()) {
            return { success: false, valid: false, message: "غير مصرح" };
        }

        try {
            const response = await fetch(`${this.baseURL}/validate/${this.studentId}`, {
                headers: { "Content-Type": "application/json" }
            });

            const result = await response.json();
            
            // Check if student was deleted
            if (result.student_deleted || !result.success) {
                return {
                    success: false,
                    valid: false,
                    student_deleted: true,
                    message: result.message || "تم حذف حسابك من قبل المعلم"
                };
            }

            return result;
        } catch (error) {
            console.error("خطأ في التحقق من الجلسة:", error);
            return {
                success: false,
                valid: false,
                message: "خطأ في الاتصال بالخادم"
            };
        }
    }
}

const studentAPI = new StudentAPI();
