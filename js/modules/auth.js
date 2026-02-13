// Authentication Functions

function toggleAdminLoginModal() {
    const modal = document.getElementById('adminLoginModal');
    if (modal) {
        modal.classList.toggle('hidden');
        if (!modal.classList.contains('hidden')) {
            document.getElementById('adminPasswordInput').value = '';
            document.getElementById('adminPasswordInput').focus();
            
            // Close on background click
            modal.onclick = function(e) {
                if (e.target === modal) {
                    toggleAdminLoginModal();
                }
            };
        }
    }
}

async function verifyAdminLogin() {
    const pass = document.getElementById('adminPasswordInput').value.trim();
    if (!pass) {
        customAlert("يرجى إدخال كلمة المرور", { icon: '⚠️', title: 'تنبيه' });
        return;
    }

    const loginButton = event?.target || document.querySelector('#adminLoginModal button');
    if (loginButton) setButtonLoading(loginButton, true);

    const result = await adminAPI.login(pass);

    if (loginButton) setButtonLoading(loginButton, false);

    if (result.success) {
        isAdmin = true;
        
        updateAdminUI();
        toggleAdminLoginModal();
        showToast("مرحباً بك في لوحة التحكم!", { icon: '🎉', title: 'نجح تسجيل الدخول', type: 'success' });

        document.getElementById('studentLoginView').classList.add('hidden');
        document.getElementById('adminDashboardView').classList.remove('hidden');

        renderAdminStudents();
        
        // Initialize skill templates management
        if (typeof initSkillTemplatesManagement === 'function') {
            initSkillTemplatesManagement();
        }
        
        // Load teacher profile and update welcome message
        if (typeof loadCurrentTeacherProfile === 'function') {
            await loadCurrentTeacherProfile();
        }
        if (typeof updateWelcomeMessage === 'function') {
            updateWelcomeMessage();
        }
    } else {
        customAlert(result.message || "كلمة المرور غير صحيحة", { icon: '❌', title: 'خطأ في تسجيل الدخول' });
    }
}

function updateAdminUI() {
    document.getElementById('adminLoginBtn').classList.add('hidden');
    document.getElementById('adminSettingsBtn').classList.remove('hidden');
    document.getElementById('adminLogoutBtn').classList.remove('hidden');
    document.getElementById('studentLogoutBtn').classList.add('hidden');
    const adminControls = document.getElementById('adminControls');
    if (adminControls) adminControls.classList.remove('hidden');
}

function updateStudentUI() {
    document.getElementById('adminLoginBtn').classList.add('hidden');
    document.getElementById('adminLogoutBtn').classList.add('hidden');
    document.getElementById('studentLogoutBtn').classList.remove('hidden');
}

function resetToLoginUI() {
    document.getElementById('adminLoginBtn').classList.remove('hidden');
    document.getElementById('adminSettingsBtn').classList.add('hidden');
    document.getElementById('adminLogoutBtn').classList.add('hidden');
    document.getElementById('studentLogoutBtn').classList.add('hidden');
}

function logoutAdmin() {
    isAdmin = false;
    adminAPI.logout();
    resetToLoginUI();
    const adminControls = document.getElementById('adminControls');
    if (adminControls) adminControls.classList.add('hidden');
    document.getElementById('adminDashboardView').classList.add('hidden');
    document.getElementById('skillsDetailView').classList.add('hidden');
    document.getElementById('studentView').classList.add('hidden');
    document.getElementById('studentLoginView').classList.remove('hidden');
}

async function accessWithCode() {
    const code = document.getElementById('studentCodeInput').value.trim();
    if (!code) {
        customAlert("يرجى إدخال الرقم", { icon: '⚠️', title: 'تنبيه' });
        return;
    }

    const button = event?.target || document.querySelector('button[onclick="accessWithCode()"]');
    if (button) setButtonLoading(button, true);

    const result = await studentAPI.login(code);

    if (button) setButtonLoading(button, false);

    if (result.success) {
        selectedStudentId = result.student.id;
        selectedStudent = result.student;
        
        // Update UI buttons
        updateStudentUI();
        
        // Show simplified student view
        document.getElementById('studentLoginView').classList.add('hidden');
        document.getElementById('adminDashboardView').classList.add('hidden');
        document.getElementById('skillsDetailView').classList.add('hidden');
        document.getElementById('studentView').classList.remove('hidden');

        // Update student name and welcome message
        const studentNameEl = document.getElementById('studentName');
        studentNameEl.innerHTML = `
            <div class="mb-2 text-indigo-600 text-lg sm:text-xl">مرحباً 👋</div>
            <div>${result.student.name}</div>
        `;

        // Load student data
        await loadSimpleStudentView(result.student.id);
    } else {
        customAlert(result.message || "الرقم غير صحيح", { icon: '❌', title: 'خطأ في الدخول' });
    }
}

function logoutStudent() {
    resetToLoginUI();
    document.getElementById('studentView').classList.add('hidden');
    document.getElementById('skillsDetailView').classList.add('hidden');
    document.getElementById('studentLoginView').classList.remove('hidden');
    studentAPI.logout();
    document.getElementById('studentCodeInput').value = '';
    selectedStudent = null;
    selectedStudentId = null;
}
