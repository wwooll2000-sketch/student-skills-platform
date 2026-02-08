// Student Management Functions

function generateRandomCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

async function addNewStudent() {
    const name = document.getElementById('newStudentName').value.trim();
    if (!name) {
        customAlert("يرجى إدخال اسم الطالب", { icon: '⚠️', title: 'تنبيه' });
        return;
    }

    const button = event?.target || document.querySelector('button[onclick="addNewStudent()"]');
    if (button) setButtonLoading(button, true);
    showLoading('adminStudentsList', 'جاري إضافة الطالب...');

    const code = generateRandomCode();
    const result = await adminAPI.addStudent(name, code, null, null);

    if (button) setButtonLoading(button, false);

    if (result.success) {
        document.getElementById('newStudentName').value = '';
        customAlert(`${result.message}\n\nالاسم: ${name}\nالرقم: ${code}`, { 
            icon: '✅', 
            title: 'تم إضافة الطالب',
            onClose: () => renderAdminStudents()
        });
    } else {
        customAlert(result.message || "خطأ في إضافة الطالب", { 
            icon: '❌', 
            title: 'خطأ',
            onClose: () => renderAdminStudents()
        });
    }
}

async function deleteStudent(id) {
    if (!isAdmin) return;

    showLoading('adminStudentsList', 'جاري جلب بيانات الطالب...');

    const result = await adminAPI.getAllStudents();
    if (!result.success) {
        customAlert("خطأ في جلب بيانات الطالب", { 
            icon: '❌', 
            title: 'خطأ',
            onClose: () => renderAdminStudents()
        });
        return;
    }

    const student = result.students.find(s => s.id === id);
    if (!student) {
        customAlert("الطالب غير موجود", { 
            icon: '❌', 
            title: 'خطأ',
            onClose: () => renderAdminStudents()
        });
        return;
    }

    customConfirm(`هل أنت متأكد من حذف الطالب: ${student.name}؟`, async () => {
        showLoading('adminStudentsList', 'جاري حذف الطالب...');
        const deleteResult = await adminAPI.deleteStudent(id);

        if (deleteResult.success) {
            customAlert("تم حذف الطالب بنجاح", { 
                icon: '✅', 
                title: 'تم الحذف',
                onClose: () => renderAdminStudents()
            });
        } else {
            customAlert(deleteResult.message || "خطأ في حذف الطالب", { 
                icon: '❌', 
                title: 'خطأ',
                onClose: () => renderAdminStudents()
            });
        }
    }, {
        icon: '🗑️',
        title: 'تأكيد الحذف',
        confirmText: 'حذف',
        cancelText: 'إلغاء',
        onCancel: () => renderAdminStudents()
    });
}

async function loadStudentsFromDatabase() {
    try {
        const result = await adminAPI.getAllStudents();
        if (result.success) {
            console.log('✅ تم تحميل', result.students.length, 'طالب من قاعدة البيانات');
            return result.students;
        } else {
            console.warn('⚠️ خطأ في تحميل الطلاب:', result.message);
            return [];
        }
    } catch (error) {
        console.error('❌ خطأ في الاتصال بقاعدة البيانات:', error);
        return [];
    }
}

async function renderAdminStudents() {
    const container = document.getElementById('adminStudentsList');
    showLoading('adminStudentsList', 'جاري تحميل البيانات...');

    const students = await loadStudentsFromDatabase();

    // Cache students for search and filter
    allStudentsCache = students;

    // Load saved skills in parallel with better caching
    if (!customSkillsCache) {
        customSkillsCache = await fetchCustomSkills();
    }

    // Update statistics
    updateStatistics();

    // Render students using the filter function
    applySortAndFilter();

    renderSavedSkillsList(customSkillsCache);
    
    // Load recent activity feed
    loadRecentActivity();
}

function renderSavedSkillsList(savedSkills) {
    const container = document.getElementById('savedSkillsList');
    container.innerHTML = '';

    if (!savedSkills || savedSkills.length === 0) {
        container.innerHTML = '<div class="p-4 text-center text-slate-400">لا توجد مهارات محفوظة</div>';
        return;
    }

    savedSkills.forEach(skill => {
        const div = document.createElement('div');
        div.className = "p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 rounded-lg hover:bg-slate-100 transition gap-2";
        div.innerHTML = `
            <div class="flex-1 w-full">
                <span class="font-medium text-slate-800 text-sm sm:text-base">${skill.name}</span>
                <a href="${skill.url}" target="_blank" class="block sm:inline mr-0 sm:mr-2 text-indigo-500 text-xs sm:text-sm hover:underline mt-1 sm:mt-0">🔗 الرابط</a>
            </div>
            <button onclick="deleteSkillFromList('${skill.name.replace(/'/g, "\\'")}','${skill.url.replace(/'/g, "\\'")}')" class="text-red-500 hover:text-red-700 text-xs sm:text-sm px-3 py-2 bg-white rounded-lg w-full sm:w-auto">🗑️ حذف</button>
        `;
        container.appendChild(div);
    });
}

async function showStudentSkills(id) {
    selectedStudentId = id;

    // Get the button that was clicked
    const button = event?.target;
    if (button) setButtonLoading(button, true);

    const result = await adminAPI.getAllStudents();
    const student = result.students.find(s => s.id === id);

    if (!student) {
        if (button) setButtonLoading(button, false);
        customAlert("الطالب غير موجود", { 
            icon: '❌', 
            title: 'خطأ',
            onClose: () => renderAdminStudents()
        });
        return;
    }

    selectedStudent = student;
    document.getElementById('currentStudentTitle').innerText = student.name;

    await renderStudentSkillsFromDB(id);

    // Clear the loading indicator before switching views
    renderFilteredStudents(allStudentsCache);

    // Save state for page refresh persistence
    sessionStorage.setItem('skillsView_studentId', id);
    sessionStorage.setItem('skillsView_studentData', JSON.stringify(student));

    document.getElementById('studentLoginView').classList.add('hidden');
    document.getElementById('adminDashboardView').classList.add('hidden');
    document.getElementById('skillsDetailView').classList.remove('hidden');

    if (button) setButtonLoading(button, false);
}

function renderFilteredStudents(students) {
    const container = document.getElementById('adminStudentsList');
    const countDisplay = document.getElementById('studentCountDisplay');
    
    container.innerHTML = '';

    // Update count display
    if (countDisplay) {
        const totalCount = allStudentsCache.length;
        const shownCount = students.length;
        if (shownCount < totalCount) {
            countDisplay.textContent = `عرض ${shownCount} من ${totalCount} طالب`;
        } else {
            countDisplay.textContent = `إجمالي: ${totalCount} طالب`;
        }
    }

    if (students.length === 0) {
        container.innerHTML = '<div class="p-8 text-center text-slate-400">لا توجد نتائج</div>';
        return;
    }

    students.forEach(student => {
        const div = document.createElement('div');
        div.className = "p-3 sm:p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:bg-slate-50 transition gap-2 sm:gap-0";
        div.innerHTML = `
            <div class="flex-1">
                <span class="font-bold text-slate-800 text-sm sm:text-base">${student.name}</span>
                <span class="mr-2 sm:mr-4 text-indigo-600 font-mono bg-indigo-50 px-2 py-1 rounded text-xs sm:text-sm">رقم: ${student.code}</span>
            </div>
            <div class="flex gap-2 w-full sm:w-auto">
                <button onclick="showStudentSkills('${student.id}')" class="flex-1 sm:flex-none text-xs sm:text-sm text-white bg-indigo-500 hover:bg-indigo-600 px-3 py-2 rounded-lg transition">عرض المهارات</button>
                <button onclick="showEditStudentModal('${student.id}')" class="text-xs sm:text-sm text-white bg-blue-500 hover:bg-blue-600 px-3 py-2 rounded-lg transition">✏️ تعديل</button>
                <button onclick="deleteStudent('${student.id}')" class="text-xs sm:text-sm text-white bg-red-500 hover:bg-red-600 px-3 py-2 rounded-lg transition">🗑️ حذف</button>
            </div>
        `;
        container.appendChild(div);
    });
}

async function deleteAllStudents() {
    if (!isAdmin) return;

    const result = await adminAPI.getAllStudents();
    if (!result.success) {
        customAlert("خطأ في جلب بيانات الطلاب", { icon: '❌', title: 'خطأ' });
        return;
    }

    const students = result.students;
    if (students.length === 0) {
        customAlert("لا يوجد طلاب لحذفهم", { icon: '⚠️', title: 'تنبيه' });
        return;
    }

    customConfirm(
        `هل أنت متأكد من حذف جميع الطلاب (${students.length} طالب)؟\n\nتحذير: لا يمكن التراجع عن هذا الإجراء!`,
        async () => {
            showLoading('adminStudentsList', `جاري حذف ${students.length} طالب...`);

            let successCount = 0;
            let failCount = 0;

            for (const student of students) {
                const deleteResult = await adminAPI.deleteStudent(student.id);
                if (deleteResult.success) {
                    successCount++;
                } else {
                    failCount++;
                }
            }

            const message = failCount > 0 
                ? `تم حذف ${successCount} طالب بنجاح\nفشل حذف ${failCount} طالب`
                : `تم حذف جميع الطلاب (${successCount}) بنجاح`;

            customAlert(message, {
                icon: failCount > 0 ? '⚠️' : '✅',
                title: 'نتيجة الحذف',
                onClose: () => renderAdminStudents()
            });
        },
        {
            icon: '⚠️',
            title: 'تأكيد حذف جميع الطلاب',
            confirmText: 'حذف الجميع',
            cancelText: 'إلغاء'
        }
    );
}

let currentEditingStudent = null;

function showEditStudentModal(studentId) {
    if (!isAdmin) return;

    const student = allStudentsCache.find(s => s.id === studentId);
    if (!student) {
        customAlert("الطالب غير موجود", { icon: '❌', title: 'خطأ' });
        return;
    }

    currentEditingStudent = student;
    const modal = document.getElementById('editStudentModal');
    document.getElementById('editStudentName').value = student.name;
    document.getElementById('editStudentCode').value = student.code;

    modal.classList.remove('hidden');
    document.getElementById('editStudentName').focus();

    // Close on background click
    modal.onclick = function(e) {
        if (e.target === modal) {
            closeEditStudentModal();
        }
    };
}

function closeEditStudentModal() {
    document.getElementById('editStudentModal').classList.add('hidden');
    currentEditingStudent = null;
}

async function saveEditStudent() {
    if (!currentEditingStudent) return;

    const name = document.getElementById('editStudentName').value.trim();
    const code = document.getElementById('editStudentCode').value.trim();

    if (!name || !code) {
        customAlert("يرجى إكمال جميع البيانات المطلوبة", { icon: '⚠️', title: 'بيانات ناقصة' });
        return;
    }

    const button = event?.target || document.querySelector('button[onclick="saveEditStudent()"]');
    if (button) setButtonLoading(button, true);

    const result = await adminAPI.updateStudent(
        currentEditingStudent.id,
        name,
        code,
        null,
        null
    );

    if (button) setButtonLoading(button, false);

    if (result.success) {
        closeEditStudentModal();
        customAlert("تم تحديث بيانات الطالب بنجاح", { 
            icon: '✅', 
            title: 'نجحت العملية',
            onClose: () => renderAdminStudents()
        });

        // Update the selected student if we're viewing their skills
        if (selectedStudent && selectedStudent.id === currentEditingStudent.id) {
            selectedStudent.name = name;
            selectedStudent.code = code;
            document.getElementById('currentStudentTitle').innerText = name;
            sessionStorage.setItem('skillsView_studentData', JSON.stringify(selectedStudent));
        }
    } else {
        customAlert("خطأ في تحديث الطالب: " + (result.message || ''), { icon: '❌', title: 'خطأ' });
    }
}
