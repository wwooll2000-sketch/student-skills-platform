// Teacher Settings Functions

let currentTeacherName = 'المعلم';

function openTeacherSettingsModal() {
    const modal = document.getElementById('teacherSettingsModal');
    
    // Load current teacher name
    loadCurrentTeacherProfile();
    
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
