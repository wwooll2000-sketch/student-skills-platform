// Student Management Functions

const STUDENTS_PER_PAGE = 10;
let currentStudentPage = 1;

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
        
        // Invalidate caches when data changes
        invalidateAllCaches();
        
        // Update statistics - WAIT for completion
        if (typeof updateStatisticsOptimized === 'function') {
            await updateStatisticsOptimized();
        }
        // Note: No need to reload activities - adding a student doesn't create activities
        
        showToast(`الاسم: ${name}\nالرقم: ${code}`, { 
            title: 'تم إضافة الطالب بنجاح',
            type: 'success'
        });
        
        await renderAdminStudents({ refreshActivities: false });
    } else {
        customAlert(result.message || "خطأ في إضافة الطالب", { 
            icon: '❌', 
            title: 'خطأ',
            onClose: () => renderAdminStudents({ refreshActivities: false })
        });
    }
}

async function deleteStudent(id) {
    if (!isAdmin) return;

    // Use cached data instead of fetching from API for instant modal display
    const student = allStudentsCache.find(s => s.id === id);
    if (!student) {
        customAlert("الطالب غير موجود", { 
            icon: '❌', 
            title: 'خطأ'
        });
        return;
    }

    customConfirm(`هل أنت متأكد من حذف الطالب: ${student.name}؟`, async () => {
        showLoading('adminStudentsList', 'جاري حذف الطالب...');
        const deleteResult = await adminAPI.deleteStudent(id);

        if (deleteResult.success) {
            // Invalidate caches when data changes
            invalidateAllCaches();
            
            // Reload skill templates to update usage counts
            if (typeof loadSkillTemplates === 'function') {
                await loadSkillTemplates();
            }
            
            // Update statistics and activities - WAIT for completion
            if (typeof updateStatisticsOptimized === 'function') {
                await updateStatisticsOptimized();
            }
            if (typeof loadRecentActivityOptimized === 'function') {
                await loadRecentActivityOptimized();
            }
            
            showToast("تم حذف الطالب بنجاح", { 
                title: 'تم الحذف',
                type: 'success'
            });
            
            // Activities and statistics already updated above, skip redundant reload
            await renderAdminStudents({ refreshActivities: false, refreshStatistics: false });
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
        cancelText: 'إلغاء'
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

async function renderAdminStudents(options = {}) {
    const { 
        refreshActivities = true,  // Only refresh activities when needed
        refreshStatistics = true   // Only refresh statistics when needed
    } = options;
    
    const container = document.getElementById('adminStudentsList');
    showLoading('adminStudentsList', 'جاري تحميل البيانات...');

    // Build dynamic list of API calls to make in parallel
    const calls = [
        loadStudentsFromDatabase(),
        customSkillsCache ? Promise.resolve(customSkillsCache) : fetchCustomSkills()
    ];
    
    if (refreshStatistics) {
        calls.push(updateStatisticsOptimized());
    }
    
    if (refreshActivities && typeof loadRecentActivityOptimized === 'function') {
        calls.push(loadRecentActivityOptimized());
    }

    const [studentsResult, customSkills] = await Promise.all(calls);

    // Cache students for search and filter
    allStudentsCache = studentsResult;

    // Cache custom skills if not already cached
    if (!customSkillsCache) {
        customSkillsCache = customSkills;
    }

    // Render students using the filter function
    applySortAndFilter();
}

async function showStudentSkills(id) {
    selectedStudentId = id;

    // Get the button that was clicked
    const button = event?.target;
    if (button) setButtonLoading(button, true);

    // Use cached data instead of fetching ALL students
    const student = allStudentsCache.find(s => s.id === id);

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
    document.getElementById('currentStudentTitle').innerText = `${student.name} - ${student.code}`;

    await renderStudentSkillsFromDB(id);

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

    const totalCount = allStudentsCache.length;
    const filteredCount = students.length;
    const totalPages = Math.ceil(filteredCount / STUDENTS_PER_PAGE);

    // Clamp page in case a deletion reduced the total
    if (currentStudentPage > totalPages && totalPages > 0) {
        currentStudentPage = totalPages;
    }

    // Update count display
    if (countDisplay) {
        const pageInfo = totalPages > 1 ? ` — صفحة ${currentStudentPage} من ${totalPages}` : '';
        if (filteredCount < totalCount) {
            countDisplay.textContent = `عرض ${filteredCount} من ${totalCount} طالب${pageInfo}`;
        } else {
            countDisplay.textContent = `إجمالي: ${totalCount} طالب${pageInfo}`;
        }
    }

    if (students.length === 0) {
        container.innerHTML = '<div class="p-8 text-center text-slate-400">لا توجد نتائج</div>';
        return;
    }

    // Slice the current page
    const startIndex = (currentStudentPage - 1) * STUDENTS_PER_PAGE;
    const pageStudents = students.slice(startIndex, startIndex + STUDENTS_PER_PAGE);

    pageStudents.forEach(student => {
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

    // Render pagination if needed
    if (totalPages > 1) {
        const paginationDiv = document.createElement('div');
        paginationDiv.className = "flex items-center justify-center gap-1 p-3 border-t border-slate-100 flex-wrap";

        // Prev button
        const prevBtn = document.createElement('button');
        prevBtn.textContent = '→';
        prevBtn.className = `px-3 py-1.5 rounded-lg text-sm font-medium transition ${currentStudentPage === 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100'}`;
        prevBtn.disabled = currentStudentPage === 1;
        prevBtn.onclick = () => { currentStudentPage--; renderFilteredStudents(students); };
        paginationDiv.appendChild(prevBtn);

        // Page number buttons
        // Show at most 5 page buttons centered around current page
        let startPage = Math.max(1, currentStudentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);

        if (startPage > 1) {
            const firstBtn = document.createElement('button');
            firstBtn.textContent = '1';
            firstBtn.className = 'px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition';
            firstBtn.onclick = () => { currentStudentPage = 1; renderFilteredStudents(students); };
            paginationDiv.appendChild(firstBtn);
            if (startPage > 2) {
                const dots = document.createElement('span');
                dots.textContent = '...';
                dots.className = 'px-1 text-slate-400 text-sm';
                paginationDiv.appendChild(dots);
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.textContent = i;
            const isActive = i === currentStudentPage;
            pageBtn.className = `px-3 py-1.5 rounded-lg text-sm font-medium transition ${isActive ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`;
            if (!isActive) {
                const pageNum = i;
                pageBtn.onclick = () => { currentStudentPage = pageNum; renderFilteredStudents(students); };
            }
            paginationDiv.appendChild(pageBtn);
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const dots = document.createElement('span');
                dots.textContent = '...';
                dots.className = 'px-1 text-slate-400 text-sm';
                paginationDiv.appendChild(dots);
            }
            const lastBtn = document.createElement('button');
            lastBtn.textContent = totalPages;
            lastBtn.className = 'px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition';
            lastBtn.onclick = () => { currentStudentPage = totalPages; renderFilteredStudents(students); };
            paginationDiv.appendChild(lastBtn);
        }

        // Next button
        const nextBtn = document.createElement('button');
        nextBtn.textContent = '←';
        nextBtn.className = `px-3 py-1.5 rounded-lg text-sm font-medium transition ${currentStudentPage === totalPages ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100'}`;
        nextBtn.disabled = currentStudentPage === totalPages;
        nextBtn.onclick = () => { currentStudentPage++; renderFilteredStudents(students); };
        paginationDiv.appendChild(nextBtn);

        container.appendChild(paginationDiv);
    }
}

async function deleteAllStudents() {
    if (!isAdmin) return;

    // Use cached data instead of fetching from API for instant modal display
    if (!allStudentsCache || allStudentsCache.length === 0) {
        customAlert("لا يوجد طلاب لحذفهم", { icon: '⚠️', title: 'تنبيه' });
        return;
    }

    const studentCount = allStudentsCache.length;

    customConfirm(
        `هل أنت متأكد من حذف جميع الطلاب (${studentCount} طالب)؟\n\nتحذير: لا يمكن التراجع عن هذا الإجراء!`,
        async () => {
            showLoading('adminStudentsList', `جاري حذف ${studentCount} طالب...`);

            // Use batch delete endpoint instead of sequential deletes
            const result = await adminAPI.deleteAllStudents();
            
            const message = result.success
                ? result.message || `تم حذف جميع الطلاب (${studentCount}) بنجاح`
                : `فشل في حذف الطلاب: ${result.message}`;

            // Invalidate all caches FIRST
            invalidateAllCaches();
            
            // Reload skill templates to update usage counts
            if (typeof loadSkillTemplates === 'function') {
                await loadSkillTemplates();
            }
            
            // Update statistics and activities - WAIT for them to complete
            if (typeof updateStatisticsOptimized === 'function') {
                await updateStatisticsOptimized();
            }
            if (typeof loadRecentActivityOptimized === 'function') {
                await loadRecentActivityOptimized();
            }

            showToast(message, {
                title: 'نتيجة الحذف',
                type: failCount > 0 ? 'warning' : 'success'
            });
            
            // Activities and statistics already updated above, skip redundant reload
            await renderAdminStudents({ refreshActivities: false, refreshStatistics: false });
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
        // Store student ID before closing modal (which sets currentEditingStudent to null)
        const editedStudentId = currentEditingStudent.id;
        
        closeEditStudentModal();
        
        // Invalidate caches when data changes
        invalidateAllCaches();
        
        // Note: No need to update statistics or activities - only name/code changed
        
        showToast("تم تحديث بيانات الطالب بنجاح", { 
            title: 'نجحت العملية',
            type: 'success'
        });
        
        await renderAdminStudents({ refreshActivities: false, refreshStatistics: false });

        // Update the selected student if we're viewing their skills
        if (selectedStudent && selectedStudent.id === editedStudentId) {
            selectedStudent.name = name;
            selectedStudent.code = code;
            document.getElementById('currentStudentTitle').innerText = name;
            sessionStorage.setItem('skillsView_studentData', JSON.stringify(selectedStudent));
        }
    } else {
        customAlert("خطأ في تحديث الطالب: " + (result.message || ''), { icon: '❌', title: 'خطأ' });
    }
}
