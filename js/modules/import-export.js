// Import and Export Functions

async function exportStudentsData() {
    const result = await adminAPI.getStudentsWithSkills();
    if (!result.success) {
        customAlert("خطأ في تصدير البيانات", { icon: '❌', title: 'خطأ' });
        return;
    }

    const students = result.students;

    // Check if there are any students to export
    if (!students || students.length === 0) {
        customAlert("لا يوجد طلاب لتصديرهم", { icon: '⚠️', title: 'لا توجد بيانات' });
        return;
    }

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
    // Use local date instead of UTC
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    link.download = `students_data_${localDate}.json`;
    link.click();
    URL.revokeObjectURL(url);

    showToast("تم تصدير البيانات بنجاح", { title: 'نجحت العملية', type: 'success' });
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

    // Prepare students and skills for batch insert
    const studentsToAdd = [];
    const studentIdMap = new Map(); // Map import data to new student IDs

    // Filter out duplicate students
    for (const studentData of studentsData) {
        if (existingCodes.includes(studentData.code)) {
            skipCount++;
            continue;
        }
        studentsToAdd.push({
            name: studentData.name,
            code: studentData.code,
            email: null,
            class: null,
            _skills: studentData.skills // Store skills temporarily
        });
    }

    // Batch add all students
    if (studentsToAdd.length > 0) {
        try {
            const result = await adminAPI.batchAddStudents(studentsToAdd);
            
            if (result.success && result.students) {
                successCount = result.students.length;
                
                // Map old codes to new IDs for skill insertion
                result.students.forEach((student, index) => {
                    studentIdMap.set(studentsToAdd[index].code, student.id);
                });
                
                // Prepare all skills for batch insert
                const allSkills = [];
                
                studentsToAdd.forEach(studentData => {
                    const newStudentId = studentIdMap.get(studentData.code);
                    if (newStudentId && studentData._skills && studentData._skills.length > 0) {
                        studentData._skills.forEach(skill => {
                            allSkills.push({
                                student_id: newStudentId,
                                name: skill.name,
                                level: skill.level || 1,
                                description: skill.description || null,
                                category: skill.category || null,
                                notes: skill.notes || null,
                                evidence_url: skill.evidence_url || null
                            });
                        });
                    }
                });
                
                // Batch add all skills at once
                if (allSkills.length > 0) {
                    await adminAPI.batchAddSkills(allSkills);
                }
            } else {
                errorCount = studentsToAdd.length;
            }
        } catch (error) {
            console.error('خطأ في الاستيراد الجماعي:', error);
            errorCount = studentsToAdd.length;
        }
    }

    // Reload skill templates to update usage counts after import
    if (typeof loadSkillTemplates === 'function') {
        try {
            await loadSkillTemplates();
        } catch (e) {
            console.error('Error refreshing skill templates:', e);
        }
    }
    
    // Invalidate all caches
    invalidateAllCaches();
    
    // Update statistics - WAIT for completion
    if (typeof updateStatisticsOptimized === 'function') {
        await updateStatisticsOptimized();
    }

    const message = `تم الاستيراد بنجاح:\n` +
                    `✅ تمت الإضافة: ${successCount} طالب\n` +
                    (skipCount > 0 ? `⏭️ تم تخطي: ${skipCount} طالب (موجود مسبقاً)\n` : '') +
                    (errorCount > 0 ? `❌ فشل: ${errorCount} طالب` : '');

    showToast(message, {
        title: 'نتيجة الاستيراد',
        type: errorCount > 0 ? 'warning' : 'success'
    });
    
    // Note: Import may include completed skills, so refresh activities
    await renderAdminStudents({ refreshActivities: true });
}


