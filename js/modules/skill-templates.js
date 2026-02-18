// Skill Templates Management Module

let localSkillTemplatesCache = [];
let currentEditingTemplateId = null;
let currentDetailsTemplateId = null;

// Load skill templates
async function loadSkillTemplates() {
    try {
        const search = document.getElementById('skillTemplateSearch')?.value || '';
        
        let url = '/api/skill-templates?is_active=true';
        if (search) url += `&search=${encodeURIComponent(search)}`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load skill templates');
        
        const data = await response.json();
        if (data.success) {
            localSkillTemplatesCache = data.templates || [];
            renderSkillTemplates(localSkillTemplatesCache);
        }
    } catch (error) {
        console.error('Error loading skill templates:', error);
        customAlert("خطأ في تحميل المهارات", { icon: '❌', title: 'خطأ' });
    }
}

// Render skill templates
function renderSkillTemplates(templates) {
    const container = document.getElementById('skillTemplatesList');
    if (!container) return;
    
    if (!templates || templates.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12 text-slate-400">
                <div class="text-5xl mb-3">📚</div>
                <p>لا توجد مهارات</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = templates.map(template => `
        <div class="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition group">
            <div class="flex items-start justify-between mb-2">
                <div class="flex items-center gap-2 flex-1">
                    <span class="flex-shrink-0">${getSkillLinkIcon(template.icon || 'file')}</span>
                    <div class="flex-1 min-w-0">
                        <h4 class="font-semibold text-slate-800 break-words line-clamp-2" title="${template.name}">${template.name}</h4>
                        ${template.description ? `<p class="text-xs text-slate-500 line-clamp-1">${template.description}</p>` : ''}
                    </div>
                </div>
            </div>
            
            <div class="flex items-center gap-2 mb-3 text-xs text-slate-600">
                <span class="flex items-center gap-1">
                    <span class="text-lg">👥</span>
                    ${template.usage_count || 0} طالب
                </span>
            </div>
            
            <div class="flex gap-1">
                <button onclick="viewSkillTemplateDetails('${template.id}')" 
                    class="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded text-xs font-medium transition">
                    👁️ عرض
                </button>
                <button onclick="editSkillTemplate('${template.id}')" 
                    class="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-2 rounded text-xs font-medium transition">
                    ✏️ تعديل
                </button>
                <button onclick="deleteSkillTemplate('${template.id}')" 
                    class="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-2 rounded text-xs font-medium transition">
                    🗑️
                </button>
            </div>
        </div>
    `).join('');
}

// Search skill templates
function searchSkillTemplates() {
    loadSkillTemplates();
}

// Filter skill templates
function filterSkillTemplates() {
    loadSkillTemplates();
}

// Show add skill template modal
function showAddSkillTemplateModal() {
    const modal = document.getElementById('addSkillTemplateModal');
    
    // Clear form
    document.getElementById('newTemplateName').value = '';
    document.getElementById('newTemplateDescription').value = '';
    document.getElementById('newTemplateUrl').value = '';
    document.getElementById('newTemplateIcon').value = 'file';
    updateIconPreview('newTemplateIcon', 'newTemplateIconPreview');
    
    modal.classList.remove('hidden');
    document.getElementById('newTemplateName').focus();
    
    modal.onclick = function(e) {
        if (e.target === modal) {
            closeAddSkillTemplateModal();
        }
    };
}

// Close add skill template modal
function closeAddSkillTemplateModal() {
    document.getElementById('addSkillTemplateModal').classList.add('hidden');
}

// Save new skill template
async function saveNewSkillTemplate() {
    const name = document.getElementById('newTemplateName').value.trim();
    const description = document.getElementById('newTemplateDescription').value.trim();
    const url = document.getElementById('newTemplateUrl').value.trim();
    const icon = document.getElementById('newTemplateIcon').value;
    
    if (!name) {
        customAlert("يرجى إدخال اسم المهارة", { icon: '⚠️', title: 'بيانات ناقصة' });
        return;
    }
    
    const button = event?.target;
    if (button) setButtonLoading(button, true);
    
    try {
        const response = await fetch('/api/skill-templates', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
            },
            body: JSON.stringify({ name, description, url, icon, color: 'indigo' })
        });
        
        const data = await response.json();
        
        if (button) setButtonLoading(button, false);
        
        if (data.success) {
            closeAddSkillTemplateModal();
            
            // Invalidate all caches when data changes
            invalidateAllCaches();
            customSkillsCache = null;
            
            // Refresh all caches and lists
            await loadSkillTemplates();
            if (typeof reloadSkillsDropdown === 'function') {
                await reloadSkillsDropdown();
            }
            if (typeof loadSkillsForStudent === 'function') {
                await loadSkillsForStudent(selectedStudentId);
            }
            
            showToast("تم إضافة المهارة بنجاح", { 
                title: 'نجحت العملية',
                type: 'success'
            });
        } else {
            customAlert(data.message || "خطأ في إضافة المهارة", { icon: '❌', title: 'خطأ' });
        }
    } catch (error) {
        if (button) setButtonLoading(button, false);
        console.error('Error adding skill template:', error);
        customAlert("خطأ في إضافة المهارة", { icon: '❌', title: 'خطأ' });
    }
}

// Edit skill template
function editSkillTemplate(templateId) {
    const template = localSkillTemplatesCache.find(t => t.id === templateId);
    if (!template) {
        customAlert("المهارة غير موجودة", { icon: '❌', title: 'خطأ' });
        return;
    }
    
    currentEditingTemplateId = templateId;
    const modal = document.getElementById('editSkillTemplateModal');
    
    document.getElementById('editTemplateName').value = template.name;
    document.getElementById('editTemplateDescription').value = template.description || '';
    document.getElementById('editTemplateUrl').value = template.url || '';
    document.getElementById('editTemplateIcon').value = template.icon || 'file';
    updateIconPreview('editTemplateIcon', 'editTemplateIconPreview');
    
    modal.classList.remove('hidden');
    document.getElementById('editTemplateName').focus();
    
    modal.onclick = function(e) {
        if (e.target === modal) {
            closeEditSkillTemplateModal();
        }
    };
}

// Close edit skill template modal
function closeEditSkillTemplateModal() {
    document.getElementById('editSkillTemplateModal').classList.add('hidden');
    currentEditingTemplateId = null;
}

// Save edit skill template
async function saveEditSkillTemplate() {
    if (!currentEditingTemplateId) return;
    
    const name = document.getElementById('editTemplateName').value.trim();
    const description = document.getElementById('editTemplateDescription').value.trim();
    const url = document.getElementById('editTemplateUrl').value.trim();
    const icon = document.getElementById('editTemplateIcon').value;
    
    if (!name) {
        customAlert("يرجى إدخال اسم المهارة", { icon: '⚠️', title: 'بيانات ناقصة' });
        return;
    }
    
    const button = event?.target;
    if (button) setButtonLoading(button, true);
    
    try {
        const response = await fetch(`/api/skill-templates/${currentEditingTemplateId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
            },
            body: JSON.stringify({ name, description, url, icon, color: 'indigo', is_active: true })
        });
        
        const data = await response.json();
        
        if (button) setButtonLoading(button, false);
        
        if (data.success) {
            closeEditSkillTemplateModal();
            
            // Invalidate all caches when data changes
            invalidateAllCaches();
            customSkillsCache = null;
            
            // Refresh all caches and lists
            await loadSkillTemplates();
            if (typeof reloadSkillsDropdown === 'function') {
                await reloadSkillsDropdown();
            }
            if (typeof loadSkillsForStudent === 'function') {
                await loadSkillsForStudent(selectedStudentId);
            }
            
            showToast("تم تحديث المهارة بنجاح", { 
                title: 'نجحت العملية',
                type: 'success'
            });
        } else {
            customAlert(data.message || "خطأ في تحديث المهارة", { icon: '❌', title: 'خطأ' });
        }
    } catch (error) {
        if (button) setButtonLoading(button, false);
        console.error('Error updating skill template:', error);
        customAlert("خطأ في تحديث المهارة", { icon: '❌', title: 'خطأ' });
    }
}

// Delete skill template
function deleteSkillTemplate(templateId) {
    const template = localSkillTemplatesCache.find(t => t.id === templateId);
    if (!template) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.innerHTML = `
        <p class="mb-2">هل تريد حذف المهارة: <strong>${template.name}</strong>؟</p>
        <p class="text-sm text-slate-600">ملاحظة: سيتم حذف المهارة من القائمة ولن تظهر في الاختيارات الجديدة، ولكن ستبقى لدى الطلاب الذين لديهم هذه المهارة.</p>
    `;
    
    customConfirm(
        messageDiv,
        async (deleteFromStudents) => {
            try {
                const url = `/api/skill-templates/${templateId}${deleteFromStudents ? '?delete_from_students=true' : ''}`;
                const response = await fetch(url, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                    }
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // Invalidate all caches when data changes
                    invalidateAllCaches();
                    customSkillsCache = null;
                    
                    // Update statistics and activities if skills were deleted from students - WAIT for completion
                    if (deleteFromStudents) {
                        if (typeof updateStatisticsOptimized === 'function') {
                            await updateStatisticsOptimized();
                        }
                        if (typeof loadRecentActivityOptimized === 'function') {
                            await loadRecentActivityOptimized();
                        }
                    }
                    
                    showToast(data.message || "تم حذف المهارة بنجاح", { 
                        title: 'تم الحذف',
                        type: 'success'
                    });
                    await loadSkillTemplates();
                } else {
                    customAlert(data.message || "خطأ في حذف المهارة", { icon: '❌', title: 'خطأ' });
                }
            } catch (error) {
                console.error('Error deleting skill template:', error);
                customAlert("خطأ في حذف المهارة", { icon: '❌', title: 'خطأ' });
            }
        },
        {
            icon: '🗑️',
            title: 'تأكيد الحذف',
            confirmText: 'حذف',
            cancelText: 'إلغاء',
            checkbox: {
                label: 'حذف المهارة من جميع الطلاب الذين لديهم هذه المهارة'
            }
        }
    );
}

// View skill template details
async function viewSkillTemplateDetails(templateId) {
    const template = localSkillTemplatesCache.find(t => t.id === templateId);
    if (!template) return;
    
    currentDetailsTemplateId = templateId;
    const modal = document.getElementById('skillTemplateDetailsModal');
    
    document.getElementById('detailsTemplateName').textContent = `${template.icon} ${template.name}`;
    document.getElementById('detailsTemplateDescription').textContent = template.description || 'لا يوجد وصف';
    document.getElementById('detailsTemplateUsage').textContent = `${template.usage_count || 0} طالب`;
    
    const studentsList = document.getElementById('detailsStudentsList');
    studentsList.innerHTML = '<div class="text-center text-slate-400 py-4">جاري التحميل...</div>';
    
    modal.classList.remove('hidden');
    
    // Load students who have this skill
    try {
        const response = await fetch(`/api/skill-templates/${templateId}/students`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
            }
        });
        
        const data = await response.json();
        
        if (data.success && data.students && data.students.length > 0) {
            studentsList.innerHTML = data.students.map(student => `
                <div class="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                    <div class="flex-1">
                        <div class="font-medium text-sm">${student.name}</div>
                        <div class="text-xs text-slate-500">رقم: ${student.code}</div>
                    </div>
                    <div class="text-xs ${student.completed ? 'text-green-600' : 'text-red-500'}">
                        ${student.completed ? '✅ مكتملة' : '❌ غير مكتملة'}
                    </div>
                </div>
            `).join('');
        } else {
            studentsList.innerHTML = '<div class="text-center text-slate-400 py-4">لم يتم تعيين هذه المهارة لأي طالب بعد</div>';
        }
    } catch (error) {
        console.error('Error loading students:', error);
        studentsList.innerHTML = '<div class="text-center text-red-400 py-4">خطأ في تحميل البيانات</div>';
    }
    
    modal.onclick = function(e) {
        if (e.target === modal) {
            closeSkillTemplateDetailsModal();
        }
    };
}

// Close skill template details modal
function closeSkillTemplateDetailsModal() {
    const modal = document.getElementById('skillTemplateDetailsModal');
    modal.classList.add('hidden');
    modal.onclick = null; // Remove click handler to prevent conflicts
    currentDetailsTemplateId = null;
}

// Show bulk assign from details
async function showBulkAssignFromDetails() {
    try {
        if (!currentDetailsTemplateId) {
            console.error('No template ID selected');
            return;
        }
        
        // Find the template
        const template = localSkillTemplatesCache.find(t => t.id === currentDetailsTemplateId);
        if (!template) {
            console.error('Template not found:', currentDetailsTemplateId);
            return;
        }
        
        // Close details modal first
        closeSkillTemplateDetailsModal();
        
        // Wait a moment for the modal to close
        await new Promise(resolve => setTimeout(resolve, 150));
        
        // Open batch skill modal with pre-selected template
        await showBatchSkillModal(template);
    } catch (error) {
        console.error('Error in showBulkAssignFromDetails:', error);
        customAlert('حدث خطأ أثناء فتح نافذة الإضافة', { icon: '❌', title: 'خطأ' });
    }
}

// Initialize skill templates management
async function initSkillTemplatesManagement() {
    if (!isAdmin) return;
    await loadSkillTemplates();
}
