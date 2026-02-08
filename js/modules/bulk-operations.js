// Bulk Operations Functions

function showBulkImportModal() {
    const modal = document.getElementById('bulkImportModal');
    modal.classList.remove('hidden');
    document.getElementById('bulkStudentNames').value = '';
    document.getElementById('bulkStudentNames').focus();
}

function closeBulkImportModal() {
    document.getElementById('bulkImportModal').classList.add('hidden');
}

async function processBulkImport() {
    const textarea = document.getElementById('bulkStudentNames');
    const names = textarea.value.split('\n').filter(name => name.trim());

    if (names.length === 0) {
        customAlert("يرجى إدخال أسماء الطلاب", { icon: '⚠️', title: 'تنبيه' });
        return;
    }

    closeBulkImportModal();
    showLoading('adminStudentsList', `جاري إضافة ${names.length} طالب...`);

    let successCount = 0;
    let failCount = 0;

    for (const name of names) {
        const trimmedName = name.trim();
        if (!trimmedName) continue;

        const code = generateRandomCode();
        const result = await adminAPI.addStudent(trimmedName, code, null, null);

        if (result.success) {
            successCount++;
        } else {
            failCount++;
        }
    }

    const message = `تمت إضافة ${successCount} طالب بنجاح` + 
                    (failCount > 0 ? `\nفشل إضافة ${failCount} طالب` : '');

    customAlert(message, {
        icon: failCount > 0 ? '⚠️' : '✅',
        title: 'نتيجة الإضافة',
        onClose: () => renderAdminStudents()
    });
}

async function showBatchSkillModal() {
    const modal = document.getElementById('batchSkillModal');
    modal.classList.remove('hidden');

    // Populate skill dropdown
    const skillSelect = document.getElementById('batchSkillSelect');
    const customOption = skillSelect.querySelector('option[value="custom"]');
    
    // Clear existing options except first and custom
    Array.from(skillSelect.options).forEach(option => {
        if (option.value !== '' && option.value !== 'custom') {
            option.remove();
        }
    });

    // Add saved skills
    const savedSkills = customSkillsCache || await fetchCustomSkills();
    savedSkills.forEach(skill => {
        const newOption = document.createElement('option');
        newOption.value = skill.name;
        newOption.textContent = skill.name;
        newOption.setAttribute('data-url', skill.url);
        skillSelect.insertBefore(newOption, customOption);
    });

    // Load student checkboxes
    const result = await adminAPI.getAllStudents();
    const studentList = document.getElementById('studentCheckboxList');
    studentList.innerHTML = '';

    if (result.success && result.students.length > 0) {
        result.students.forEach(student => {
            const label = document.createElement('label');
            label.className = 'flex items-center cursor-pointer hover:bg-slate-50 p-2 rounded';
            label.innerHTML = `
                <input type="checkbox" class="student-checkbox mr-2" value="${student.id}" data-name="${student.name}">
                <span>${student.name} - ${student.code}</span>
            `;
            studentList.appendChild(label);
        });
    } else {
        studentList.innerHTML = '<div class="text-center text-slate-400 p-4">لا يوجد طلاب</div>';
    }

    // Setup skill select change handler
    skillSelect.onchange = function() {
        const customInput = document.getElementById('batchSkillCustom');
        const linkInput = document.getElementById('batchSkillLink');
        
        if (this.value === 'custom') {
            customInput.classList.remove('hidden');
            linkInput.value = '';
        } else {
            customInput.classList.add('hidden');
            customInput.value = '';
            const selectedOption = this.options[this.selectedIndex];
            const url = selectedOption.getAttribute('data-url');
            linkInput.value = url || '';
        }
    };
}

function closeBatchSkillModal() {
    document.getElementById('batchSkillModal').classList.add('hidden');
}

function toggleSelectAllStudents() {
    const selectAll = document.getElementById('selectAllStudents');
    const checkboxes = document.querySelectorAll('.student-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAll.checked);
}

async function processBatchSkill() {
    const skillSelect = document.getElementById('batchSkillSelect');
    const customInput = document.getElementById('batchSkillCustom');
    const linkInput = document.getElementById('batchSkillLink');
    const selectedCheckboxes = Array.from(document.querySelectorAll('.student-checkbox:checked'));

    const skillName = skillSelect.value === 'custom' ? customInput.value.trim() : skillSelect.value;
    const skillUrl = linkInput.value.trim();

    if (!skillName || !skillUrl) {
        customAlert("يرجى إكمال بيانات المهارة", { icon: '⚠️', title: 'بيانات ناقصة' });
        return;
    }

    if (selectedCheckboxes.length === 0) {
        customAlert("يرجى اختيار طالب واحد على الأقل", { icon: '⚠️', title: 'تنبيه' });
        return;
    }

    closeBatchSkillModal();
    showLoading('adminStudentsList', `جاري إضافة المهارة لـ ${selectedCheckboxes.length} طالب...`);

    let successCount = 0;
    let failCount = 0;

    for (const checkbox of selectedCheckboxes) {
        const studentId = checkbox.value;
        const result = await adminAPI.addSkill(studentId, skillName, 1, skillUrl, null, null);
        
        if (result.success) {
            successCount++;
        } else {
            failCount++;
        }
    }

    const message = `تمت إضافة المهارة لـ ${successCount} طالب` +
                    (failCount > 0 ? `\nفشل إضافة المهارة لـ ${failCount} طالب` : '');

    customAlert(message, {
        icon: failCount > 0 ? '⚠️' : '✅',
        title: 'نتيجة العملية',
        onClose: () => renderAdminStudents()
    });
}
