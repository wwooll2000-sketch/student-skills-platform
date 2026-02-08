// Skills Management Functions

async function renderStudentSkillsFromDB(studentId) {
    const tbody = document.getElementById('skillsTableBody');
    tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center"><div class="animate-spin rounded-full h-10 w-10 border-b-4 border-indigo-600 mx-auto mb-2"></div><p class="text-slate-600">جاري تحميل المهارات...</p></td></tr>';

    // Use admin API to get skills for the selected student when admin is viewing
    const skillsResult = isAdmin ? await adminAPI.getStudentSkills(studentId) : await studentAPI.getSkills();

    tbody.innerHTML = '';

    if (isAdmin) {
        document.getElementById('adminHeaderDelete').classList.remove('hidden');
        document.getElementById('adminHeaderEdit').classList.remove('hidden');
        // Show notes button for admin
        const notesBtn = document.getElementById('studentNotesBtn');
        if (notesBtn) notesBtn.classList.remove('hidden');
    } else {
        document.getElementById('adminHeaderDelete').classList.add('hidden');
        document.getElementById('adminHeaderEdit').classList.add('hidden');
        // Hide notes button for students
        const notesBtn = document.getElementById('studentNotesBtn');
        if (notesBtn) notesBtn.classList.add('hidden');
    }

    if (!skillsResult.success || !skillsResult.data || skillsResult.data.skills.length === 0) {
        const colspan = isAdmin ? '5' : '3';
        tbody.innerHTML = `<tr><td colspan="${colspan}" class="p-10 text-center text-slate-400">لا توجد مهارات</td></tr>`;
        updateStudentProgressBar(0, 0);
        return;
    }

    const skills = skillsResult.data.skills;
    allSkillsCache = skills; // Cache for filtering
    
    // Calculate progress
    const completedCount = skills.filter(s => s.level === 3 || s.level === 2).length;
    const totalCount = skills.length;
    updateStudentProgressBar(completedCount, totalCount);

    skills.forEach((skill) => {
        const row = document.createElement('tr');
        row.className = "border-b border-slate-100";

        const skillName = skill.name || 'مهارة بدون عنوان';
        const skillUrl = skill.description || '#';
        const isDone = skill.level === 3 || skill.level === 2;

        const statusText = isDone ? '✅ تم' : '❌ لم تكتمل';
        const statusColor = isDone ? 'text-green-600' : 'text-red-400';

        let deleteBtn = isAdmin ? `<td class="p-2 sm:p-4 text-center"><button onclick="deleteSkill('${skill.id}')" class="text-red-500 hover:text-red-700 text-xl sm:text-2xl">🗑️</button></td>` : '';

        let editBtn = isAdmin ? `<td class="p-2 sm:p-4 text-center"><button onclick="showEditSkillModal('${skill.id}')" class="text-blue-500 hover:text-blue-700 text-xl sm:text-2xl">✏️</button></td>` : '';

        row.innerHTML = `
            <td class="p-2 sm:p-4 text-slate-700 text-xs sm:text-base">${skillName}</td>
            <td class="p-2 sm:p-4 text-center">
                <a href="${skillUrl}" target="_blank" class="text-xl sm:text-2xl hover:scale-110 transition-transform inline-block" title="فتح الملف">
                    📂
                </a>
            </td>
            <td class="p-2 sm:p-4 text-center">
                <button onclick="toggleSkill('${skill.id}')" class="${statusColor} font-bold px-2 sm:px-3 py-1 hover:opacity-80 text-xs sm:text-sm">
                    ${statusText}
                </button>
            </td>
            ${editBtn}
            ${deleteBtn}
        `;
        tbody.appendChild(row);
    });
}

async function toggleSkill(skillId) {
    if (!isAdmin) return;

    const tbody = document.getElementById('skillsTableBody');
    const originalContent = tbody.innerHTML;
    tbody.innerHTML = '<tr><td colspan="4" class="p-6 text-center"><div class="animate-spin rounded-full h-8 w-8 border-b-4 border-indigo-600 mx-auto"></div></td></tr>';

    // Use admin API to get skills for the selected student
    const skillsResult = await adminAPI.getStudentSkills(selectedStudentId);
    if (!skillsResult.success) {
        customAlert("خطأ في تحميل المهارات", { icon: '❌', title: 'خطأ' });
        tbody.innerHTML = originalContent;
        return;
    }

    const skill = skillsResult.data.skills.find(s => s.id === skillId);
    if (!skill) {
        customAlert("المهارة غير موجودة", { icon: '❌', title: 'خطأ' });
        tbody.innerHTML = originalContent;
        return;
    }

    const newLevel = skill.level === 3 ? 1 : 3;

    const result = await adminAPI.updateSkill(
        skillId,
        skill.name,
        newLevel,
        skill.description || '',
        skill.category || '',
        skill.notes || ''
    );

    if (result.success) {
        await renderStudentSkillsFromDB(selectedStudentId);
    } else {
        customAlert("خطأ في تحديث المهارة: " + (result.message || ''), { icon: '❌', title: 'خطأ' });
        tbody.innerHTML = originalContent;
    }
}

async function deleteSkill(skillId) {
    if (!isAdmin) return;

    customConfirm("هل أنت متأكد من حذف المهارة؟", async () => {
        const tbody = document.getElementById('skillsTableBody');
        tbody.innerHTML = '<tr><td colspan="4" class="p-6 text-center"><div class="animate-spin rounded-full h-8 w-8 border-b-4 border-indigo-600 mx-auto mb-2"></div><p class="text-slate-600">جاري حذف المهارة...</p></td></tr>';

        const result = await adminAPI.deleteSkill(skillId);

        if (result.success) {
            customAlert("تم حذف المهارة بنجاح", { 
                icon: '✅', 
                title: 'تم الحذف',
                onClose: () => renderStudentSkillsFromDB(selectedStudentId)
            });
        } else {
            customAlert("خطأ في حذف المهارة: " + (result.message || ''), { 
                icon: '❌', 
                title: 'خطأ',
                onClose: () => renderStudentSkillsFromDB(selectedStudentId)
            });
        }
    }, {
        icon: '🗑️',
        title: 'تأكيد الحذف',
        confirmText: 'حذف',
        cancelText: 'إلغاء'
    });
}

async function saveNewSkill() {
    const drop = document.getElementById('skillDropdown');
    let skillName = drop.value === 'custom' ? document.getElementById('manualSkillInput').value.trim() : drop.value;
    const url = document.getElementById('newFileLink').value.trim();

    if (!skillName || !url) {
        customAlert("يرجى إكمال جميع البيانات المطلوبة", { icon: '⚠️', title: 'بيانات ناقصة' });
        return;
    }

    const button = event?.target || document.querySelector('button[onclick="saveNewSkill()"]');
    if (button) setButtonLoading(button, true);
    const tbody = document.getElementById('skillsTableBody');
    tbody.innerHTML = '<tr><td colspan="4" class="p-6 text-center"><div class="animate-spin rounded-full h-8 w-8 border-b-4 border-indigo-600 mx-auto mb-2"></div><p class="text-slate-600">جاري إضافة المهارة...</p></td></tr>';

    const result = await adminAPI.addSkill(
        selectedStudentId,
        skillName,
        1,
        url,
        null,
        null
    );

    if (button) setButtonLoading(button, false);

    if (result.success) {
        if (drop.value === 'custom' && skillName) {
            await addSkillToDropdown(skillName, url);
        }

        drop.value = '';
        document.getElementById('manualSkillInput').value = '';
        document.getElementById('manualSkillInput').classList.add('hidden');
        document.getElementById('newFileLink').value = '';

        customAlert("تم إضافة المهارة بنجاح", { 
            icon: '✅', 
            title: 'نجحت العملية',
            onClose: () => renderStudentSkillsFromDB(selectedStudentId)
        });
    } else {
        customAlert("خطأ في إضافة المهارة: " + (result.message || ''), { 
            icon: '❌', 
            title: 'خطأ',
            onClose: () => renderStudentSkillsFromDB(selectedStudentId)
        });
    }
}

async function addSkillToDropdown(skillName, url) {
    const dropdown = document.getElementById('skillDropdown');

    let savedSkills = customSkillsCache || await fetchCustomSkills();

    const exists = savedSkills.some(skill => skill.name === skillName);
    if (exists) return;

    await saveCustomSkillToDatabase(skillName, url);

    const customOption = dropdown.querySelector('option[value="custom"]');
    const newOption = document.createElement('option');
    newOption.value = skillName;
    newOption.textContent = skillName;
    newOption.setAttribute('data-url', url);
    dropdown.insertBefore(newOption, customOption);

    // Update cache
    customSkillsCache = null;
}

async function deleteSkillFromList(skillName, skillUrl) {
    customConfirm(`هل تريد حذف المهارة: ${skillName} من القائمة؟`, async () => {
        showLoading('savedSkillsList', 'جاري حذف المهارة...');

        await deleteCustomSkillFromDatabase(skillName);

        // Clear cache and reload
        customSkillsCache = null;
        await reloadSkillsDropdown();
        
        const savedSkills = await fetchCustomSkills();
        renderSavedSkillsList(savedSkills);
        
        customAlert("تم حذف المهارة من القائمة", { icon: '✅', title: 'تم الحذف' });
    }, {
        icon: '🗑️',
        title: 'تأكيد الحذف',
        confirmText: 'حذف',
        cancelText: 'إلغاء'
    });
}

async function reloadSkillsDropdown() {
    const dropdown = document.getElementById('skillDropdown');

    const options = Array.from(dropdown.options);
    options.forEach(option => {
        if (option.value !== '' && option.value !== 'التمييز بين ال الشمسية وال القمرية' && option.value !== 'custom') {
            option.remove();
        }
    });

    const savedSkills = await fetchCustomSkills();
    customSkillsCache = savedSkills;
    
    const customOption = dropdown.querySelector('option[value="custom"]');

    savedSkills.forEach(skill => {
        const newOption = document.createElement('option');
        newOption.value = skill.name;
        newOption.textContent = skill.name;
        newOption.setAttribute('data-url', skill.url);
        dropdown.insertBefore(newOption, customOption);
    });
}

async function loadAndPopulateCustomSkills() {
    const savedSkills = await fetchCustomSkills();
    customSkillsCache = savedSkills;
    
    const dropdown = document.getElementById('skillDropdown');
    const customOption = dropdown.querySelector('option[value="custom"]');

    savedSkills.forEach(skill => {
        const newOption = document.createElement('option');
        newOption.value = skill.name;
        newOption.textContent = skill.name;
        newOption.setAttribute('data-url', skill.url);
        dropdown.insertBefore(newOption, customOption);
    });
}

// Database functions
async function fetchCustomSkills() {
    try {
        const response = await fetch('/api/custom-skills', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
            }
        });
        if (response.ok) {
            const data = await response.json();
            return data.skills || [];
        }
    } catch (error) {
        console.error('خطأ في جلب المهارات المخصصة:', error);
    }
    return [];
}

async function saveCustomSkillToDatabase(name, url) {
    try {
        const response = await fetch('/api/custom-skills', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
            },
            body: JSON.stringify({ name, url })
        });
        if (response.ok) {
            customSkillsCache = null; // Clear cache
            await reloadSkillsDropdown();
            
            const savedSkills = await fetchCustomSkills();
            renderSavedSkillsList(savedSkills);
        }
    } catch (error) {
        console.error('خطأ في حفظ المهارة:', error);
    }
}

async function deleteCustomSkillFromDatabase(name) {
    try {
        const response = await fetch(`/api/custom-skills/${encodeURIComponent(name)}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
            }
        });
        return response.ok;
    } catch (error) {
        console.error('خطأ في حذف المهارة:', error);
        return false;
    }
}

function backToHome() {
    // Clear saved skills view state before reloading
    sessionStorage.removeItem('skillsView_studentId');
    sessionStorage.removeItem('skillsView_studentData');
    
    // Simply reload the page to refresh all data
    window.location.reload();
}

function applySkillFilter() {
    const filterValue = document.getElementById('skillFilterSelect').value;
    const tbody = document.getElementById('skillsTableBody');

    if (!allSkillsCache || allSkillsCache.length === 0) {
        return;
    }

    let filteredSkills = [...allSkillsCache];

    if (filterValue === 'completed') {
        filteredSkills = filteredSkills.filter(s => s.level === 3 || s.level === 2);
    } else if (filterValue === 'incomplete') {
        filteredSkills = filteredSkills.filter(s => s.level !== 3 && s.level !== 2);
    }

    tbody.innerHTML = '';

    if (filteredSkills.length === 0) {
        const colspan = isAdmin ? '5' : '3';
        tbody.innerHTML = `<tr><td colspan="${colspan}" class="p-10 text-center text-slate-400">لا توجد مهارات</td></tr>`;
        return;
    }

    filteredSkills.forEach((skill) => {
        const row = document.createElement('tr');
        row.className = "border-b border-slate-100";

        const skillName = skill.name || 'مهارة بدون عنوان';
        const skillUrl = skill.description || '#';
        const isDone = skill.level === 3 || skill.level === 2;

        const statusText = isDone ? '✅ تم' : '❌ لم تكتمل';
        const statusColor = isDone ? 'text-green-600' : 'text-red-400';

        let editBtn = isAdmin ? `<td class="p-2 sm:p-4 text-center"><button onclick="showEditSkillModal('${skill.id}')" class="text-blue-500 hover:text-blue-700 text-xl sm:text-2xl">✏️</button></td>` : '';
        let deleteBtn = isAdmin ? `<td class="p-2 sm:p-4 text-center"><button onclick="deleteSkill('${skill.id}')" class="text-red-500 hover:text-red-700 text-xl sm:text-2xl">🗑️</button></td>` : '';

        row.innerHTML = `
            <td class="p-2 sm:p-4 text-slate-700 text-xs sm:text-base">${skillName}</td>
            <td class="p-2 sm:p-4 text-center">
                <a href="${skillUrl}" target="_blank" class="text-xl sm:text-2xl hover:scale-110 transition-transform inline-block" title="فتح الملف">
                    📂
                </a>
            </td>
            <td class="p-2 sm:p-4 text-center">
                <button onclick="toggleSkill('${skill.id}')" class="${statusColor} font-bold px-2 sm:px-3 py-1 hover:opacity-80 text-xs sm:text-sm">
                    ${statusText}
                </button>
            </td>
            ${editBtn}
            ${deleteBtn}
        `;
        tbody.appendChild(row);
    });
}

let currentEditingSkill = null;

function showEditSkillModal(skillId) {
    if (!isAdmin) return;

    const skill = allSkillsCache.find(s => s.id === skillId);
    if (!skill) {
        customAlert("المهارة غير موجودة", { icon: '❌', title: 'خطأ' });
        return;
    }

    currentEditingSkill = skill;
    const modal = document.getElementById('editSkillModal');
    document.getElementById('editSkillName').value = skill.name;
    document.getElementById('editSkillUrl').value = skill.description || '';

    modal.classList.remove('hidden');
    document.getElementById('editSkillName').focus();

    // Close on background click
    modal.onclick = function(e) {
        if (e.target === modal) {
            closeEditSkillModal();
        }
    };
}

function closeEditSkillModal() {
    document.getElementById('editSkillModal').classList.add('hidden');
    currentEditingSkill = null;
}

async function saveEditSkill() {
    if (!currentEditingSkill) return;

    const name = document.getElementById('editSkillName').value.trim();
    const url = document.getElementById('editSkillUrl').value.trim();

    if (!name || !url) {
        customAlert("يرجى إكمال جميع البيانات المطلوبة", { icon: '⚠️', title: 'بيانات ناقصة' });
        return;
    }

    const button = event?.target || document.querySelector('button[onclick="saveEditSkill()"]');
    if (button) setButtonLoading(button, true);

    const result = await adminAPI.updateSkill(
        currentEditingSkill.id,
        name,
        currentEditingSkill.level,
        url,
        currentEditingSkill.category || '',
        currentEditingSkill.notes || ''
    );

    if (button) setButtonLoading(button, false);

    if (result.success) {
        closeEditSkillModal();
        customAlert("تم تحديث بيانات المهارة بنجاح", { 
            icon: '✅', 
            title: 'نجحت العملية',
            onClose: () => renderStudentSkillsFromDB(selectedStudentId)
        });
    } else {
        customAlert("خطأ في تحديث المهارة: " + (result.message || ''), { icon: '❌', title: 'خطأ' });
    }
}
