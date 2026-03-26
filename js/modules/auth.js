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

        // Load announcements
        if (typeof loadAdminAnnouncements === 'function') {
            loadAdminAnnouncements();
        }
        
        // Populate the ready-students skill filter dropdown
        if (typeof populateReadySkillSelect === 'function') {
            populateReadySkillSelect();
        }

        // Initialize ready-feature warning icon
        if (typeof getColumnVisibility === 'function' && typeof updateReadyFeatureWarning === 'function') {
            getColumnVisibility().then(visibility => {
                updateReadyFeatureWarning(visibility);
            });
        }
        
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
    document.getElementById('notificationMuteBtn').classList.remove('hidden');
    document.getElementById('adminSettingsBtn').classList.remove('hidden');
    document.getElementById('adminLogoutBtn').classList.remove('hidden');
    document.getElementById('studentLogoutBtn').classList.add('hidden');
    const adminTitleBar = document.getElementById('adminTitleBar');
    if (adminTitleBar) adminTitleBar.classList.remove('hidden');
    const adminControls = document.getElementById('adminControls');
    if (adminControls) adminControls.classList.remove('hidden');
    
    // Update notification button icon based on mute state
    updateNotificationMuteButton();
}

function updateStudentUI() {
    document.getElementById('adminLoginBtn').classList.add('hidden');
    document.getElementById('adminLogoutBtn').classList.add('hidden');
    document.getElementById('studentLogoutBtn').classList.remove('hidden');
}

function resetToLoginUI() {
    document.getElementById('adminLoginBtn').classList.remove('hidden');
    document.getElementById('notificationMuteBtn').classList.add('hidden');
    document.getElementById('adminSettingsBtn').classList.add('hidden');
    document.getElementById('adminLogoutBtn').classList.add('hidden');
    document.getElementById('studentLogoutBtn').classList.add('hidden');
    const adminTitleBar = document.getElementById('adminTitleBar');
    if (adminTitleBar) adminTitleBar.classList.add('hidden');
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
            <div class="mb-2 text-indigo-600 text-lg sm:text-xl">مرحباً بك</div>
            <div>${result.student.name}</div>
        `;

        // Load student data
        await loadSimpleStudentView(result.student.id);
        
        // Start session validation polling
        startStudentSessionValidation();
    } else {
        customAlert(result.message || "الرقم غير صحيح", { icon: '❌', title: 'خطأ في الدخول' });
    }
}

function logoutStudent() {
    // Stop session validation polling FIRST
    stopStudentSessionValidation();
    
    resetToLoginUI();
    document.getElementById('studentView').classList.add('hidden');
    document.getElementById('skillsDetailView').classList.add('hidden');
    document.getElementById('studentLoginView').classList.remove('hidden');
    studentAPI.logout();
    document.getElementById('studentCodeInput').value = '';
    selectedStudent = null;
    selectedStudentId = null;
}

// Session validation polling for students
let studentDataRefreshInterval = null;

function startStudentSessionValidation() {
    // Clear any existing interval
    stopStudentSessionValidation();
    isLoggingOut = false;
    
    // Check session every 10 seconds and refresh data every 15 seconds
    let validationCounter = 0;
    studentSessionCheckInterval = setInterval(async () => {
        // Skip validation if already logging out
        if (isLoggingOut) return;
        
        validationCounter++;
        
        // Refresh student data every 15 seconds (every 1.5 validation cycles)
        if (validationCounter % 2 === 0 && selectedStudentId) {
            await loadSimpleStudentView(selectedStudentId, false); // Refresh without showing loading
        }
        
        const result = await studentAPI.validateSession();
        
        // ONLY show alert and logout if student was specifically deleted
        // Don't show alerts for normal session expiry or auth failures
        if (result.student_deleted === true) {
            isLoggingOut = true;
            stopStudentSessionValidation();
            
            // Force logout
            resetToLoginUI();
            document.getElementById('studentView').classList.add('hidden');
            document.getElementById('skillsDetailView').classList.add('hidden');
            document.getElementById('studentLoginView').classList.remove('hidden');
            studentAPI.logout();
            document.getElementById('studentCodeInput').value = '';
            selectedStudent = null;
            selectedStudentId = null;
            
            // Show deletion message
            customAlert(
                result.message || "تم حذف حسابك من قبل المعلم. يرجى التواصل مع معلمك للمزيد من المعلومات.",
                { 
                    icon: '⚠️', 
                    title: 'تم حذف الحساب',
                    confirmText: 'حسناً'
                }
            );
        }
        // Silently handle other validation failures (session expiry, etc.)
    }, 10000); // Check every 10 seconds
}

function stopStudentSessionValidation() {
    if (studentSessionCheckInterval) {
        clearInterval(studentSessionCheckInterval);
        studentSessionCheckInterval = null;
    }
}
