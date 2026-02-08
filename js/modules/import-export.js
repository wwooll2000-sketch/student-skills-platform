// Import and Export Functions

async function exportStudentsData() {
    const result = await adminAPI.getStudentsWithSkills();
    if (!result.success) {
        customAlert("خطأ في تصدير البيانات", { icon: '❌', title: 'خطأ' });
        return;
    }

    const students = result.students;
    const exportData = {
        exportDate: new Date().toISOString(),
        totalStudents: students.length,
        students: students.map(student => ({
            id: student.id,
            name: student.name,
            code: student.code,
            skills: student.skills || []
        }))
    };

    // Create download
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `students_data_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);

    customAlert("تم تصدير البيانات بنجاح", { icon: '✅', title: 'نجحت العملية' });
}

async function importStudentsData() {
    if (!isAdmin) return;

    const fileInput = document.getElementById('importFileInput');
    if (!fileInput) return;

    // Trigger file selection
    fileInput.click();

    // Handle file selection
    fileInput.onchange = async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.name.endsWith('.json')) {
            customAlert("يرجى اختيار ملف JSON صالح", { icon: '⚠️', title: 'تنبيه' });
            return;
        }

        try {
            const fileContent = await file.text();
            const importData = JSON.parse(fileContent);

            // Validate data structure
            if (!importData.students || !Array.isArray(importData.students)) {
                customAlert("صيغة الملف غير صحيحة", { icon: '❌', title: 'خطأ' });
                return;
            }

            // Confirm import
            customConfirm(
                `هل تريد استيراد ${importData.students.length} طالب؟\n\nملاحظة: سيتم إضافة الطلاب الجدد فقط، ولن يتم تعديل البيانات الموجودة.`,
                async () => {
                    await processImport(importData.students);
                },
                {
                    icon: '📤',
                    title: 'تأكيد الاستيراد',
                    confirmText: 'استيراد',
                    cancelText: 'إلغاء'
                }
            );
        } catch (error) {
            console.error('خطأ في قراءة الملف:', error);
            customAlert("خطأ في قراءة الملف. تأكد من أن الملف بصيغة JSON صحيحة", { icon: '❌', title: 'خطأ' });
        }

        // Reset file input
        fileInput.value = '';
    };
}

async function processImport(studentsData) {
    showLoading('adminStudentsList', `جاري استيراد ${studentsData.length} طالب...`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    // Get existing students to check for duplicates
    const existingResult = await adminAPI.getAllStudents();
    const existingCodes = existingResult.success 
        ? existingResult.students.map(s => s.code) 
        : [];

    for (const studentData of studentsData) {
        try {
            // Skip if student code already exists
            if (existingCodes.includes(studentData.code)) {
                skipCount++;
                continue;
            }

            // Add student
            const result = await adminAPI.addStudent(
                studentData.name,
                studentData.code,
                null,
                null
            );

            if (result.success) {
                successCount++;

                // Add skills if available
                if (studentData.skills && studentData.skills.length > 0) {
                    const newStudentId = result.student.id;
                    
                    for (const skill of studentData.skills) {
                        await adminAPI.addSkill(
                            newStudentId,
                            skill.name,
                            skill.level || 1,
                            skill.description || '',
                            skill.category || '',
                            skill.notes || ''
                        );
                    }
                }
            } else {
                errorCount++;
            }
        } catch (error) {
            console.error('خطأ في استيراد طالب:', error);
            errorCount++;
        }
    }

    const message = `تم الاستيراد بنجاح:\n` +
                    `✅ تمت الإضافة: ${successCount} طالب\n` +
                    (skipCount > 0 ? `⏭️ تم تخطي: ${skipCount} طالب (موجود مسبقاً)\n` : '') +
                    (errorCount > 0 ? `❌ فشل: ${errorCount} طالب` : '');

    customAlert(message, {
        icon: errorCount > 0 ? '⚠️' : '✅',
        title: 'نتيجة الاستيراد',
        onClose: () => renderAdminStudents()
    });
}


