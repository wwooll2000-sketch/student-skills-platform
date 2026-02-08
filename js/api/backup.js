// Data Backup Manager
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
