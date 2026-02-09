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

    // InvalidateAllCaches when data changes
    invalidateAllCaches();

    customAlert(message, {
        icon: failCount > 0 ? '⚠️' : '✅',
        title: 'نتيجة الإضافة',
        onClose: () => renderAdminStudents()
    });
}

async function showBatchSkillModal(preSelectedTemplate = null) {
    const modal = document.getElementById('batchSkillModal');
    const skillContent = document.getElementById('batchSkillContent');
    
    // Build content based on whether we have a pre-selected template
    if (preSelectedTemplate) {
        // Show only the selected skill - no input fields
        skillContent.innerHTML = `
            <div class="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <div class="text-sm text-indigo-600 mb-1">المهارة المحددة:</div>
                <div class="font-bold text-indigo-900">${preSelectedTemplate.icon} ${preSelectedTemplate.name}</div>
            </div>
        `;
        
        // Set hidden field values
        document.getElementById('batchSkillName').value = preSelectedTemplate.name;
        document.getElementById('batchSkillUrl').value = preSelectedTemplate.url || '';
        document.getElementById('batchSkillTemplateId').value = preSelectedTemplate.id;
    } else {
        // Show full skill selection interface
        skillContent.innerHTML = `
            <div class="mb-4">
                <label class="block text-sm font-bold mb-2">اختر المهارة:</label>
                <select id="batchSkillSelect"
                    class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option value="">-- اختر مهارة --</option>
                </select>
            </div>
        `;
    }
    
    modal.classList.remove('hidden');

    // Setup modal click handler to close on backdrop click
    modal.onclick = function(e) {
        if (e.target === modal) {
            closeBatchSkillModal();
        }
    };

    // Get selected skill info for filtering students
    let selectedSkillName = null;
    if (preSelectedTemplate) {
        selectedSkillName = preSelectedTemplate.name;
    }

    // Only load skill templates if not pre-selected
    if (!preSelectedTemplate) {
        const skillSelect = document.getElementById('batchSkillSelect');
        
        // Clear existing options except first
        Array.from(skillSelect.options).forEach(option => {
            if (option.value !== '') {
                option.remove();
            }
        });

        // Use cached skill templates map if available
        const skillTemplatesMap = await getSkillTemplatesMap();
        const templates = Object.values(skillTemplatesMap);
        
        templates.forEach(template => {
            const newOption = document.createElement('option');
            newOption.value = template.name;
            newOption.textContent = `${template.icon || '📚'} ${template.name}`;
            newOption.setAttribute('data-url', template.url || '');
            newOption.setAttribute('data-id', template.id);
            skillSelect.appendChild(newOption);
        });
        
        // Setup skill select change handler to update student list
        skillSelect.onchange = async function() {
            selectedSkillName = this.value;
            await updateStudentCheckboxes(selectedSkillName);
        };
    }

    // Load students and check which ones already have the skill
    await updateStudentCheckboxes(selectedSkillName);
}

// Helper function to update student checkboxes based on selected skill
async function updateStudentCheckboxes(selectedSkillName) {
    const studentList = document.getElementById('studentCheckboxList');
    studentList.innerHTML = '<div class="text-center text-slate-400 p-4"><div class="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto"></div></div>';

    if (!allStudentsCache || allStudentsCache.length === 0) {
        studentList.innerHTML = '<div class="text-center text-slate-400 p-4">لا يوجد طلاب</div>';
        return;
    }

    // Get all students with their skills to check who already has this skill
    let studentsWithSkills = new Map();
    
    if (selectedSkillName) {
        try {
            const result = await adminAPI.getStudentsWithSkills();
            if (result.success && result.students) {
                result.students.forEach(student => {
                    const skillNames = student.skills ? student.skills.map(s => s.name) : [];
                    studentsWithSkills.set(student.id, skillNames);
                });
            }
        } catch (error) {
            console.error('Error fetching students with skills:', error);
        }
    }

    studentList.innerHTML = '';
    allStudentsCache.forEach(student => {
        const hasSkill = selectedSkillName && studentsWithSkills.get(student.id)?.includes(selectedSkillName);
        const label = document.createElement('label');
        label.className = `flex items-center p-2 rounded ${hasSkill ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50'}`;
        label.innerHTML = `
            <input type="checkbox" class="student-checkbox mr-2" value="${student.id}" data-name="${student.name}" ${hasSkill ? 'disabled' : ''}>
            <span>${student.name} - ${student.code}${hasSkill ? ' ✅ (لديه المهارة)' : ''}</span>
        `;
        studentList.appendChild(label);
    });
}

function closeBatchSkillModal() {
    const modal = document.getElementById('batchSkillModal');
    modal.classList.add('hidden');
    modal.onclick = null; // Remove click handler
}

function toggleSelectAllStudents() {
    const selectAll = document.getElementById('selectAllStudents');
    const checkboxes = document.querySelectorAll('.student-checkbox:not([disabled])');
    checkboxes.forEach(cb => cb.checked = selectAll.checked);
}

async function processBatchSkill() {
    const selectedCheckboxes = Array.from(document.querySelectorAll('.student-checkbox:checked'));
    
    // Get skill data from either hidden fields or form inputs
    let skillName, skillUrl, templateId;
    
    const hiddenName = document.getElementById('batchSkillName');
    const hiddenUrl = document.getElementById('batchSkillUrl');
    const hiddenTemplateId = document.getElementById('batchSkillTemplateId');
    
    if (hiddenName && hiddenName.value) {
        // Coming from pre-selected template
        skillName = hiddenName.value;
        skillUrl = hiddenUrl.value;
        templateId = hiddenTemplateId.value;
    } else {
        // Coming from manual selection
        const skillSelect = document.getElementById('batchSkillSelect');
        
        skillName = skillSelect.value;
        
        const selectedOption = skillSelect.options[skillSelect.selectedIndex];
        skillUrl = selectedOption?.getAttribute('data-url') || '';
        templateId = selectedOption?.getAttribute('data-id');
    }

    if (!skillName) {
        customAlert("يرجى اختيار مهارة", { icon: '⚠️', title: 'بيانات ناقصة' });
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
    let skippedCount = 0;

    // Get all students with skills to verify no duplicates
    let studentsWithSkills = new Map();
    try {
        const result = await adminAPI.getStudentsWithSkills();
        if (result.success && result.students) {
            result.students.forEach(student => {
                const skillNames = student.skills ? student.skills.map(s => s.name) : [];
                studentsWithSkills.set(student.id, skillNames);
            });
        }
    } catch (error) {
        console.error('Error fetching students with skills:', error);
    }

    for (const checkbox of selectedCheckboxes) {
        const studentId = checkbox.value;
        
        // Double-check if student already has this skill (server-side validation)
        if (studentsWithSkills.get(studentId)?.includes(skillName)) {
            skippedCount++;
            continue;
        }
        
        const result = await adminAPI.addSkill(studentId, skillName, 1, skillUrl, null, null);
        
        if (result.success) {
            successCount++;
        } else {
            failCount++;
        }
    }
    
    // Update usage count for the skill template if it's not custom
    if (templateId && successCount > 0) {
        try {
            await fetch(`/api/skill-templates/${templateId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                },
                body: JSON.stringify({ 
                    name: skillName,
                    url: skillUrl,
                    is_active: true
                })
            });
            
            // Reload skill templates to update usage count display
            if (typeof loadSkillTemplates === 'function') {
                await loadSkillTemplates();
            }
        } catch (e) {
            console.error('Error updating usage count:', e);
        }
    }

    const message = `تمت إضافة المهارة لـ ${successCount} طالب` +
                    (failCount > 0 ? `\nفشل إضافة المهارة لـ ${failCount} طالب` : '');

    // Invalidate all caches when data changes
    invalidateAllCaches();

    customAlert(message, {
        icon: failCount > 0 ? '⚠️' : '✅',
        title: 'نتيجة العملية',
        onClose: () => renderAdminStudents()
    });
}
