// Skill Templates Management Module

let localSkillTemplatesCache = [];
let currentEditingTemplateId = null;
let currentDetailsTemplateId = null;

const SKILLS_PER_PAGE = 9;
let currentSkillPage = 1;

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
            currentSkillPage = 1;  // reset to first page whenever data reloads
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
    const paginationContainer = document.getElementById('skillTemplatesPagination');
    const countDisplay = document.getElementById('skillTemplatesCountDisplay');
    if (!container) return;

    const total = localSkillTemplatesCache.length;
    const filtered = templates ? templates.length : 0;
    const totalPages = Math.ceil(filtered / SKILLS_PER_PAGE);

    // Clamp page in case filtered results shrank
    if (currentSkillPage > totalPages && totalPages > 0) currentSkillPage = totalPages;

    // Update count display
    if (countDisplay) {
        const pageInfo = totalPages > 1 ? ` — صفحة ${currentSkillPage} من ${totalPages}` : '';
        if (filtered < total) {
            countDisplay.textContent = `عرض ${filtered} من ${total} مهارة${pageInfo}`;
        } else {
            countDisplay.textContent = `إجمالي: ${total} مهارة${pageInfo}`;
        }
    }

    if (!templates || templates.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12 text-slate-400">
                <div class="text-5xl mb-3">📚</div>
                <p>لا توجد مهارات</p>
            </div>
        `;
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    // Slice current page
    const startIndex = (currentSkillPage - 1) * SKILLS_PER_PAGE;
    const pageTemplates = templates.slice(startIndex, startIndex + SKILLS_PER_PAGE);

    container.innerHTML = pageTemplates.map(template => `
        <div class="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition group" data-template-id="${template.id}">
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
                <button onclick="openTestQuestionsModal('${template.id}', '${template.name.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')"
                    class="flex-1 bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-2 rounded text-xs font-medium transition">
                    📝 الاختبار
                </button>
                <button onclick="deleteSkillTemplate('${template.id}')" 
                    class="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-2 rounded text-xs font-medium transition">
                    🗑️
                </button>
            </div>
        </div>
    `).join('');

    // Pagination
    if (!paginationContainer) return;
    paginationContainer.innerHTML = '';
    if (totalPages <= 1) return;

    const paginationDiv = document.createElement('div');
    paginationDiv.className = 'flex items-center justify-center gap-1 mt-4 flex-wrap';

    // Prev button
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '→';
    prevBtn.className = `px-3 py-1.5 rounded-lg text-sm font-medium transition ${currentSkillPage === 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100'}`;
    prevBtn.disabled = currentSkillPage === 1;
    prevBtn.onclick = () => { currentSkillPage--; renderSkillTemplates(templates); };
    paginationDiv.appendChild(prevBtn);

    let startPage = Math.max(1, currentSkillPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);

    if (startPage > 1) {
        const firstBtn = document.createElement('button');
        firstBtn.textContent = '1';
        firstBtn.className = 'px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition';
        firstBtn.onclick = () => { currentSkillPage = 1; renderSkillTemplates(templates); };
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
        const isActive = i === currentSkillPage;
        pageBtn.className = `px-3 py-1.5 rounded-lg text-sm font-medium transition ${isActive ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`;
        if (!isActive) {
            const pageNum = i;
            pageBtn.onclick = () => { currentSkillPage = pageNum; renderSkillTemplates(templates); };
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
        lastBtn.onclick = () => { currentSkillPage = totalPages; renderSkillTemplates(templates); };
        paginationDiv.appendChild(lastBtn);
    }

    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.textContent = '←';
    nextBtn.className = `px-3 py-1.5 rounded-lg text-sm font-medium transition ${currentSkillPage === totalPages ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100'}`;
    nextBtn.disabled = currentSkillPage === totalPages;
    nextBtn.onclick = () => { currentSkillPage++; renderSkillTemplates(templates); };
    paginationDiv.appendChild(nextBtn);

    paginationContainer.appendChild(paginationDiv);
}

// Search skill templates
function searchSkillTemplates() {
    loadSkillTemplates();
}

// Filter skill templates
function filterSkillTemplates() {
    loadSkillTemplates();
}

// Scroll to and highlight a skill template card by name (called from activity feed)
function scrollToSkillTemplate(skillName) {
    // Make sure the admin home view is visible (not skills detail view)
    const detailView = document.getElementById('skillsDetailView');
    const dashboardView = document.getElementById('adminDashboardView');
    if (detailView && !detailView.classList.contains('hidden')) {
        detailView.classList.add('hidden');
        if (dashboardView) dashboardView.classList.remove('hidden');
    }

    // Find the template in the cache by name (case-insensitive)
    const idx = localSkillTemplatesCache.findIndex(
        t => t.name.trim().toLowerCase() === skillName.trim().toLowerCase()
    );
    if (idx === -1) return; // template not found

    const templateId = localSkillTemplatesCache[idx].id;

    // Calculate the page it lives on
    const targetPage = Math.floor(idx / SKILLS_PER_PAGE) + 1;
    if (currentSkillPage !== targetPage) {
        currentSkillPage = targetPage;
        renderSkillTemplates(localSkillTemplatesCache);
    }

    // Scroll the section into view, then highlight the card
    const section = document.getElementById('skillTemplatesList');
    if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Wait a tick for DOM to settle after any re-render
    setTimeout(() => {
        const card = document.querySelector(`[data-template-id="${templateId}"]`);
        if (!card) return;
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('skill-highlight-glow');
        setTimeout(() => card.classList.remove('skill-highlight-glow'), 2500);
    }, 80);
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
    
    document.getElementById('detailsTemplateName').innerHTML = `${getSkillLinkIcon(template.icon || 'file')} ${template.name}`;
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

// ─── Test Questions Modal ─────────────────────────────────────────────────────

let _testQuestionsTemplateId = null;
let _testQuestionsTemplateName = null;
let _testQuestionsList = [];
let _editingQuestionId = null;
let _newQuestionCounter = 0;

async function openTestQuestionsModal(templateId, templateName) {
    _testQuestionsTemplateId = templateId;
    _testQuestionsTemplateName = templateName;
    _editingQuestionId = null;
    _newQuestionCounter = 0;

    const modal = document.getElementById('testQuestionsModal');
    if (!modal) return;

    document.getElementById('testQuestionsModalTitle').textContent = `أسئلة اختبار: ${templateName}`;
    // Reset stale display before async load
    const countInfoEl = document.getElementById('testQuestionsCount');
    if (countInfoEl) countInfoEl.textContent = '0 / 5 أسئلة';
    const listEl = document.getElementById('testQuestionsList');
    if (listEl) listEl.innerHTML = '';
    document.getElementById('testQuestionsLoading').classList.remove('hidden');
    document.getElementById('testQuestionsContent').classList.add('hidden');
    modal.classList.remove('hidden');

    const questionsResult = await adminAPI.getTestQuestions(templateId);

    document.getElementById('testQuestionsLoading').classList.add('hidden');
    document.getElementById('testQuestionsContent').classList.remove('hidden');

    // Set max attempts from local cache
    const cachedTemplate = (localSkillTemplatesCache || []).find(t => t.id === templateId);
    document.getElementById('testMaxAttempts').value = cachedTemplate?.max_test_attempts ?? 3;

    _testQuestionsList = questionsResult.success ? questionsResult.questions : [];
    resetTestQuestionForm();
    renderTestQuestions();
}

function closeTestQuestionsModal() {
    const modal = document.getElementById('testQuestionsModal');
    if (modal) modal.classList.add('hidden');
    _testQuestionsTemplateId = null;
    _testQuestionsTemplateName = null;
    _testQuestionsList = [];
    _editingQuestionId = null;
    _newQuestionCounter = 0;
    resetTestQuestionForm();
}

function renderTestQuestions() {
    const container = document.getElementById('testQuestionsList');
    if (!container) return;

    if (_testQuestionsList.length === 0) {
        container.innerHTML = '<p class="text-center text-slate-400 py-4 text-sm">لا توجد أسئلة بعد. أضف أول سؤال أدناه.</p>';
    } else {
        container.innerHTML = _testQuestionsList.map((q, i) => `
            <div class="flex items-start gap-2 p-3 rounded-lg border ${q._isNew ? 'bg-blue-50 border-blue-200' : q._isDirty ? 'bg-yellow-50 border-yellow-200' : 'bg-slate-50 border-slate-200'}">
                <span class="text-slate-500 text-sm font-bold mt-1">${i + 1}.</span>
                <div class="flex-1 min-w-0">
                    <p class="text-sm text-slate-800 break-words">${_escHtml(q.question)}</p>
                    <div class="flex items-center gap-2 mt-1 flex-wrap">
                        <span class="text-xs px-2 py-0.5 rounded-full font-medium ${q.correct_answer ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                            الإجابة: ${q.correct_answer ? '✅ صح' : '❌ خطأ'}
                        </span>
                        ${q._isNew ? '<span class="text-xs text-blue-600 font-medium">• جديد</span>' : ''}
                    </div>
                </div>
                <div class="flex gap-1 flex-shrink-0">
                    <button onclick="editTestQuestion('${q.id}')" class="text-blue-600 hover:text-blue-800 text-sm p-1" title="تعديل">✏️</button>
                    <button onclick="deleteTestQuestion('${q.id}')" class="text-red-500 hover:text-red-700 text-sm p-1" title="حذف">🗑️</button>
                </div>
            </div>
        `).join('');
    }

    const addBtn = document.getElementById('saveTestQuestionBtn');
    const countInfo = document.getElementById('testQuestionsCount');
    if (countInfo) countInfo.textContent = `${_testQuestionsList.length} / 5 أسئلة`;

    if (addBtn) {
        // When editing, always enable (button becomes "save edit"); when adding, disable at max 5
        const atMax = !_editingQuestionId && _testQuestionsList.length >= 5;
        addBtn.disabled = atMax;
        addBtn.classList.toggle('opacity-50', atMax);
        addBtn.classList.toggle('cursor-not-allowed', atMax);
    }
}

function editTestQuestion(questionId) {
    const q = _testQuestionsList.find(q => q.id === questionId);
    if (!q) return;
    _editingQuestionId = questionId;
    document.getElementById('testQuestionInput').value = q.question;
    document.getElementById('testQuestionAnswer').value = q.correct_answer ? 'true' : 'false';

    const saveBtn = document.getElementById('saveTestQuestionBtn');
    if (saveBtn) {
        saveBtn.textContent = '💾 حفظ التعديل';
        saveBtn.disabled = false;
        saveBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
    document.getElementById('cancelEditQuestionBtn').classList.remove('hidden');
    document.getElementById('testQuestionInput').focus();
}

function cancelEditQuestion() {
    _editingQuestionId = null;
    resetTestQuestionForm();
    renderTestQuestions();
}

function resetTestQuestionForm() {
    const input = document.getElementById('testQuestionInput');
    const answer = document.getElementById('testQuestionAnswer');
    const saveBtn = document.getElementById('saveTestQuestionBtn');
    const cancelBtn = document.getElementById('cancelEditQuestionBtn');
    if (input) input.value = '';
    if (answer) answer.value = 'true';
    if (saveBtn) {
        saveBtn.textContent = '➕ إضافة سؤال';
        saveBtn.disabled = false;
        saveBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
    if (cancelBtn) cancelBtn.classList.add('hidden');
    _editingQuestionId = null;
}

function saveTestQuestion() {
    const question = document.getElementById('testQuestionInput').value.trim();
    const answer = document.getElementById('testQuestionAnswer').value === 'true';

    if (!question) {
        showToast('يرجى إدخال نص السؤال', { type: 'error' });
        return;
    }

    if (_editingQuestionId) {
        // Update locally, mark dirty if it was already saved to DB
        const idx = _testQuestionsList.findIndex(q => q.id === _editingQuestionId);
        if (idx !== -1) {
            const existing = _testQuestionsList[idx];
            _testQuestionsList[idx] = {
                ...existing,
                question,
                correct_answer: answer,
                // Keep _isNew flag; only mark _isDirty for already-saved questions
                _isDirty: existing._isNew ? undefined : true,
            };
        }
    } else {
        if (_testQuestionsList.length >= 5) {
            showToast('الحد الأقصى 5 أسئلة لكل اختبار', { type: 'error' });
            return;
        }
        _testQuestionsList.push({
            id: `_new_${_newQuestionCounter++}`,
            question,
            correct_answer: answer,
            order_num: _testQuestionsList.length,
            _isNew: true,
        });
    }

    resetTestQuestionForm();
    renderTestQuestions();
}

async function deleteTestQuestion(questionId) {
    customConfirm('هل تريد حذف هذا السؤال؟', async () => {
        if (String(questionId).startsWith('_new_')) {
            // Local-only — just remove from list, no API call
            _testQuestionsList = _testQuestionsList.filter(q => q.id !== questionId);
            renderTestQuestions();
        } else {
            const result = await adminAPI.deleteTestQuestion(questionId);
            if (result.success) {
                _testQuestionsList = _testQuestionsList.filter(q => q.id !== questionId);
                renderTestQuestions();
                showToast('تم حذف السؤال', { type: 'success' });
            } else {
                showToast(result.message || 'خطأ في الحذف', { type: 'error' });
            }
        }
    }, { icon: '🗑️', title: 'تأكيد الحذف', confirmText: 'حذف', cancelText: 'إلغاء' });
}

async function saveAllAndClose() {
    const btn = document.getElementById('saveAllCloseBtn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ جاري الحفظ...'; }

    let hasError = false;

    // Save new questions
    for (const q of _testQuestionsList) {
        if (q._isNew) {
            const result = await adminAPI.addTestQuestion(_testQuestionsTemplateId, q.question, q.correct_answer, q.order_num ?? 0);
            if (!result.success) {
                showToast(result.message || 'خطأ في إضافة سؤال', { type: 'error' });
                hasError = true;
            }
        }
    }

    // Save edited questions
    for (const q of _testQuestionsList) {
        if (q._isDirty) {
            const result = await adminAPI.updateTestQuestion(q.id, q.question, q.correct_answer, q.order_num ?? 0);
            if (!result.success) {
                showToast(result.message || 'خطأ في تحديث سؤال', { type: 'error' });
                hasError = true;
            }
        }
    }

    // Save max attempts
    const maxAttempts = parseInt(document.getElementById('testMaxAttempts').value);
    if (maxAttempts >= 1) {
        const result = await adminAPI.updateTestConfig(_testQuestionsTemplateId, maxAttempts);
        if (!result.success) {
            showToast(result.message || 'خطأ في حفظ عدد المحاولات', { type: 'error' });
            hasError = true;
        } else {
            const t = (localSkillTemplatesCache || []).find(t => t.id === _testQuestionsTemplateId);
            if (t) t.max_test_attempts = maxAttempts;
        }
    }

    if (btn) { btn.disabled = false; btn.textContent = '💾 حفظ وإرسال'; }

    if (!hasError) {
        showToast('تم حفظ الاختبار بنجاح', { type: 'success' });
        closeTestQuestionsModal();
    }
}

async function resetAllTestAttemptsFromModal() {
    customConfirm(
        'هل تريد إعادة تعيين محاولات الاختبار لجميع الطلاب لهذه المهارة؟ لن يمكن التراجع عن هذا الإجراء.',
        async () => {
            const result = await adminAPI.resetAllTestAttemptsForTemplate(_testQuestionsTemplateId);
            if (result.success) {
                showToast('تم إعادة تعيين محاولات جميع الطلاب', { type: 'success' });
            } else {
                showToast(result.message || 'خطأ', { type: 'error' });
            }
        },
        { icon: '⚠️', title: 'تأكيد إعادة التعيين', confirmText: 'إعادة تعيين', cancelText: 'إلغاء' }
    );
}

function _escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

