// Teacher Settings Functions

let currentTeacherName = 'المعلم';

function openTeacherSettingsModal() {
    const modal = document.getElementById('teacherSettingsModal');
    
    // Load current teacher name
    loadCurrentTeacherProfile();

    // Load column visibility settings
    loadColumnVisibilitySettings();
    
    modal.classList.remove('hidden');
    
    // Close modal on outside click
    modal.onclick = function(e) {
        if (e.target === modal) {
            closeTeacherSettingsModal();
        }
    };
}

function closeTeacherSettingsModal() {
    const modal = document.getElementById('teacherSettingsModal');
    modal.classList.add('hidden');
    modal.onclick = null;
    
    // Clear inputs
    document.getElementById('teacherNewName').value = '';
    document.getElementById('teacherCurrentPassword').value = '';
    document.getElementById('teacherNewPassword').value = '';
}

async function loadCurrentTeacherProfile() {
    try {
        const response = await fetch('/api/admin/teacher/profile', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
            }
        });
        
        const result = await response.json();
        
        if (result.success && result.teacher) {
            currentTeacherName = result.teacher.name;
            document.getElementById('teacherNewName').placeholder = `الاسم الحالي: ${result.teacher.name}`;
        }
    } catch (error) {
        console.error('Error loading teacher profile:', error);
    }
}

async function updateTeacherName() {
    const newName = document.getElementById('teacherNewName').value.trim();
    
    if (!newName) {
        customAlert('يرجى إدخال الاسم الجديد', { icon: '⚠️', title: 'تنبيه' });
        return;
    }
    
    const button = document.getElementById('updateNameBtn');
    setButtonLoading(button, true);
    
    try {
        const response = await fetch('/api/admin/teacher/update-name', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
            },
            body: JSON.stringify({ name: newName })
        });
        
        const result = await response.json();
        
        if (result.success) {
            currentTeacherName = result.teacher.name;
            showToast('تم تحديث الاسم بنجاح', { type: 'success', title: 'نجحت العملية' });
            document.getElementById('teacherNewName').value = '';
            document.getElementById('teacherNewName').placeholder = `الاسم الحالي: ${result.teacher.name}`;
            
            // Update welcome message if visible
            updateWelcomeMessage();
        } else {
            customAlert(result.message || 'فشل تحديث الاسم', { icon: '❌', title: 'خطأ' });
        }
    } catch (error) {
        console.error('Error updating teacher name:', error);
        customAlert('خطأ في الاتصال بالخادم', { icon: '❌', title: 'خطأ' });
    } finally {
        setButtonLoading(button, false);
    }
}

async function updateTeacherPassword() {
    const currentPassword = document.getElementById('teacherCurrentPassword').value;
    const newPassword = document.getElementById('teacherNewPassword').value;
    
    if (!currentPassword || !newPassword) {
        customAlert('يرجى إدخال كلمة المرور الحالية والجديدة', { icon: '⚠️', title: 'تنبيه' });
        return;
    }
    
    if (newPassword.length < 4) {
        customAlert('كلمة المرور الجديدة قصيرة جداً (4 أحرف على الأقل)', { icon: '⚠️', title: 'تنبيه' });
        return;
    }
    
    const button = document.getElementById('updatePasswordBtn');
    setButtonLoading(button, true);
    
    try {
        const response = await fetch('/api/admin/teacher/update-password', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
            },
            body: JSON.stringify({
                currentPassword: currentPassword,
                newPassword: newPassword
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('تم تحديث كلمة المرور بنجاح', { type: 'success', title: 'نجحت العملية' });
            document.getElementById('teacherCurrentPassword').value = '';
            document.getElementById('teacherNewPassword').value = '';
        } else {
            customAlert(result.message || 'فشل تحديث كلمة المرور', { icon: '❌', title: 'خطأ' });
        }
    } catch (error) {
        console.error('Error updating teacher password:', error);
        customAlert('خطأ في الاتصال بالخادم', { icon: '❌', title: 'خطأ' });
    } finally {
        setButtonLoading(button, false);
    }
}

function updateWelcomeMessage() {
    const welcomeElement = document.getElementById('teacherWelcomeMessage');
    if (welcomeElement && currentTeacherName) {
        welcomeElement.textContent = `مرحباً بك أ. ${currentTeacherName}`;
    }
}

// ===== Column Visibility Settings =====

const STUDENT_COLUMNS = [
    { key: 'الرابط',   label: 'الرابط 🔗' },
    { key: 'جاهز',    label: 'جاهز ✅' },
    { key: 'الشواهد', label: 'الشواهد 📸' },
    { key: 'الحالة',  label: 'الحالة' }
];

async function loadColumnVisibilitySettings() {
    const container = document.getElementById('columnVisibilityToggles');
    if (!container) return;

    container.innerHTML = '<div class="text-center text-slate-400 text-sm py-4">جاري التحميل...</div>';

    try {
        const response = await fetch('/api/settings/column-visibility');
        const result = await response.json();
        const visibility = result.success ? (result.column_visibility || {}) : {};

        // Bust the dashboard cache so the next student view re-fetches
        window._columnVisibilityCache = null;

        container.innerHTML = STUDENT_COLUMNS.map(col => {
            const isVisible = visibility[col.key] !== false; // default: visible
            return `
                <label class="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-white transition select-none">
                    <div class="relative inline-flex items-center">
                        <input type="checkbox" id="col_vis_${col.key}" ${isVisible ? 'checked' : ''}
                            onchange="toggleStudentColumn('${col.key}', this.checked)"
                            class="sr-only peer">
                        <div class="w-10 h-6 bg-slate-300 rounded-full peer peer-checked:bg-indigo-500 transition-colors"></div>
                        <div class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4"></div>
                    </div>
                    <span class="text-sm font-medium text-slate-700">${col.label}</span>
                </label>
            `;
        }).join('');
    } catch (e) {
        console.error('Error loading column visibility:', e);
        container.innerHTML = '<p class="text-red-400 text-sm text-center py-2">خطأ في التحميل</p>';
    }
}

async function toggleStudentColumn(colKey, visible) {
    // Fetch current settings first to avoid overwriting other keys
    let currentVisibility = {};
    try {
        const r = await fetch('/api/settings/column-visibility');
        const d = await r.json();
        if (d.success) currentVisibility = d.column_visibility || {};
    } catch (e) { /* use empty object */ }

    currentVisibility[colKey] = visible;

    try {
        const response = await fetch('/api/admin/teacher/column-visibility', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
            },
            body: JSON.stringify({ column_visibility: currentVisibility })
        });
        const result = await response.json();

        if (result.success) {
            // Bust dashboard cache so next load re-fetches
            window._columnVisibilityCache = null;
            // Apply immediately to any visible student table
            if (typeof applyStudentColumnVisibility === 'function') {
                applyStudentColumnVisibility(currentVisibility);
            }
            showToast(
                visible ? `تم إظهار عمود "${colKey}"` : `تم إخفاء عمود "${colKey}"`,
                { type: 'success' }
            );
        } else {
            showToast('خطأ في حفظ الإعدادات', { type: 'error' });
        }
    } catch (e) {
        console.error('Error saving column visibility:', e);
        showToast('خطأ في الاتصال بالخادم', { type: 'error' });
    }
}
