// Skills Management Functions

async function renderStudentSkillsFromDB(studentId) {
    const tbody = document.getElementById('skillsTableBody');
    tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center"><div class="animate-spin rounded-full h-10 w-10 border-b-4 border-indigo-600 mx-auto mb-2"></div><p class="text-slate-600">جاري تحميل المهارات...</p></td></tr>';

    // Use cached skill templates instead of fetching every time
    const skillTemplatesMap = isAdmin ? await getSkillTemplatesMap() : {};

    // Use admin API to get skills for the selected student when admin is viewing
    // Always bypass cache to get fresh data
    const skillsResult = isAdmin ? await adminAPI.getStudentSkills(studentId, true) : await studentAPI.getSkills();

    tbody.innerHTML = '';

    if (isAdmin) {
        document.getElementById('adminHeaderDelete').classList.remove('hidden');
        // Show notes button for admin
        const notesBtn = document.getElementById('studentNotesBtn');
        if (notesBtn) notesBtn.classList.remove('hidden');
        
        // Load available skills for adding
        if (typeof loadSkillsForStudent === 'function') {
            await loadSkillsForStudent(studentId);
        }
    } else {
        document.getElementById('adminHeaderDelete').classList.add('hidden');
        // Hide notes button for students
        const notesBtn = document.getElementById('studentNotesBtn');
        if (notesBtn) notesBtn.classList.add('hidden');
    }

    if (!skillsResult.success || !skillsResult.data || skillsResult.data.skills.length === 0) {
        const colspan = isAdmin ? '6' : '4';
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
        
        // Get icon from template if available
        const template = skillTemplatesMap[skillName];
        const skillIcon = template?.icon || '📚';

        const statusText = isDone ? '✅ تم' : '❌ لم تكتمل';
        const statusColor = isDone ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-100 text-red-700 border-red-300';
        const statusButtonClass = isAdmin ? 'cursor-pointer hover:opacity-70' : 'cursor-default';

        // Evidence display
        const evidenceCount = skill.evidence_count || 0;
        const evidenceHtml = evidenceCount > 0 ? 
            `<button onclick="viewSkillEvidence('${skill.id}')" class="text-2xl hover:scale-110 transition-transform relative" title="عرض الشواهد">
                📸
                ${evidenceCount > 1 ? `<span class="absolute -top-1 -right-1 bg-indigo-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">${evidenceCount}</span>` : ''}
            </button>` : 
            `<span class="text-slate-300 text-xl">—</span>`;

        let deleteBtn = isAdmin ? `<td class="p-2 sm:p-4 text-center"><button onclick="deleteSkill('${skill.id}', '${skillName.replace(/'/g, "\\'")}')" class="text-red-500 hover:text-red-700 text-xl sm:text-2xl">🗑️</button></td>` : '';

        row.innerHTML = `
            <td class="p-2 sm:p-4 text-slate-700 text-xs sm:text-base">
                <span class="text-xl sm:text-2xl mr-2">${skillIcon}</span>
                <span>${skillName}</span>
            </td>
            <td class="p-2 sm:p-4 text-center">
                <a href="${skillUrl}" target="_blank" class="text-xl sm:text-2xl hover:scale-110 transition-transform inline-block" title="فتح الملف">
                    📂
                </a>
            </td>
            <td class="p-2 sm:p-4 text-center">
                ${evidenceHtml}
            </td>
            <td class="p-2 sm:p-4 text-center">
                <button onclick="toggleSkill('${skill.id}', ${skill.level})" 
                    class="${statusColor} ${statusButtonClass} font-semibold px-3 sm:px-4 py-2 rounded-lg border-2 text-xs sm:text-sm transition-all">
                    ${statusText}
                </button>
            </td>
            ${deleteBtn}
        `;
        tbody.appendChild(row);
    });
}

// Global variable to store current skill being toggled
let currentTogglingSkillId = null;

async function toggleSkill(skillId, currentLevel) {
    if (!isAdmin) return;

    const isDone = currentLevel === 3 || currentLevel === 2;

    if (isDone) {
        // If already complete, show confirmation modal with option to delete evidence
        showMarkIncompleteModal(skillId);
    } else {
        // If incomplete, show evidence upload modal
        currentTogglingSkillId = skillId;
        showEvidenceUploadModal();
    }
}

function showMarkIncompleteModal(skillId) {
    const modalHtml = `
        <div class="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 class="text-xl font-bold mb-4 text-center">⚠️ تغيير حالة المهارة</h3>
            <p class="text-center text-slate-700 mb-6">هل تريد تغيير حالة المهارة إلى: <span class="font-bold text-red-600">لم تكتمل</span>؟</p>
            
            <div class="mb-6 bg-slate-50 p-4 rounded-lg">
                <label class="flex items-center cursor-pointer">
                    <input type="checkbox" id="deleteEvidenceCheckbox" class="w-5 h-5 text-red-600 rounded focus:ring-2 focus:ring-red-500">
                    <span class="mr-3 text-sm text-slate-700">حذف الشواهد المرتبطة بهذه المهارة</span>
                </label>
            </div>
            
            <div class="flex gap-2">
                <button onclick="confirmMarkIncomplete('${skillId}')" class="flex-1 bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 font-medium">نعم</button>
                <button onclick="closeCustomModal()" class="flex-1 bg-slate-200 text-slate-700 py-3 rounded-lg font-medium">إلغاء</button>
            </div>
        </div>
    `;
    
    showCustomModal(modalHtml);
}

async function confirmMarkIncomplete(skillId) {
    const deleteEvidence = document.getElementById('deleteEvidenceCheckbox')?.checked || false;
    
    closeCustomModal();
    
    // Show loading
    const tbody = document.getElementById('skillsTableBody');
    const originalContent = tbody.innerHTML;
    tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center"><div class="animate-spin rounded-full h-8 w-8 border-b-4 border-indigo-600 mx-auto mb-2"></div><p class="text-slate-600">جاري التحديث...</p></td></tr>';
    
    try {
        // If checkbox is checked, delete all evidence first
        if (deleteEvidence) {
            const evidenceResult = await adminAPI.getSkillEvidence(skillId);
            if (evidenceResult.success && evidenceResult.evidence) {
                for (const evidence of evidenceResult.evidence) {
                    await adminAPI.deleteEvidence(evidence.id);
                }
            }
        }
        
        // Then update skill status to incomplete
        await updateSkillStatus(skillId, 1, null);
        
        const message = deleteEvidence ? 'تم تغيير الحالة وحذف الشواهد' : 'تم تغيير الحالة بنجاح';
        showToast(message, { type: 'success', title: 'نجحت العملية' });
    } catch (error) {
        console.error('Error marking incomplete:', error);
        tbody.innerHTML = originalContent;
        customAlert('خطأ في تحديث الحالة', { icon: '❌', title: 'خطأ' });
    }
}

async function updateSkillStatus(skillId, newLevel, evidenceData) {
    const tbody = document.getElementById('skillsTableBody');
    const originalContent = tbody.innerHTML;
    tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center"><div class="animate-spin rounded-full h-8 w-8 border-b-4 border-indigo-600 mx-auto"></div></td></tr>';

    // Update skill with only level and evidence - backend will preserve other fields
    const result = await adminAPI.updateSkill(
        skillId,
        null,  // name - keep existing
        newLevel,
        null,  // description - keep existing
        null,  // notes - keep existing
        evidenceData
    );

    if (result.success) {
        // Invalidate caches when data changes
        invalidateAllCaches();
        
        // Force refresh by re-rendering immediately
        await renderStudentSkillsFromDB(selectedStudentId);
        
        // Update statistics and activities (skill completion changed) - Run in background
        if (typeof updateStatisticsOptimized === 'function') {
            updateStatisticsOptimized();
        }
        if (typeof loadRecentActivityOptimized === 'function') {
            loadRecentActivityOptimized();
        }
        
        return true;
    } else {
        customAlert("خطأ في تحديث المهارة: " + (result.message || ''), { icon: '❌', title: 'خطأ' });
        tbody.innerHTML = originalContent;
        return false;
    }
}

// Evidence Upload Modal Functions
let selectedEvidenceFiles = [];

function showEvidenceUploadModal() {
    const modal = document.getElementById('evidenceUploadModal');
    const fileInput = document.getElementById('evidenceFileInput');
    const previewGrid = document.getElementById('evidencePreviewGrid');
    
    // Reset form
    fileInput.value = '';
    selectedEvidenceFiles = [];
    previewGrid.innerHTML = '';
    previewGrid.classList.add('hidden');
    
    // Setup file input preview for multiple files
    fileInput.onchange = function(e) {
        const files = Array.from(e.target.files);
        
        // Validate each file
        for (const file of files) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                customAlert(`حجم الملف ${file.name} كبير جداً. الحد الأقصى 5 ميجابايت`, { icon: '⚠️', title: 'خطأ' });
                continue;
            }
            selectedEvidenceFiles.push(file);
        }
        
        // Clear file input to allow re-selection
        fileInput.value = '';
        
        // Update preview
        updateEvidencePreview();
    };
    
    modal.classList.remove('hidden');
    
    modal.onclick = function(e) {
        if (e.target === modal) {
            closeEvidenceUploadModal();
        }
    };
}

function updateEvidencePreview() {
    const previewGrid = document.getElementById('evidencePreviewGrid');
    previewGrid.innerHTML = '';
    
    if (selectedEvidenceFiles.length === 0) {
        previewGrid.classList.add('hidden');
        return;
    }
    
    previewGrid.classList.remove('hidden');
    
    selectedEvidenceFiles.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const div = document.createElement('div');
            div.className = 'relative group';
            div.innerHTML = `
                <img src="${e.target.result}" alt="صورة ${index + 1}" class="w-full h-32 object-cover rounded-lg border-2 border-slate-200">
                <button onclick="removeEvidenceFile(${index})" class="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center font-bold text-sm shadow-lg">
                    ×
                </button>
            `;
            previewGrid.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
}

function removeEvidenceFile(index) {
    selectedEvidenceFiles.splice(index, 1);
    updateEvidencePreview();
}

function closeEvidenceUploadModal() {
    const modal = document.getElementById('evidenceUploadModal');
    modal.classList.add('hidden');
    modal.onclick = null;
    currentTogglingSkillId = null;
    selectedEvidenceFiles = [];
}

async function uploadMultipleEvidence() {
    if (!currentTogglingSkillId) {
        customAlert("خطأ: لم يتم تحديد المهارة", { icon: '❌', title: 'خطأ' });
        closeEvidenceUploadModal();
        return;
    }
    
    // Capture the skill ID and files BEFORE closing modal (which clears the array)
    const skillId = currentTogglingSkillId;
    const filesToUpload = [...selectedEvidenceFiles]; // Create a copy of the array
    
    const button = document.getElementById('uploadEvidenceBtn');
    setButtonLoading(button, true);
    
    try {
        // If no files selected, just mark skill as complete without evidence
        if (filesToUpload.length === 0) {
            closeEvidenceUploadModal();
            const success = await updateSkillStatus(skillId, 3, null);
            setButtonLoading(button, false);
            if (success) {
                showToast("تم إكمال المهارة بنجاح", { type: 'success', title: 'نجحت العملية' });
            }
            return;
        }
        
        closeEvidenceUploadModal();
        
        // Upload all selected files
        let successCount = 0;
        let failedCount = 0;
        for (let i = 0; i < filesToUpload.length; i++) {
            const file = filesToUpload[i];
            
            try {
                // Convert to base64
                const base64Data = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
                
                // Add evidence to skill_evidence table
                const evidenceResult = await adminAPI.addSkillEvidence(skillId, base64Data);
                
                if (evidenceResult.success) {
                    successCount++;
                } else {
                    failedCount++;
                    
                    // Show specific error if it's about missing table
                    if (evidenceResult.error === 'skill_evidence table does not exist') {
                        customAlert(
                            'جدول الشواهد غير موجود في قاعدة البيانات.\n\nيرجى تشغيل الأمر التالي في الطرفية:\n\npython run_migration.py',
                            { icon: '⚠️', title: 'خطأ في قاعدة البيانات' }
                        );
                        setButtonLoading(button, false);
                        return;
                    }
                }
            } catch (err) {
                failedCount++;
            }
        }
        
        // Update skill status to completed
        const success = await updateSkillStatus(skillId, 3, null);
        
        setButtonLoading(button, false);
        
        if (success && successCount > 0) {
            const message = successCount === 1 ? 'تم حفظ الشاهد بنجاح' : `تم حفظ ${successCount} شواهد بنجاح`;
            showToast(message, { type: 'success', title: 'نجحت العملية' });
        } else if (success) {
            showToast("تم إكمال المهارة بنجاح", { type: 'success', title: 'نجحت العملية' });
        } else if (failedCount > 0) {
            customAlert(`فشل في رفع ${failedCount} من ${filesToUpload.length} صورة`, { icon: '❌', title: 'خطأ' });
        }
    } catch (error) {
        console.error('[Evidence Upload] General error:', error);
        setButtonLoading(button, false);
        customAlert("خطأ في رفع الشواهد", { icon: '❌', title: 'خطأ' });
    }
}

async function uploadEvidence() {
    const fileInput = document.getElementById('evidenceFileInput');
    const file = fileInput.files[0];
    
    if (!currentTogglingSkillId) {
        customAlert("خطأ: لم يتم تحديد المهارة", { icon: '❌', title: 'خطأ' });
        closeEvidenceUploadModal();
        return;
    }
    
    // Capture the skill ID before async operations (prevents it from being reset to null)
    const skillId = currentTogglingSkillId;
    
    const button = document.getElementById('uploadEvidenceBtn');
    setButtonLoading(button, true);
    
    try {
        // If no file selected, just mark skill as complete without evidence
        if (!file) {
            closeEvidenceUploadModal();
            const success = await updateSkillStatus(skillId, 3, null);
            setButtonLoading(button, false);
            if (success) {
                showToast("تم إكمال المهارة بنجاح", { type: 'success', title: 'نجحت العملية' });
            }
            return;
        }
        
        // Convert image to base64
        const reader = new FileReader();
        reader.onload = async function(e) {
            const base64Data = e.target.result;
            
            closeEvidenceUploadModal();
            
            // Add evidence to skill_evidence table
            const evidenceResult = await adminAPI.addSkillEvidence(skillId, base64Data);
            
            if (evidenceResult.success) {
                // Also update skill status to completed
                const success = await updateSkillStatus(skillId, 3, null);
                
                setButtonLoading(button, false);
                if (success) {
                    showToast("تم حفظ الشاهد بنجاح", { type: 'success', title: 'نجحت العملية' });
                }
            } else {
                setButtonLoading(button, false);
                customAlert(evidenceResult.message || "خطأ في حفظ الشاهد", { icon: '❌', title: 'خطأ' });
            }
        };
        reader.onerror = function() {
            setButtonLoading(button, false);
            customAlert("خطأ في قراءة الملف", { icon: '❌', title: 'خطأ' });
        };
        reader.readAsDataURL(file);
    } catch (error) {
        console.error('Error uploading evidence:', error);
        setButtonLoading(button, false);
        customAlert("خطأ في رفع الشاهد", { icon: '❌', title: 'خطأ' });
    }
}

// Evidence viewer
let currentViewingSkillId = null;

async function viewSkillEvidence(skillId) {
    currentViewingSkillId = skillId;
    const modal = document.getElementById('evidenceViewerModal');
    const grid = document.getElementById('evidenceGrid');
    const loading = document.getElementById('evidenceLoading');
    const empty = document.getElementById('evidenceEmpty');
    const addSection = document.getElementById('addEvidenceSection');
    
    // Show modal and loading
    modal.classList.remove('hidden');
    grid.classList.add('hidden');
    empty.classList.add('hidden');
    loading.classList.remove('hidden');
    
    // Show add button only for admin
    if (isAdmin) {
        addSection.classList.remove('hidden');
    } else {
        addSection.classList.add('hidden');
    }
    
    // Fetch evidence from API
    const result = await adminAPI.getSkillEvidence(skillId);
    
    loading.classList.add('hidden');
    
    if (result.success && result.evidence && result.evidence.length > 0) {
        grid.classList.remove('hidden');
        renderEvidenceGrid(result.evidence);
    } else {
        empty.classList.remove('hidden');
    }
}

function renderEvidenceGrid(evidenceList) {
    const grid = document.getElementById('evidenceGrid');
    grid.innerHTML = '';
    
    evidenceList.forEach((evidence, index) => {
        const div = document.createElement('div');
        div.className = "bg-slate-700 rounded-lg overflow-hidden";
        
        const deleteBtn = isAdmin ? 
            `<button onclick="deleteEvidenceItem('${evidence.id}')" class="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded transition flex-1">
                🗑️ حذف
            </button>` : '';
        
        const changeBtn = isAdmin ? 
            `<button onclick="changeEvidenceItem('${evidence.id}')" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded transition flex-1">
                🔄 تغيير
            </button>` : '';
        
        div.innerHTML = `
            <img src="${evidence.evidence_url}" alt="شاهد ${index + 1}" class="w-full h-64 object-cover cursor-pointer" onclick="openImageInFullScreen('${evidence.evidence_url}')">
            ${isAdmin ? `
            <div class="p-3 flex gap-2">
                ${changeBtn}
                ${deleteBtn}
            </div>
            ` : ''}
        `;
        
        grid.appendChild(div);
    });
}

function openImageInFullScreen(imageUrl) {
    const modal = document.getElementById('fullScreenImageModal');
    const img = document.getElementById('fullScreenImage');
    img.src = imageUrl;
    modal.classList.remove('hidden');
}

function closeFullScreenImage() {
    const modal = document.getElementById('fullScreenImageModal');
    modal.classList.add('hidden');
}

async function deleteEvidenceItem(evidenceId) {
    if (!isAdmin) return;
    
    customConfirm("هل أنت متأكد من حذف هذا الشاهد؟", async () => {
        const result = await adminAPI.deleteEvidence(evidenceId);
        
        if (result.success) {
            showToast("تم حذف الشاهد بنجاح", { type: 'success', title: 'نجحت العملية' });
            
            // Refresh evidence viewer
            await viewSkillEvidence(currentViewingSkillId);
            
            // Reload skills table to update count
            if (selectedStudentId) {
                await renderStudentSkillsFromDB(selectedStudentId);
            }
        } else {
            customAlert(result.message || "خطأ في حذف الشاهد", { icon: '❌', title: 'خطأ' });
        }
    }, {
        icon: '🗑️',
        title: 'تأكيد الحذف',
        confirmText: 'حذف',
        cancelText: 'إلغاء'
    });
}

async function changeEvidenceItem(evidenceId) {
    if (!isAdmin) return;
    
    // Create a file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    
    fileInput.onchange = async function(evt) {
        const file = evt.target.files[0];
        if (!file) return;
        
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            customAlert("حجم الملف كبير جداً. الحد الأقصى 5 ميجابايت", { icon: '⚠️', title: 'خطأ' });
            return;
        }
        
        // Show loading
        const loading = document.getElementById('evidenceLoading');
        const grid = document.getElementById('evidenceGrid');
        grid.classList.add('hidden');
        loading.classList.remove('hidden');
        
        // Convert to base64
        const reader = new FileReader();
        reader.onload = async function(e) {
            const base64Data = e.target.result;
            
            const result = await adminAPI.updateEvidence(evidenceId, base64Data);
            
            loading.classList.add('hidden');
            
            if (result.success) {
                showToast("تم تحديث الشاهد بنجاح", { type: 'success', title: 'نجحت العملية' });
                
                // Refresh evidence viewer
                await viewSkillEvidence(currentViewingSkillId);
                
                // Reload skills table
                if (selectedStudentId) {
                    await renderStudentSkillsFromDB(selectedStudentId);
                }
            } else {
                grid.classList.remove('hidden');
                customAlert(result.message || "خطأ في تحديث الشاهد", { icon: '❌', title: 'خطأ' });
            }
        };
        reader.onerror = function() {
            loading.classList.add('hidden');
            grid.classList.remove('hidden');
            customAlert("خطأ في قراءة الملف", { icon: '❌', title: 'خطأ' });
        };
        reader.readAsDataURL(file);
    };
    
    fileInput.click();
}

async function showAddEvidenceForm() {
    if (!isAdmin) return;
    
    // Create a file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    
    fileInput.onchange = async function(evt) {
        const file = evt.target.files[0];
        if (!file) return;
        
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            customAlert("حجم الملف كبير جداً. الحد الأقصى 5 ميجابايت", { icon: '⚠️', title: 'خطأ' });
            return;
        }
        
        // Show loading
        const loading = document.getElementById('evidenceLoading');
        const grid = document.getElementById('evidenceGrid');
        const empty = document.getElementById('evidenceEmpty');
        grid.classList.add('hidden');
        empty.classList.add('hidden');
        loading.classList.remove('hidden');
        
        // Convert to base64
        const reader = new FileReader();
        reader.onload = async function(e) {
            const base64Data = e.target.result;
            
            const result = await adminAPI.addSkillEvidence(currentViewingSkillId, base64Data);
            
            loading.classList.add('hidden');
            
            if (result.success) {
                showToast("تم إضافة الشاهد بنجاح", { type: 'success', title: 'نجحت العملية' });
                
                // Refresh evidence viewer
                await viewSkillEvidence(currentViewingSkillId);
                
                // Reload skills table to update count
                if (selectedStudentId) {
                    await renderStudentSkillsFromDB(selectedStudentId);
                }
            } else {
                grid.classList.remove('hidden');
                customAlert(result.message || "خطأ في إضافة الشاهد", { icon: '❌', title: 'خطأ' });
            }
        };
        reader.onerror = function() {
            loading.classList.add('hidden');
            grid.classList.remove('hidden');
            customAlert("خطأ في قراءة الملف", { icon: '❌', title: 'خطأ' });
        };
        reader.readAsDataURL(file);
    };
    
    fileInput.click();
}

function viewEvidence(evidenceUrl) {
    // Deprecated: Keep for backward compatibility with old data
    openImageInFullScreen(evidenceUrl);
}

function closeEvidenceViewer() {
    const modal = document.getElementById('evidenceViewerModal');
    modal.classList.add('hidden');
    currentViewingSkillId = null;
}

async function deleteSkill(skillId, skillName) {
    if (!isAdmin) return;

    customConfirm("هل أنت متأكد من حذف المهارة؟", async () => {
        const tbody = document.getElementById('skillsTableBody');
        tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center"><div class="animate-spin rounded-full h-8 w-8 border-b-4 border-indigo-600 mx-auto mb-2"></div><p class="text-slate-600">جاري حذف المهارة...</p></td></tr>';

        const result = await adminAPI.deleteSkill(skillId);

        if (result.success) {
            // Update skill template usage count if skill has a template
            if (skillName) {
                try {
                    const templatesMap = await getSkillTemplatesMap();
                    const template = Object.values(templatesMap).find(t => t.name === skillName);
                    if (template) {
                        await fetch(`/api/skill-templates/${template.id}/decrement-usage`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                            }
                        });
                    }
                } catch (e) {
                    console.error('Error updating skill template usage count:', e);
                }
            }
            
            // Invalidate caches when data changes
            invalidateAllCaches();
            
            // Force refresh by re-rendering immediately
            await renderStudentSkillsFromDB(selectedStudentId);
            
            // Reload available skills for this student
            await loadSkillsForStudent(selectedStudentId);
            
            // Update other UI elements in background
            if (typeof loadSkillTemplates === 'function') {
                loadSkillTemplates();
            }
            if (typeof updateStatisticsOptimized === 'function') {
                updateStatisticsOptimized();
            }
            if (typeof loadRecentActivityOptimized === 'function') {
                loadRecentActivityOptimized();
            }
            
            showToast("تم حذف المهارة بنجاح", { 
                title: 'تم الحذف',
                type: 'success'
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
    // This function is deprecated - kept for backward compatibility
    // New system uses loadSkillsForStudent and addSkillToStudent
    const drop = document.getElementById('skillDropdown');
    if (!drop) return; // New UI doesn't have dropdown
    
    let skillName = drop.value === 'custom' ? document.getElementById('manualSkillInput').value.trim() : drop.value;
    const url = document.getElementById('newFileLink').value.trim();

    if (!skillName || !url) {
        customAlert("يرجى إكمال جميع البيانات المطلوبة", { icon: '⚠️', title: 'بيانات ناقصة' });
        return;
    }

    const button = event?.target || document.querySelector('button[onclick="saveNewSkill()"]');
    if (button) setButtonLoading(button, true);
    const tbody = document.getElementById('skillsTableBody');
    tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center"><div class="animate-spin rounded-full h-8 w-8 border-b-4 border-indigo-600 mx-auto mb-2"></div><p class="text-slate-600">جاري إضافة المهارة...</p></td></tr>';

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

        // Invalidate caches when data changes
        invalidateAllCaches();
        
        // Reload skill templates to update usage counts
        if (typeof loadSkillTemplates === 'function') {
            await loadSkillTemplates();
        }
        
        // Update statistics - WAIT for completion
        if (typeof updateStatisticsOptimized === 'function') {
            await updateStatisticsOptimized();
        }
        // Note: No need to reload activities - new skills start incomplete (level 1)
        
        showToast("تم إضافة المهارة بنجاح", { 
            title: 'نجحت العملية',
            type: 'success'
        });
        
        await renderStudentSkillsFromDB(selectedStudentId);
    } else {
        customAlert("خطأ في إضافة المهارة: " + (result.message || ''), { 
            icon: '❌', 
            title: 'خطأ',
            onClose: () => renderStudentSkillsFromDB(selectedStudentId)
        });
    }
}

// New skill management functions
let availableSkillsCache = [];
// Make studentSkillsCache global so it can be invalidated
window.studentSkillsCache = window.studentSkillsCache || [];
let selectedSkillsToAdd = new Set(); // Track selected skills for batch add

async function loadSkillsForStudent(studentId) {
    if (!studentId || !isAdmin) return;
    
    // Clear any previous selections
    selectedSkillsToAdd.clear();
    if (window.selectedSkillsData) {
        window.selectedSkillsData.clear();
    }
    
    try {
        // Use cached skill templates if available
        if (isCacheValid(skillTemplatesCache) && skillTemplatesCache.data.length > 0) {
            availableSkillsCache = skillTemplatesCache.data;
        } else {
            // Load fresh data if cache is invalid
            const templatesResponse = await fetch('/api/skill-templates?is_active=true', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                }
            });
            
            if (templatesResponse.ok) {
                const templatesData = await templatesResponse.json();
                availableSkillsCache = templatesData.templates || [];
                
                // Update global cache
                skillTemplatesCache.data = availableSkillsCache;
                skillTemplatesCache.timestamp = Date.now();
            }
        }
        
        // Load student's current skills (bypass cache to get fresh data)
        const skillsResult = await adminAPI.getStudentSkills(studentId, true);
        if (skillsResult.success) {
            window.studentSkillsCache = skillsResult.data.skills || [];
        }
        
        // Render available skills grid
        renderAvailableSkills();
    } catch (error) {
        console.error('Error loading skills for student:', error);
    }
}

function renderAvailableSkills() {
    const container = document.getElementById('availableSkillsGrid');
    if (!container) return;
    
    const searchTerm = document.getElementById('skillSearchInput')?.value.toLowerCase() || '';
    
    // Filter out skills the student already has
    const studentSkillNames = (window.studentSkillsCache || []).map(s => s.name);
    const availableSkills = availableSkillsCache.filter(template => 
        !studentSkillNames.includes(template.name) &&
        (searchTerm === '' || template.name.toLowerCase().includes(searchTerm))
    );
    
    if (availableSkills.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-8 text-slate-400">
                <p class="text-sm">${searchTerm ? 'لم يتم العثور على مهارات' : 'جميع المهارات مضافة للطالب'}</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = availableSkills.map(template => {
        const isSelected = selectedSkillsToAdd.has(template.id);
        return `
        <label class="relative bg-white border-2 ${isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'} hover:border-indigo-400 rounded-lg p-3 text-center transition cursor-pointer group">
            <input type="checkbox" 
                class="absolute top-2 right-2 w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                ${isSelected ? 'checked' : ''}
                onchange="toggleSkillSelection('${template.id}', '${template.name.replace(/'/g, "\\'")}', '${(template.url || '').replace(/'/g, "\\'")}')">
            <div class="text-3xl mb-1 mt-4">${template.icon || '📚'}</div>
            <div class="text-xs font-medium text-slate-700 group-hover:text-indigo-600 line-clamp-2">${template.name}</div>
            ${template.category ? `` : ''}
        </label>
    `;
    }).join('');
    
    // Update button state
    updateAddButtonState();
}

function filterAvailableSkills() {
    renderAvailableSkills();
}

function toggleSkillSelection(templateId, skillName, skillUrl) {
    const skillData = { id: templateId, name: skillName, url: skillUrl };
    
    if (selectedSkillsToAdd.has(templateId)) {
        selectedSkillsToAdd.delete(templateId);
    } else {
        selectedSkillsToAdd.add(templateId);
    }
    
    // Store full skill data for later use
    if (!window.selectedSkillsData) {
        window.selectedSkillsData = new Map();
    }
    
    if (selectedSkillsToAdd.has(templateId)) {
        window.selectedSkillsData.set(templateId, skillData);
    } else {
        window.selectedSkillsData.delete(templateId);
    }
    
    renderAvailableSkills();
}

function updateAddButtonState() {
    const button = document.getElementById('addSelectedSkillsBtn');
    if (!button) return;
    
    const count = selectedSkillsToAdd.size;
    
    if (count === 0) {
        button.disabled = true;
        button.className = 'w-full bg-slate-300 text-slate-500 py-3 rounded-lg font-medium cursor-not-allowed';
        button.textContent = 'اختر مهارة أو أكثر';
    } else {
        button.disabled = false;
        button.className = 'w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 font-medium transition';
        button.textContent = `إضافة ${count} ${count === 1 ? 'مهارة' : 'مهارات'}`;
    }
}

async function addSelectedSkillsToStudent() {
    if (!selectedStudentId || selectedSkillsToAdd.size === 0) return;
    
    const button = document.getElementById('addSelectedSkillsBtn');
    if (button) setButtonLoading(button, true);
    
    let successCount = 0;
    let failCount = 0;
    let templatesNeedReload = false;
    
    for (const templateId of selectedSkillsToAdd) {
        const skillData = window.selectedSkillsData?.get(templateId);
        if (!skillData) continue;
        
        const result = await adminAPI.addSkill(
            selectedStudentId,
            skillData.name,
            1,
            skillData.url,
            null,
            null
        );
        
        if (result.success) {
            successCount++;
            templatesNeedReload = true;
            // Update usage count
            try {
                await fetch(`/api/skill-templates/${templateId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                    },
                    body: JSON.stringify({ 
                        name: skillData.name,
                        url: skillData.url,
                        is_active: true
                    })
                });
            } catch (e) {
                console.error('Error updating usage count:', e);
            }
        } else {
            failCount++;
        }
    }
    
    if (button) setButtonLoading(button, false);
    
    // Clear selection
    selectedSkillsToAdd.clear();
    if (window.selectedSkillsData) {
        window.selectedSkillsData.clear();
    }
    
    // Invalidate caches when data changes
    invalidateAllCaches();
    
    // Force refresh by reloading data immediately
    await renderStudentSkillsFromDB(selectedStudentId);
    await loadSkillsForStudent(selectedStudentId);
    
    // Update other UI elements in background
    if (templatesNeedReload && typeof loadSkillTemplates === 'function') {
        loadSkillTemplates();
    }
    if (successCount > 0) {
        if (typeof updateStatisticsOptimized === 'function') {
            updateStatisticsOptimized();
        }
        // Note: No need to reload activities - new skills start incomplete (level 1)
    }
    
    const message = successCount > 0 
        ? `تمت إضافة ${successCount} ${successCount === 1 ? 'مهارة' : 'مهارات'} بنجاح` +
          (failCount > 0 ? `\nفشل إضافة ${failCount}` : '')
        : 'فشلت جميع المحاولات';
    
    showToast(message, { 
        title: failCount === 0 ? 'تمت الإضافة' : 'إضافة جزئية',
        type: failCount > 0 ? 'warning' : 'success'
    });
}

async function addSkillToStudent(templateId, skillName, skillUrl) {
    if (!selectedStudentId) return;
    
    const result = await adminAPI.addSkill(
        selectedStudentId,
        skillName,
        1,
        skillUrl,
        null,
        null
    );
    
    if (result.success) {
        // Update usage count
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
        
        // Update statistics - WAIT for completion
        if (typeof updateStatisticsOptimized === 'function') {
            await updateStatisticsOptimized();
        }
        // Note: No need to reload activities - new skills start incomplete (level 1)
        
        // Reload both student skills and available skills
        await Promise.all([
            renderStudentSkillsFromDB(selectedStudentId),
            loadSkillsForStudent(selectedStudentId)
        ]);
        
        showToast(`تمت إضافة: ${skillName}`, { 
            title: 'تمت الإضافة',
            type: 'success'
        });
    } else {
        customAlert(result.message || "خطأ في إضافة المهارة", { 
            icon: '❌', 
            title: 'خطأ'
        });
    }
}

async function addSkillToDropdown(skillName, url) {
    const dropdown = document.getElementById('skillDropdown');
    if (!dropdown) return; // New UI doesn't have dropdown

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
        await deleteCustomSkillFromDatabase(skillName);

        // Clear cache and reload
        customSkillsCache = null;
        await reloadSkillsDropdown();
        
        // Refresh skill templates list if available
        if (typeof loadSkillTemplates === 'function') {
            await loadSkillTemplates();
        }
        
        showToast("تم حذف المهارة من القائمة", { title: 'تم الحذف', type: 'success' });
    }, {
        icon: '🗑️',
        title: 'تأكيد الحذف',
        confirmText: 'حذف',
        cancelText: 'إلغاء'
    });
}

async function reloadSkillsDropdown() {
    const dropdown = document.getElementById('skillDropdown');
    if (!dropdown) return;

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
    if (!dropdown) return; // Dropdown doesn't exist in new UI
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
        // Use new skill templates API with legacy endpoint for backward compatibility
        const response = await fetch('/api/skill-templates/custom-skills', {
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
        const response = await fetch('/api/skill-templates', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
            },
            body: JSON.stringify({ 
                name, 
                url, 
                description: '', 
                category: '', 
                icon: '📚',
                color: 'indigo'
            })
        });
        if (response.ok) {
            customSkillsCache = null; // Clear cache
            await reloadSkillsDropdown();
            
            // Refresh skill templates list if available
            if (typeof loadSkillTemplates === 'function') {
                await loadSkillTemplates();
            }
        }
    } catch (error) {
        console.error('خطأ في حفظ المهارة:', error);
    }
}

async function deleteCustomSkillFromDatabase(name) {
    try {
        // Find the template by name first
        const templatesResponse = await fetch('/api/skill-templates?is_active=true', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
            }
        });
        
        if (templatesResponse.ok) {
            const templatesData = await templatesResponse.json();
            const template = templatesData.templates?.find(t => t.name === name);
            
            if (template) {
                const response = await fetch(`/api/skill-templates/${template.id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                    }
                });
                return response.ok;
            }
        }
        return false;
    } catch (error) {
        console.error('خطأ في حذف المهارة:', error);
        return false;
    }
}

function backToHome() {
    // Clear saved skills view state
    sessionStorage.removeItem('skillsView_studentId');
    sessionStorage.removeItem('skillsView_studentData');
    
    document.getElementById('skillsDetailView').classList.add('hidden');
    
    if (isAdmin) {
        document.getElementById('adminDashboardView').classList.remove('hidden');
        // Refetch data when going back to ensure fresh data
        renderAdminStudents();
    } else {
        document.getElementById('studentView').classList.remove('hidden');
        // Refetch student data for updated info
        if (selectedStudentId) {
            loadSimpleStudentView(selectedStudentId);
        }
    }
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

        let deleteBtn = isAdmin ? `<td class="p-2 sm:p-4 text-center"><button onclick="deleteSkill('${skill.id}', '${skillName.replace(/'/g, "\\'")}')" class="text-red-500 hover:text-red-700 text-xl sm:text-2xl">🗑️</button></td>` : '';

        row.innerHTML = `
            <td class="p-2 sm:p-4 text-slate-700 text-xs sm:text-base">${skillName}</td>
            <td class="p-2 sm:p-4 text-center">
                <a href="${skillUrl}" target="_blank" class="text-xl sm:text-2xl hover:scale-110 transition-transform inline-block" title="فتح الملف">
                    📂
                </a>
            </td>
            <td class="p-2 sm:p-4 text-center">
                <button onclick="toggleSkill('${skill.id}', ${skill.level})" class="${statusColor} font-bold px-2 sm:px-3 py-1 hover:opacity-80 text-xs sm:text-sm">
                    ${statusText}
                </button>
            </td>
            ${deleteBtn}
        `;
        tbody.appendChild(row);
    });
}
