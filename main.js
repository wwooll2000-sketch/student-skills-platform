// Global state
let isAdmin = false;
let selectedStudentId = null;
let selectedStudent = null;
let customSkillsCache = null;

// Custom Modal System
function showModal(options) {
    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('modalContent');
    const icon = document.getElementById('modalIcon');
    const title = document.getElementById('modalTitle');
    const message = document.getElementById('modalMessage');
    const buttons = document.getElementById('modalButtons');

    // Set icon
    icon.textContent = options.icon || '💬';
    
    // Set title and message
    title.textContent = options.title || 'إشعار';
    message.textContent = options.message || '';
    
    // Clear previous buttons
    buttons.innerHTML = '';
    
    // Add buttons
    if (options.type === 'confirm') {
        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = options.confirmText || 'تأكيد';
        confirmBtn.className = 'flex-1 bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 font-medium transition';
        confirmBtn.onclick = () => {
            closeModal();
            if (options.onConfirm) options.onConfirm();
        };
        
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = options.cancelText || 'إلغاء';
        cancelBtn.className = 'flex-1 bg-slate-200 text-slate-700 py-3 px-4 rounded-lg hover:bg-slate-300 font-medium transition';
        cancelBtn.onclick = () => {
            closeModal();
            if (options.onCancel) options.onCancel();
        };
        
        buttons.appendChild(confirmBtn);
        buttons.appendChild(cancelBtn);
    } else {
        const okBtn = document.createElement('button');
        okBtn.textContent = options.buttonText || 'حسناً';
        okBtn.className = 'w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 font-medium transition';
        okBtn.onclick = () => {
            closeModal();
            if (options.onClose) options.onClose();
        };
        buttons.appendChild(okBtn);
    }
    
    // Show modal with animation
    modal.classList.remove('hidden');
    setTimeout(() => {
        modalContent.classList.remove('scale-95');
        modalContent.classList.add('scale-100');
    }, 10);
    
    // Close on background click
    modal.onclick = function(e) {
        if (e.target === modal) {
            closeModal();
        }
    };
}

function closeModal() {
    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('modalContent');
    
    modalContent.classList.remove('scale-100');
    modalContent.classList.add('scale-95');
    
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 200);
}

function customAlert(message, options = {}) {
    showModal({
        type: 'alert',
        icon: options.icon || '💬',
        title: options.title || 'إشعار',
        message: message,
        buttonText: options.buttonText || 'حسناً',
        onClose: options.onClose
    });
}

function customConfirm(message, onConfirm, options = {}) {
    showModal({
        type: 'confirm',
        icon: options.icon || '❓',
        title: options.title || 'تأكيد',
        message: message,
        confirmText: options.confirmText || 'تأكيد',
        cancelText: options.cancelText || 'إلغاء',
        onConfirm: onConfirm,
        onCancel: options.onCancel
    });
}

// Helper function to show loading indicator
function showLoading(elementId, message = 'جاري التحميل...') {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `<div class="p-8 text-center"><div class="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600 mx-auto mb-3"></div><p class="text-slate-600">${message}</p></div>`;
    }
}

// Helper function to show button loading state
function setButtonLoading(button, loading, originalText = '') {
    if (loading) {
        button.disabled = true;
        button.dataset.originalText = button.innerHTML;
        button.innerHTML = '<span class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span> جاري المعالجة...';
    } else {
        button.disabled = false;
        button.innerHTML = button.dataset.originalText || originalText;
    }
}

// Initialize on load
window.addEventListener('load', async function () {
    console.log('✅ تطبيق جاهز - البيانات تُحمّل من قاعدة البيانات فقط');

    // Check if admin is already logged in
    if (adminAPI.isAuthorized()) {
        isAdmin = true;
        updateAdminUI();
        document.getElementById('studentLoginView').classList.add('hidden');
        document.getElementById('adminDashboardView').classList.remove('hidden');
        renderAdminStudents();
        console.log('✅ تم تسجيل دخول المعلم تلقائياً');
    }

    // Load custom skills once and populate dropdown
    await loadAndPopulateCustomSkills();

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

// Admin login modal
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
        customAlert("مرحباً بك في لوحة التحكم!", { icon: '🎉', title: 'نجح تسجيل الدخول' });

        document.getElementById('studentLoginView').classList.add('hidden');
        document.getElementById('adminDashboardView').classList.remove('hidden');

        renderAdminStudents();
    } else {
        customAlert(result.message || "كلمة المرور غير صحيحة", { icon: '❌', title: 'خطأ في تسجيل الدخول' });
    }
}

function updateAdminUI() {
    document.getElementById('loginBtn').classList.add('hidden');
    document.getElementById('logoutBtn').classList.remove('hidden');
    document.getElementById('adminControls').classList.remove('hidden');
}

function logoutAdmin() {
    isAdmin = false;
    adminAPI.logout();
    document.getElementById('loginBtn').classList.remove('hidden');
    document.getElementById('logoutBtn').classList.add('hidden');
    document.getElementById('adminControls').classList.add('hidden');
    document.getElementById('adminDashboardView').classList.add('hidden');
    document.getElementById('skillsDetailView').classList.add('hidden');
    document.getElementById('studentLoginView').classList.remove('hidden');
}

function generateRandomCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

async function addNewStudent() {
    const name = document.getElementById('newStudentName').value.trim();
    if (!name) {
        customAlert("يرجى إدخال اسم الطالب", { icon: '⚠️', title: 'تنبيه' });
        return;
    }

    const button = event?.target || document.querySelector('button[onclick="addNewStudent()"]');
    if (button) setButtonLoading(button, true);
    showLoading('adminStudentsList', 'جاري إضافة الطالب...');

    const code = generateRandomCode();
    const result = await adminAPI.addStudent(name, code, null, null);

    if (button) setButtonLoading(button, false);

    if (result.success) {
        document.getElementById('newStudentName').value = '';
        customAlert(`${result.message}\n\nالاسم: ${name}\nالرقم: ${code}`, { 
            icon: '✅', 
            title: 'تم إضافة الطالب',
            onClose: () => renderAdminStudents()
        });
    } else {
        customAlert(result.message || "خطأ في إضافة الطالب", { 
            icon: '❌', 
            title: 'خطأ',
            onClose: () => renderAdminStudents()
        });
    }
}

async function deleteStudent(id) {
    if (!isAdmin) return;

    showLoading('adminStudentsList', 'جاري جلب بيانات الطالب...');

    const result = await adminAPI.getAllStudents();
    if (!result.success) {
        customAlert("خطأ في جلب بيانات الطالب", { 
            icon: '❌', 
            title: 'خطأ',
            onClose: () => renderAdminStudents()
        });
        return;
    }

    const student = result.students.find(s => s.id === id);
    if (!student) {
        customAlert("الطالب غير موجود", { 
            icon: '❌', 
            title: 'خطأ',
            onClose: () => renderAdminStudents()
        });
        return;
    }

    customConfirm(`هل أنت متأكد من حذف الطالب: ${student.name}؟`, async () => {
        showLoading('adminStudentsList', 'جاري حذف الطالب...');
        const deleteResult = await adminAPI.deleteStudent(id);

        if (deleteResult.success) {
            customAlert("تم حذف الطالب بنجاح", { 
                icon: '✅', 
                title: 'تم الحذف',
                onClose: () => renderAdminStudents()
            });
        } else {
            customAlert(deleteResult.message || "خطأ في حذف الطالب", { 
                icon: '❌', 
                title: 'خطأ',
                onClose: () => renderAdminStudents()
            });
        }
    }, {
        icon: '🗑️',
        title: 'تأكيد الحذف',
        confirmText: 'حذف',
        cancelText: 'إلغاء',
        onCancel: () => renderAdminStudents()
    });
}

async function loadStudentsFromDatabase() {
    try {
        const result = await adminAPI.getAllStudents();
        if (result.success) {
            console.log('✅ تم تحميل', result.students.length, 'طالب من قاعدة البيانات');
            return result.students;
        } else {
            console.warn('⚠️ خطأ في تحميل الطلاب:', result.message);
            return [];
        }
    } catch (error) {
        console.error('❌ خطأ في الاتصال بقاعدة البيانات:', error);
        return [];
    }
}

async function renderAdminStudents() {
    const container = document.getElementById('adminStudentsList');
    showLoading('adminStudentsList', 'جاري تحميل البيانات...');

    const students = await loadStudentsFromDatabase();

    // Load saved skills in parallel with better caching
    if (!customSkillsCache) {
        customSkillsCache = await fetchCustomSkills();
    }

    container.innerHTML = '';
    if (students.length === 0) {
        container.innerHTML = '<div class="p-8 text-center text-slate-400">لا يوجد طلاب - أضف طالب جديد</div>';
    } else {
        students.forEach(student => {
            const div = document.createElement('div');
            div.className = "p-3 sm:p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:bg-slate-50 transition gap-2 sm:gap-0";
            div.innerHTML = `
                <div class="flex-1">
                    <span class="font-bold text-slate-800 text-sm sm:text-base">${student.name}</span>
                    <span class="mr-2 sm:mr-4 text-indigo-600 font-mono bg-indigo-50 px-2 py-1 rounded text-xs sm:text-sm">رقم: ${student.code}</span>
                </div>
                <div class="flex gap-2 w-full sm:w-auto">
                    <button onclick="showStudentSkills('${student.id}')" class="flex-1 sm:flex-none text-xs sm:text-sm text-white bg-indigo-500 hover:bg-indigo-600 px-3 py-2 rounded-lg transition">عرض المهارات</button>
                    <button onclick="deleteStudent('${student.id}')" class="text-xs sm:text-sm text-white bg-red-500 hover:bg-red-600 px-3 py-2 rounded-lg transition">🗑️ حذف</button>
                </div>
            `;
            container.appendChild(div);
        });
    }

    renderSavedSkillsList(customSkillsCache);
}

function renderSavedSkillsList(savedSkills) {
    const container = document.getElementById('savedSkillsList');
    container.innerHTML = '';

    if (!savedSkills || savedSkills.length === 0) {
        container.innerHTML = '<div class="p-4 text-center text-slate-400">لا توجد مهارات محفوظة</div>';
        return;
    }

    savedSkills.forEach(skill => {
        const div = document.createElement('div');
        div.className = "p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 rounded-lg hover:bg-slate-100 transition gap-2";
        div.innerHTML = `
            <div class="flex-1 w-full">
                <span class="font-medium text-slate-800 text-sm sm:text-base">${skill.name}</span>
                <a href="${skill.url}" target="_blank" class="block sm:inline mr-0 sm:mr-2 text-indigo-500 text-xs sm:text-sm hover:underline mt-1 sm:mt-0">🔗 الرابط</a>
            </div>
            <button onclick="deleteSkillFromList('${skill.name.replace(/'/g, "\\'")}','${skill.url.replace(/'/g, "\\'")}')" class="text-red-500 hover:text-red-700 text-xs sm:text-sm px-3 py-2 bg-white rounded-lg w-full sm:w-auto">🗑️ حذف</button>
        `;
        container.appendChild(div);
    });
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
        document.getElementById('studentLoginView').classList.add('hidden');
        document.getElementById('adminDashboardView').classList.add('hidden');
        document.getElementById('skillsDetailView').classList.remove('hidden');

        document.getElementById('currentStudentTitle').innerText = result.student.name;

        await renderStudentSkillsFromDB(result.student.id);
    } else {
        customAlert(result.message || "الرقم غير صحيح", { icon: '❌', title: 'خطأ في الدخول' });
    }
}

async function showStudentSkills(id) {
    selectedStudentId = id;

    showLoading('adminStudentsList', 'جاري تحميل بيانات الطالب...');

    const result = await adminAPI.getAllStudents();
    const student = result.students.find(s => s.id === id);

    if (!student) {
        customAlert("الطالب غير موجود", { 
            icon: '❌', 
            title: 'خطأ',
            onClose: () => renderAdminStudents()
        });
        return;
    }

    selectedStudent = student;
    document.getElementById('currentStudentTitle').innerText = student.name;

    await renderStudentSkillsFromDB(id);

    document.getElementById('studentLoginView').classList.add('hidden');
    document.getElementById('adminDashboardView').classList.add('hidden');
    document.getElementById('skillsDetailView').classList.remove('hidden');
}

async function renderStudentSkillsFromDB(studentId) {
    const tbody = document.getElementById('skillsTableBody');
    tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center"><div class="animate-spin rounded-full h-10 w-10 border-b-4 border-indigo-600 mx-auto mb-2"></div><p class="text-slate-600">جاري تحميل المهارات...</p></td></tr>';

    const skillsResult = await studentAPI.getSkills();

    tbody.innerHTML = '';

    if (isAdmin) {
        document.getElementById('adminHeaderDelete').classList.remove('hidden');
    } else {
        document.getElementById('adminHeaderDelete').classList.add('hidden');
    }

    if (!skillsResult.success || !skillsResult.data || skillsResult.data.skills.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-10 text-center text-slate-400">لا توجد مهارات</td></tr>`;
        return;
    }

    const skills = skillsResult.data.skills;
    skills.forEach((skill) => {
        const row = document.createElement('tr');
        row.className = "border-b border-slate-100";

        const skillName = skill.name || 'مهارة بدون عنوان';
        const skillUrl = skill.description || '#';
        const isDone = skill.level === 3 || skill.level === 2;

        const statusText = isDone ? '✅ تم' : '❌ لم تكتمل';
        const statusColor = isDone ? 'text-green-600' : 'text-red-400';

        let deleteBtn = isAdmin ? `<td class="p-2 sm:p-4 text-center"><button onclick="deleteSkill('${skill.id}')" class="text-red-500 hover:text-red-700 text-xl sm:text-2xl">🗑️</button></td>` : '';

        row.innerHTML = `
            <td class="p-2 sm:p-4 text-slate-700 text-xs sm:text-base">${skillName}</td>
            <td class="p-2 sm:p-4 text-center">
                <a href="${skillUrl}" target="_blank" class="text-xl sm:text-2xl hover:scale-110 transition-transform inline-block" title="فتح الملف">
                    📂
                </a>
            </td>
            <td class="p-2 sm:p-4 text-center">
                <button onclick="toggleSkill('${skill.id}')" class="${statusColor} font-bold px-2 sm:px-3 py-1 hover:opacity-80 text-xs sm:text-sm">
                    ${statusText}
                </button>
            </td>
            ${deleteBtn}
        `;
        tbody.appendChild(row);
    });
}

async function toggleSkill(skillId) {
    if (!isAdmin) return;

    const tbody = document.getElementById('skillsTableBody');
    const originalContent = tbody.innerHTML;
    tbody.innerHTML = '<tr><td colspan="4" class="p-6 text-center"><div class="animate-spin rounded-full h-8 w-8 border-b-4 border-indigo-600 mx-auto"></div></td></tr>';

    const skillsResult = await studentAPI.getSkills();
    if (!skillsResult.success) {
        customAlert("خطأ في تحميل المهارات", { icon: '❌', title: 'خطأ' });
        tbody.innerHTML = originalContent;
        return;
    }

    const skill = skillsResult.data.skills.find(s => s.id === skillId);
    if (!skill) {
        customAlert("المهارة غير موجودة", { icon: '❌', title: 'خطأ' });
        tbody.innerHTML = originalContent;
        return;
    }

    const newLevel = skill.level === 3 ? 1 : 3;

    const result = await adminAPI.updateSkill(
        skillId,
        skill.name,
        newLevel,
        skill.description || '',
        skill.category || '',
        skill.notes || ''
    );

    if (result.success) {
        await renderStudentSkillsFromDB(selectedStudentId);
    } else {
        customAlert("خطأ في تحديث المهارة: " + (result.message || ''), { icon: '❌', title: 'خطأ' });
        tbody.innerHTML = originalContent;
    }
}

async function deleteSkill(skillId) {
    if (!isAdmin) return;

    customConfirm("هل أنت متأكد من حذف المهارة؟", async () => {
        const tbody = document.getElementById('skillsTableBody');
        tbody.innerHTML = '<tr><td colspan="4" class="p-6 text-center"><div class="animate-spin rounded-full h-8 w-8 border-b-4 border-indigo-600 mx-auto mb-2"></div><p class="text-slate-600">جاري حذف المهارة...</p></td></tr>';

        const result = await adminAPI.deleteSkill(skillId);

        if (result.success) {
            customAlert("تم حذف المهارة بنجاح", { 
                icon: '✅', 
                title: 'تم الحذف',
                onClose: () => renderStudentSkillsFromDB(selectedStudentId)
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

function backToHome() {
    document.getElementById('skillsDetailView').classList.add('hidden');
    if (isAdmin) {
        document.getElementById('adminDashboardView').classList.remove('hidden');
        renderAdminStudents(); // Refresh the students list to remove loading state
    } else {
        document.getElementById('studentLoginView').classList.remove('hidden');
        studentAPI.logout();
        document.getElementById('studentCodeInput').value = '';
        selectedStudent = null;
    }
}

// Skill dropdown event listener
document.getElementById('skillDropdown').addEventListener('change', function () {
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

async function saveNewSkill() {
    const drop = document.getElementById('skillDropdown');
    let skillName = drop.value === 'custom' ? document.getElementById('manualSkillInput').value.trim() : drop.value;
    const url = document.getElementById('newFileLink').value.trim();

    if (!skillName || !url) {
        customAlert("يرجى إكمال جميع البيانات المطلوبة", { icon: '⚠️', title: 'بيانات ناقصة' });
        return;
    }

    const button = event?.target || document.querySelector('button[onclick="saveNewSkill()"]');
    if (button) setButtonLoading(button, true);
    const tbody = document.getElementById('skillsTableBody');
    tbody.innerHTML = '<tr><td colspan="4" class="p-6 text-center"><div class="animate-spin rounded-full h-8 w-8 border-b-4 border-indigo-600 mx-auto mb-2"></div><p class="text-slate-600">جاري إضافة المهارة...</p></td></tr>';

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

        customAlert("تم إضافة المهارة بنجاح", { 
            icon: '✅', 
            title: 'نجحت العملية',
            onClose: () => renderStudentSkillsFromDB(selectedStudentId)
        });
    } else {
        customAlert("خطأ في إضافة المهارة: " + (result.message || ''), { 
            icon: '❌', 
            title: 'خطأ',
            onClose: () => renderStudentSkillsFromDB(selectedStudentId)
        });
    }
}

async function addSkillToDropdown(skillName, url) {
    const dropdown = document.getElementById('skillDropdown');

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
        showLoading('savedSkillsList', 'جاري حذف المهارة...');

        await deleteCustomSkillFromDatabase(skillName);

        // Clear cache and reload
        customSkillsCache = null;
        await reloadSkillsDropdown();
        
        const savedSkills = await fetchCustomSkills();
        renderSavedSkillsList(savedSkills);
        
        customAlert("تم حذف المهارة من القائمة", { icon: '✅', title: 'تم الحذف' });
    }, {
        icon: '🗑️',
        title: 'تأكيد الحذف',
        confirmText: 'حذف',
        cancelText: 'إلغاء'
    });
}

async function reloadSkillsDropdown() {
    const dropdown = document.getElementById('skillDropdown');

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
        const response = await fetch('/api/custom-skills', {
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
        const response = await fetch('/api/custom-skills', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
            },
            body: JSON.stringify({ name, url })
        });
        if (response.ok) {
            customSkillsCache = null; // Clear cache
            await reloadSkillsDropdown();
            
            const savedSkills = await fetchCustomSkills();
            renderSavedSkillsList(savedSkills);
        }
    } catch (error) {
        console.error('خطأ في حفظ المهارة:', error);
    }
}

async function deleteCustomSkillFromDatabase(name) {
    try {
        const response = await fetch(`/api/custom-skills/${encodeURIComponent(name)}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
            }
        });
        return response.ok;
    } catch (error) {
        console.error('خطأ في حذف المهارة:', error);
        return false;
    }
}
