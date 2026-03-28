// Initialization and Event Listeners

window.addEventListener('load', async function () {
    console.log('✅ تطبيق جاهز - البيانات تُحمّل من قاعدة البيانات فقط');

    // Check if admin is already logged in
    if (adminAPI.isAuthorized()) {
        isAdmin = true;
        updateAdminUI();
        
        // Load teacher profile and update welcome message
        if (typeof loadCurrentTeacherProfile === 'function') {
            await loadCurrentTeacherProfile();
        }
        if (typeof updateWelcomeMessage === 'function') {
            updateWelcomeMessage();
        }
        
        // Initialize skill templates management
        if (typeof initSkillTemplatesManagement === 'function') {
            initSkillTemplatesManagement();
        }
        
        // Check if we should restore the skills view
        const savedStudentId = sessionStorage.getItem('skillsView_studentId');
        const savedStudentData = sessionStorage.getItem('skillsView_studentData');
        
        if (savedStudentId && savedStudentData) {
            // Restore the skills view for the student
            selectedStudentId = savedStudentId;
            selectedStudent = JSON.parse(savedStudentData);
            
            document.getElementById('currentStudentTitle').innerText = `${selectedStudent.name} - ${selectedStudent.code}`;
            document.getElementById('studentLoginView').classList.add('hidden');
            document.getElementById('adminDashboardView').classList.add('hidden');
            document.getElementById('skillsDetailView').classList.remove('hidden');
            
            // Load the skills
            renderStudentSkillsFromDB(savedStudentId);
            
            console.log('✅ تم استرجاع عرض المهارات للطالب');
        } else {
            // Show normal admin dashboard
            document.getElementById('studentLoginView').classList.add('hidden');
            document.getElementById('adminDashboardView').classList.remove('hidden');
            renderAdminStudents();
            // Load announcements for admin
            if (typeof loadAdminAnnouncements === 'function') {
                loadAdminAnnouncements();
            }
            // Load badges for admin
            if (typeof loadAdminBadges === 'function') {
                loadAdminBadges();
            }
            // Populate skill-ready filter dropdown
            if (typeof populateReadySkillSelect === 'function') {
                populateReadySkillSelect();
            }
            // Initialize ready-feature warning icon
            getColumnVisibility().then(visibility => {
                if (typeof updateReadyFeatureWarning === 'function') {
                    updateReadyFeatureWarning(visibility);
                }
            });
            console.log('✅ تم تسجيل دخول المعلم تلقائياً');
        }
    }
    // Check if student is already logged in
    else if (studentAPI.isAuthorized()) {
        const sessionResult = await studentAPI.restoreSession();
        if (sessionResult.success) {
            selectedStudentId = sessionResult.student.id;
            selectedStudent = sessionResult.student;
            
            // Update UI buttons
            updateStudentUI();
            
            // Show student view
            document.getElementById('studentLoginView').classList.add('hidden');
            document.getElementById('adminDashboardView').classList.add('hidden');
            document.getElementById('skillsDetailView').classList.add('hidden');
            document.getElementById('studentView').classList.remove('hidden');

            // Update student name and welcome message
            const studentNameEl = document.getElementById('studentName');
            studentNameEl.innerHTML = `
                <div class="mb-2 text-indigo-600 text-lg sm:text-xl">مرحباً بك</div>
                <div>${sessionResult.student.name}</div>
            `;

            // Load student data
            await loadSimpleStudentView(sessionResult.student.id);
            
            // Start session validation polling
            if (typeof startStudentSessionValidation === 'function') {
                startStudentSessionValidation();
            }
            
            console.log('✅ تم استرجاع جلسة الطالب تلقائياً');
        }
    }

    // Add Enter key listeners for better UX
    document.getElementById('studentCodeInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            accessWithCode();
        }
    });

    document.getElementById('adminPasswordInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            verifyAdminLogin();
        }
    });

    // ESC key to close modals
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const customModal = document.getElementById('customModal');
            const adminModal = document.getElementById('adminLoginModal');
            
            if (!customModal.classList.contains('hidden')) {
                closeModal();
            } else if (!adminModal.classList.contains('hidden')) {
                toggleAdminLoginModal();
            }
        }
    });

    // Hide loading screen and show app
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
});

// Skill dropdown event listener
document.addEventListener('DOMContentLoaded', function() {
    const skillDropdown = document.getElementById('skillDropdown');
    if (skillDropdown) {
        skillDropdown.addEventListener('change', function () {
            const manual = document.getElementById('manualSkillInput');
            const fileLink = document.getElementById('newFileLink');

            if (this.value === 'custom') {
                manual.classList.remove('hidden');
                fileLink.value = '';
            } else {
                manual.classList.add('hidden');
                manual.value = '';

                const selectedOption = this.options[this.selectedIndex];
                const url = selectedOption.getAttribute('data-url');
                if (url) {
                    fileLink.value = url;
                } else {
                    fileLink.value = '';
                }
            }
        });
    }

    // Add event listener for search input
    const searchInput = document.getElementById('studentSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', applySortAndFilter);
        
        // Add keyboard shortcut (Ctrl+F or Cmd+F) to focus search
        document.addEventListener('keydown', function(e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f' && isAdmin) {
                const adminDashboard = document.getElementById('adminDashboardView');
                if (!adminDashboard.classList.contains('hidden')) {
                    e.preventDefault();
                    searchInput.focus();
                }
            }
        });
    }
});
