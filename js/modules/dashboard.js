// Dashboard and Statistics Functions

// ===== Student Column Visibility =====
// Shared cache accessible from teacher-settings.js via window._columnVisibilityCache
window._columnVisibilityCache = null;

async function getColumnVisibility() {
    if (window._columnVisibilityCache !== null) return window._columnVisibilityCache;
    try {
        const r = await fetch('/api/settings/column-visibility');
        const d = await r.json();
        window._columnVisibilityCache = d.success ? (d.column_visibility || {}) : {};
    } catch {
        window._columnVisibilityCache = {};
    }
    return window._columnVisibilityCache;
}

function applyStudentColumnVisibility(visibility) {
    updateReadyFeatureWarning(visibility);
    const container = document.getElementById('studentSkillsTableContainer');
    if (!container) return;
    ['الرابط', 'جاهز', 'الشواهد', 'الحالة'].forEach(col => {
        const show = visibility[col] !== false; // default: visible
        container.querySelectorAll(`[data-col="${col}"]`).forEach(el => {
            el.classList.toggle('hidden', !show);
        });
    });
}

function updateReadyFeatureWarning(visibility) {
    const warning = document.getElementById('readyFeatureDisabledWarning');
    if (!warning) return;
    const isDisabled = visibility['جاهز'] === false;
    warning.classList.toggle('hidden', !isDisabled);
}
// ==========================================

async function updateStatistics() {
    const result = await adminAPI.getStatistics();
    if (!result.success || !result.statistics) return;

    const stats = result.statistics;

    document.getElementById('totalStudentsCount').textContent = stats.totalStudents;
    document.getElementById('totalSkillsCount').textContent = stats.totalSkills;
    document.getElementById('completedSkillsCount').textContent = stats.completedSkills;
    document.getElementById('completionRate').textContent = stats.completionRate + '%';

    const csEl = document.getElementById('completedStudentsCount');
    if (csEl) csEl.textContent = stats.completedStudents ?? 0;
    const ttEl = document.getElementById('totalTestsCount');
    if (ttEl) ttEl.textContent = stats.totalTests ?? 0;
    const tpEl = document.getElementById('testPassRate');
    if (tpEl) tpEl.textContent = (stats.testPassRate ?? 0) + '%';
}

// Optimized version with caching
async function updateStatisticsOptimized() {
    // Check if cache is valid
    if (isCacheValid(statisticsCache)) {
        const stats = statisticsCache.data;
        document.getElementById('totalStudentsCount').textContent = stats.totalStudents;
        document.getElementById('totalSkillsCount').textContent = stats.totalSkills;
        document.getElementById('completedSkillsCount').textContent = stats.completedSkills;
        document.getElementById('completionRate').textContent = stats.completionRate + '%';
        return statisticsCache.data;
    }
    
    // Use request deduplication
    const result = await deduplicatedFetch('statistics', () => adminAPI.getStatistics());
    
    if (!result.success || !result.statistics) return null;

    const stats = result.statistics;
    
    // Update cache
    statisticsCache.data = stats;
    statisticsCache.timestamp = Date.now();

    document.getElementById('totalStudentsCount').textContent = stats.totalStudents;
    document.getElementById('totalSkillsCount').textContent = stats.totalSkills;
    document.getElementById('completedSkillsCount').textContent = stats.completedSkills;
    document.getElementById('completionRate').textContent = stats.completionRate + '%';

    const csEl = document.getElementById('completedStudentsCount');
    if (csEl) csEl.textContent = stats.completedStudents ?? 0;
    const ttEl = document.getElementById('totalTestsCount');
    if (ttEl) ttEl.textContent = stats.totalTests ?? 0;
    const tpEl = document.getElementById('testPassRate');
    if (tpEl) tpEl.textContent = (stats.testPassRate ?? 0) + '%';
    
    return stats;
}

// Student Dashboard
async function loadStudentDashboard(studentId) {
    const skillsResult = await studentAPI.getSkills();
    
    if (!skillsResult.success || !skillsResult.data) {
        return;
    }

    const totalSkills = skillsResult.data.totalSkills;
    const completedSkills = skillsResult.data.completedSkills;
    const completionRate = skillsResult.data.completionRate;

    // Update dashboard stats
    document.getElementById('dashTotalSkills').textContent = totalSkills;
    document.getElementById('dashCompletedSkills').textContent = completedSkills;
    document.getElementById('dashCompletionRate').textContent = completionRate + '%';

    // Award and display badges
    const earnedBadges = checkAndAwardBadges(totalSkills, completedSkills, skillsResult.data.skills);
    renderBadges(earnedBadges);
}

function viewMySkills() {
    document.getElementById('studentDashboardView').classList.add('hidden');
    document.getElementById('skillsDetailView').classList.remove('hidden');
    renderStudentSkillsFromDB(selectedStudentId);
}

// Achievement Badges System
const BADGES = [
    { id: 'first_skill', name: 'البداية', icon: '🌟', description: 'أول مهارة', requirement: 1 },
    { id: 'five_skills', name: 'المجتهد', icon: '⭐', description: '5 مهارات', requirement: 5 },
    { id: 'ten_skills', name: 'المثابر', icon: '🔥', description: '10 مهارات', requirement: 10 },
    { id: 'twenty_skills', name: 'النجم', icon: '💫', description: '20 مهارة', requirement: 20 },
    { id: 'half_complete', name: 'في منتصف الطريق', icon: '🎯', description: '50% إنجاز', requirement: 50, isPercentage: true },
    { id: 'most_complete', name: 'شبه مكتمل', icon: '🏅', description: '75% إنجاز', requirement: 75, isPercentage: true },
    { id: 'perfect', name: 'التميز المطلق', icon: '👑', description: '100% إنجاز', requirement: 100, isPercentage: true },
    { id: 'fast_learner', name: 'سريع التعلم', icon: '⚡', description: '10 مهارات في يوم', requirement: 10, isDaily: true }
];

function checkAndAwardBadges(totalSkills, completedSkills, skillsData) {
    const earnedBadges = [];
    const completionRate = totalSkills > 0 ? (completedSkills / totalSkills) * 100 : 0;

    BADGES.forEach(badge => {
        if (badge.isPercentage) {
            if (completionRate >= badge.requirement) {
                earnedBadges.push(badge);
            }
        } else {
            if (completedSkills >= badge.requirement) {
                earnedBadges.push(badge);
            }
        }
    });

    return earnedBadges;
}

function renderBadges(earnedBadges) {
    const container = document.getElementById('badgesContainer');
    if (!container) return;

    container.innerHTML = '';

    BADGES.forEach(badge => {
        const isEarned = earnedBadges.some(b => b.id === badge.id);
        const div = document.createElement('div');
        div.className = `text-center p-3 rounded-lg border-2 transition ${isEarned ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-slate-50 opacity-40'}`;
        div.innerHTML = `
            <div class="text-3xl mb-1 ${isEarned ? 'badge-unlock' : ''}">${badge.icon}</div>
            <div class="text-xs font-bold ${isEarned ? 'text-indigo-700' : 'text-slate-400'}">${badge.name}</div>
            <div class="text-xs ${isEarned ? 'text-slate-600' : 'text-slate-400'}">${badge.description}</div>
        `;
        container.appendChild(div);
    });

    if (earnedBadges.length === 0) {
        container.innerHTML = '<div class="col-span-full text-center text-slate-400 py-4">ابدأ بإكمال المهارات لفتح الإنجازات!</div>';
    }
}

// Simple Student View (Single Page)
async function loadSimpleStudentView(studentId, showLoading = true) {
    const loadingEl = document.getElementById('studentSkillsLoading');
    const tableContainer = document.getElementById('studentSkillsTableContainer');

    // Always keep table hidden until visibility is applied (prevents any flash)
    if (tableContainer) tableContainer.classList.add('hidden');
    if (showLoading && loadingEl) loadingEl.classList.remove('hidden');

    // Fetch skills, templates AND column visibility all in parallel
    const [skillTemplatesMap, skillsResult, visibility] = await Promise.all([
        getSkillTemplatesMap(),
        studentAPI.getSkills(),
        getColumnVisibility()
    ]);

    // Hide loading indicator — table stays hidden until after visibility is applied below
    if (loadingEl) loadingEl.classList.add('hidden');
    
    // Check if student was deleted
    if (skillsResult.student_deleted === true) {
        // Set logging out flag to prevent polling alerts
        isLoggingOut = true;
        
        // Stop session validation and logout
        if (typeof stopStudentSessionValidation === 'function') {
            stopStudentSessionValidation();
        }
        
        // Logout without re-triggering alerts
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
            skillsResult.message || "تم حذف حسابك من قبل المعلم. يرجى التواصل مع معلمك للمزيد من المعلومات.",
            { 
                icon: '⚠️', 
                title: 'تم حذف الحساب',
                confirmText: 'حسناً'
            }
        );
        return;
    }
    
    if (!skillsResult.success || !skillsResult.data) {
        if (tableContainer) tableContainer.classList.remove('hidden');
        return;
    }

    const totalSkills = skillsResult.data.totalSkills;
    const completedSkills = skillsResult.data.completedSkills;
    const completionRate = skillsResult.data.completionRate;

    // Update stats
    document.getElementById('studentTotalSkills').textContent = totalSkills;
    document.getElementById('studentCompletedSkills').textContent = completedSkills;
    document.getElementById('studentCompletionRate').textContent = completionRate + '%';

    // Award and display badges
    const earnedBadges = checkAndAwardBadges(totalSkills, completedSkills, skillsResult.data.skills);
    renderSimpleBadges(earnedBadges);

    // Render skills table with templates
    renderSimpleSkillsTable(skillsResult.data.skills, skillTemplatesMap);

    // Apply column visibility BEFORE revealing the table — zero flash guaranteed
    applyStudentColumnVisibility(visibility);
    if (tableContainer) tableContainer.classList.remove('hidden');

    // Load announcements for this student
    if (typeof loadStudentAnnouncements === 'function') {
        loadStudentAnnouncements(studentId);
    }

    // Show pending test result banner from sessionStorage
    const pendingResult = sessionStorage.getItem('pendingTestResult');
    if (pendingResult) {
        try {
            showTestResultBanner(JSON.parse(pendingResult));
        } catch(e) {}
        sessionStorage.removeItem('pendingTestResult');
    }
}

// Helper function to get skill templates map with caching
async function getSkillTemplatesMap() {
    if (isCacheValid(skillTemplatesCache) && skillTemplatesCache.data.length > 0) {
        const map = {};
        skillTemplatesCache.data.forEach(t => {
            map[t.name] = t;
        });
        return map;
    }
    
    try {
        const templatesResponse = await fetch('/api/skill-templates?is_active=true', {
            headers: isAdmin ? {
                'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
            } : {}
        });
        
        if (templatesResponse.ok) {
            const templatesData = await templatesResponse.json();
            const templates = templatesData.templates || [];
            
            // Update cache
            skillTemplatesCache.data = templates;
            skillTemplatesCache.timestamp = Date.now();
            
            const map = {};
            templates.forEach(t => {
                map[t.name] = t;
            });
            return map;
        }
    } catch (e) {
        console.error('Error loading skill templates:', e);
    }
    
    return {};
}

function renderSimpleBadges(earnedBadges) {
    const container = document.getElementById('studentBadges');
    if (!container) return;

    container.innerHTML = '';

    BADGES.forEach(badge => {
        const isEarned = earnedBadges.some(b => b.id === badge.id);
        const div = document.createElement('div');
        div.className = `text-center p-3 rounded-lg border-2 transition ${isEarned ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-slate-50 opacity-40'}`;
        div.innerHTML = `
            <div class="text-3xl mb-1 ${isEarned ? 'badge-unlock' : ''}">${badge.icon}</div>
            <div class="text-xs font-bold ${isEarned ? 'text-indigo-700' : 'text-slate-400'}">${badge.name}</div>
            <div class="text-xs ${isEarned ? 'text-slate-600' : 'text-slate-400'}">${badge.description}</div>
        `;
        container.appendChild(div);
    });

    if (earnedBadges.length === 0) {
        container.innerHTML = '<div class="col-span-full text-center text-slate-400 py-4">ابدأ بإكمال المهارات لفتح الإنجازات!</div>';
    }
}

function renderSimpleSkillsTable(skills, skillTemplatesMap = {}) {
    const tbody = document.getElementById('studentSkillsTable');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!skills || skills.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-10 text-center text-slate-400">لا توجد مهارات مضافة حتى الآن</td></tr>`;
        return;
    }

    skills.forEach((skill) => {
        const row = document.createElement('tr');
        row.className = "border-b border-slate-100";

        const skillName = skill.name || 'مهارة بدون عنوان';
        const skillUrl = skill.description || '#';
        const isDone = skill.level === 3 || skill.level === 2;
        
        // Get icon from template if available
        const template = skillTemplatesMap[skillName];
        const skillLinkIcon = getSkillLinkIcon(template?.icon || 'file');

        const statusText = isDone ? 'تم إنجازها' : 'لم تكتمل';
        const statusColor = isDone ? 'text-green-600' : 'text-red-400';

        // Evidence display for students
        const evidenceCount = skill.evidence_count || 0;
        const firstEvidenceUrl = skill.first_evidence_url;
        const evidenceHtml = evidenceCount > 0 && firstEvidenceUrl ? 
            `<button onclick="viewSkillEvidenceStudent('${skill.id}')" class="relative hover:scale-105 transition-transform" title="عرض الشواهد">
                <img src="${firstEvidenceUrl}" alt="شاهد" class="w-12 h-16 object-cover rounded border-2 border-slate-300" 
                     oncontextmenu="return false;" ondragstart="return false;" style="user-select: none;">
                ${evidenceCount > 1 ? `<span class="absolute -top-2 -right-2 bg-indigo-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">${evidenceCount}</span>` : ''}
            </button>` : 
            `<span class="text-slate-300 text-xl">—</span>`;

        // Student ready checkbox
        const isStudentReady = skill.is_student_ready || false;

        row.innerHTML = `
            <td data-col="المهارة" class="p-2 sm:p-4 text-slate-700 text-xs sm:text-base">
                <span>${skillName}</span>
            </td>
            <td data-col="الرابط" class="p-2 sm:p-4 text-center">
                <a href="${skillUrl}" target="_blank" class="hover:scale-110 transition-transform inline-block" title="فتح الرابط">
                    ${skillLinkIcon}
                </a>
            </td>
            <td data-col="جاهز" class="p-2 sm:p-4 text-center">
                <input type="checkbox" id="ready_simple_${skill.id}" ${isStudentReady ? 'checked' : ''}
                    onchange="handleSkillReadyChange('${skill.id}', this.checked)"
                    class="w-5 h-5 accent-green-500 cursor-pointer rounded"
                    title="ضع علامة إذا كنت جاهزاً لهذه المهارة">
            </td>
            <td data-col="الشواهد" class="p-2 sm:p-4 text-center">
                ${evidenceHtml}
            </td>
            <td data-col="الحالة" class="p-2 sm:p-4 text-center">
                <span class="${statusColor} font-bold text-xs sm:text-sm">
                    ${statusText}
                </span>
            </td>
            <td data-col="الاختبار" class="p-2 sm:p-4 text-center">
                ${isDone
                    ? `<span class="text-green-600 font-bold text-xs">✅ تم</span>`
                    : template && (template.question_count > 0)
                        ? `<button onclick="openTestConfirmModal('${skill.id}', '${skillName.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')" class="bg-purple-100 hover:bg-purple-200 text-purple-700 px-2 py-1 rounded text-xs font-medium transition">📝 قم بالإختبار</button>`
                        : `<span class="text-slate-400 text-xs">لا يوجد اختبار</span>`
                }
            </td>
        `;
        tbody.appendChild(row);
    });
}
// ----- Test Result Banner -----

function showTestResultBanner(result) {
    const container = document.getElementById('studentSkillsTableContainer');
    if (!container) return;

    const existing = document.getElementById('testResultBanner');
    if (existing) existing.remove();

    const passed = result.passed;
    const score = result.score ?? 0;
    const skillName = result.skill_name || '';
    const remaining = result.remaining_attempts ?? 0;

    const banner = document.createElement('div');
    banner.id = 'testResultBanner';
    banner.className = `mb-4 p-4 rounded-xl border-2 text-center ${passed ? 'bg-green-50 border-green-300 text-green-800' : remaining > 0 ? 'bg-yellow-50 border-yellow-300 text-yellow-800' : 'bg-red-50 border-red-300 text-red-800'}`;
    banner.innerHTML = `
        <div class="text-2xl mb-1">${passed ? '🎉' : remaining > 0 ? '💪' : '❌'}</div>
        <div class="font-bold text-base">${skillName ? `<span class="block text-sm font-normal mb-1 opacity-75">${skillName}</span>` : ''}${result.message || (passed ? 'أحسنت! اجتزت الاختبار' : 'لم تجتز الاختبار')}</div>
        <div class="text-sm mt-1">النتيجة: <strong>${score}/10</strong></div>
        <button onclick="this.parentElement.remove()" class="mt-2 text-xs underline opacity-60 hover:opacity-100">إغلاق</button>
    `;
    container.insertAdjacentElement('beforebegin', banner);
}

// ----- Ready Students by Skill -----

async function populateReadySkillSelect() {
    const select = document.getElementById('readySkillSelect');
    const testSelect = document.getElementById('testStatsSkillSelect');
    if (!select && !testSelect) return;

    try {
        const response = await fetch('/api/skill-templates?is_active=true', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
        });
        const data = await response.json();
        if (!data.success) return;

        const templates = data.templates || [];
        if (select) {
            select.innerHTML = '<option value="">-- اختر المهارة --</option>' +
                templates.map(t => `<option value="${t.name.replace(/"/g, '&quot;')}">${t.name}</option>`).join('');
        }
        if (testSelect) {
            testSelect.innerHTML = '<option value="">-- اختر المهارة --</option>' +
                templates.map(t => `<option value="${t.id}" data-name="${t.name.replace(/"/g, '&quot;')}">${t.name}</option>`).join('');
        }
    } catch (e) {
        console.error('Error loading skills for ready-select:', e);
    }
}

// Tracks the currently active tab ('ready' | 'notready')
let _currentReadyTab = 'ready';
// Unused legacy var kept to avoid reference errors in case any external code references it
let _currentNotReadyStudents = [];
let _currentTabStudents = [];

async function loadReadyStudentsForSkill() {
    const select = document.getElementById('readySkillSelect');
    const container = document.getElementById('readyStudentsList');
    if (!select || !container) return;

    const skillName = select.value.trim();
    if (!skillName) {
        container.innerHTML = '<p class="text-slate-400 text-sm text-center py-3">اختر مهارة من القائمة لعرض النتائج</p>';
        return;
    }

    container.innerHTML = '<p class="text-slate-500 text-sm text-center py-3">⏳ جاري التحميل...</p>';

    const result = await adminAPI.getAllStudentsBySkill(skillName);

    if (!result.success) {
        container.innerHTML = `<p class="text-red-500 text-sm text-center py-3">${result.message || 'خطأ في جلب البيانات'}</p>`;
        return;
    }

    window._cachedReadyArr = result.ready || [];
    window._cachedNotReadyArr = result.not_ready || [];
    window._currentReadySkillName = skillName;

    const readyCount = window._cachedReadyArr.length;
    const notReadyCount = window._cachedNotReadyArr.length;

    container.innerHTML = `
        <div class="flex gap-1 bg-slate-100 rounded-lg p-1">
            <button id="tabReady" onclick="_switchReadyTab('ready')"
                class="flex-1 py-1.5 rounded-md text-sm font-medium transition bg-white shadow text-green-700">
                الجاهزون <span class="bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded-full ml-1">${readyCount}</span>
            </button>
            <button id="tabNotReady" onclick="_switchReadyTab('notready')"
                class="flex-1 py-1.5 rounded-md text-sm font-medium transition text-slate-500">
                غير الجاهزين <span class="bg-red-100 text-red-500 text-xs px-1.5 py-0.5 rounded-full ml-1">${notReadyCount}</span>
            </button>
        </div>
        <div id="readyTabContent" class="mt-3"></div>
    `;

    _switchReadyTab(_currentReadyTab === 'ready' ? 'ready' : 'notready');
}

function _switchReadyTab(tab) {
    _currentReadyTab = tab;
    const content = document.getElementById('readyTabContent');
    const tabReadyBtn = document.getElementById('tabReady');
    const tabNotReadyBtn = document.getElementById('tabNotReady');
    if (!content) return;

    if (tabReadyBtn) tabReadyBtn.className = tab === 'ready'
        ? 'flex-1 py-1.5 rounded-md text-sm font-medium transition bg-white shadow text-green-700'
        : 'flex-1 py-1.5 rounded-md text-sm font-medium transition text-slate-500';
    if (tabNotReadyBtn) tabNotReadyBtn.className = tab === 'notready'
        ? 'flex-1 py-1.5 rounded-md text-sm font-medium transition bg-white shadow text-red-600'
        : 'flex-1 py-1.5 rounded-md text-sm font-medium transition text-slate-500';

    const students = tab === 'ready' ? (window._cachedReadyArr || []) : (window._cachedNotReadyArr || []);
    const isReady = tab === 'ready';
    const bg = isReady ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';
    const icon = isReady ? '✅' : '❌';
    const toggleSelActiveCls = isReady
        ? 'bg-red-600 hover:bg-red-700 text-white'
        : 'bg-green-600 hover:bg-green-700 text-white';
    const toggleSelLabel = isReady ? '✖ تحويل المحددين لغير جاهز (0)' : '✔ تحويل المحددين لجاهز (0)';

    if (students.length === 0) {
        content.innerHTML = `<p class="text-slate-400 text-sm text-center py-8">${isReady ? 'لا يوجد طلاب جاهزون لهذه المهارة' : '🎉 جميع الطلاب جاهزون!'}</p>`;
        return;
    }

    content.innerHTML = `
        <div class="flex flex-wrap items-center gap-2 mb-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
            <label class="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                <input type="checkbox" id="selectAllReady" onchange="_toggleSelectAll(this)"
                    class="w-4 h-4 accent-indigo-500 rounded cursor-pointer">
                تحديد الكل
            </label>
            <div class="flex-1"></div>
            <button onclick="_copyCurrentTabNames()"
                class="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs transition">
                📋 نسخ الأسماء
            </button>
            <button id="toggleSelectedBtn" onclick="_toggleSelectedInCurrentTab()" disabled
                class="bg-slate-300 text-slate-500 px-3 py-1.5 rounded-lg text-xs font-medium cursor-not-allowed"
                data-active-cls="${toggleSelActiveCls}">
                ${toggleSelLabel}
            </button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            ${students.map(s => `
                <label class="flex items-center gap-3 p-3 ${bg} border rounded-lg cursor-pointer hover:opacity-80 transition select-none">
                    <input type="checkbox" class="ready-check w-4 h-4 accent-indigo-500 rounded cursor-pointer flex-shrink-0"
                        data-skill-id="${s.skill_id}" onchange="_onReadyCheckChange()">
                    <span class="text-lg flex-shrink-0">${icon}</span>
                    <div class="min-w-0">
                        <p class="font-semibold text-sm text-slate-800 truncate">${s.name}</p>
                        <p class="text-xs text-slate-500">رقم: ${s.code}${s.class ? ' | ' + s.class : ''}</p>
                    </div>
                </label>`).join('')}
        </div>
    `;
}

function _onReadyCheckChange() {
    const allChecks = document.querySelectorAll('.ready-check');
    const checkedCount = document.querySelectorAll('.ready-check:checked').length;
    const btn = document.getElementById('toggleSelectedBtn');
    const masterCb = document.getElementById('selectAllReady');
    if (!btn) return;

    if (checkedCount === 0) {
        btn.disabled = true;
        btn.className = 'bg-slate-300 text-slate-500 px-3 py-1.5 rounded-lg text-xs font-medium cursor-not-allowed';
        const base = _currentReadyTab === 'ready' ? '✖ تحويل المحددين لغير جاهز' : '✔ تحويل المحددين لجاهز';
        btn.textContent = `${base} (0)`;
    } else {
        btn.disabled = false;
        const activeCls = btn.dataset.activeCls;
        btn.className = `${activeCls} px-3 py-1.5 rounded-lg text-xs font-medium transition`;
        const base = _currentReadyTab === 'ready' ? '✖ تحويل المحددين لغير جاهز' : '✔ تحويل المحددين لجاهز';
        btn.textContent = `${base} (${checkedCount})`;
    }

    if (masterCb) {
        masterCb.checked = checkedCount === allChecks.length && allChecks.length > 0;
        masterCb.indeterminate = checkedCount > 0 && checkedCount < allChecks.length;
    }
}

function _toggleSelectAll(masterCb) {
    document.querySelectorAll('.ready-check').forEach(cb => { cb.checked = masterCb.checked; });
    _onReadyCheckChange();
}

async function _toggleSelectedInCurrentTab() {
    const checked = [...document.querySelectorAll('.ready-check:checked')];
    if (checked.length === 0) return;
    const newIsReady = _currentReadyTab !== 'ready';
    await _bulkToggleStudents(checked.map(cb => cb.dataset.skillId), newIsReady);
}

async function _bulkToggleStudents(skillIds, newIsReady) {
    if (skillIds.length === 0) return;
    const content = document.getElementById('readyTabContent');
    if (content) content.style.opacity = '0.5';
    const container = document.getElementById('readyStudentsList');
    const loadingMsg = document.createElement('p');
    loadingMsg.className = 'text-xs text-slate-500 text-center mt-2';
    loadingMsg.textContent = '⏳ جاري التحديث...';
    if (content) content.appendChild(loadingMsg);

    try {
        const result = await adminAPI.batchSetSkillReady(skillIds, newIsReady);
        if (!result.success) {
            showToast(result.message || 'خطأ أثناء التحديث', { type: 'error' });
        } else {
            const msg = newIsReady
                ? `تم تحويل ${result.updated} طالب إلى جاهز`
                : `تم تحويل ${result.updated} طالب إلى غير جاهز`;
            showToast(msg, { type: 'success' });
        }
    } catch (e) {
        showToast('خطأ أثناء التحديث', { type: 'error' });
    }

    // Reload and stay on same tab
    await loadReadyStudentsForSkill();
}

function _copyCurrentTabNames() {
    const students = _currentReadyTab === 'ready' ? (window._cachedReadyArr || []) : (window._cachedNotReadyArr || []);
    if (!students || students.length === 0) {
        showToast('لا توجد أسماء للنسخ', { type: 'info' });
        return;
    }
    navigator.clipboard.writeText(students.map(s => s.name).join('\n'))
        .then(() => showToast(`تم نسخ ${students.length} اسم`, { type: 'success' }))
        .catch(() => showToast('تعذر النسخ — جرب مرة أخرى', { type: 'error' }));
}

// ----- Test Stats by Skill -----

async function loadTestStatsForSkill() {
    const select = document.getElementById('testStatsSkillSelect');
    const container = document.getElementById('testStatsList');
    if (!select || !container) return;

    const templateId = select.value.trim();
    if (!templateId) {
        container.innerHTML = '<p class="text-slate-400 text-sm text-center py-3">اختر مهارة من القائمة لعرض النتائج</p>';
        return;
    }

    container.innerHTML = '<p class="text-slate-500 text-sm text-center py-3">⏳ جاري التحميل...</p>';

    const result = await adminAPI.getTestStats(templateId);

    if (!result.success) {
        container.innerHTML = `<p class="text-red-500 text-sm text-center py-3">${result.message || 'خطأ في جلب البيانات'}</p>`;
        return;
    }

    const students = result.students || [];
    const maxAttempts = result.max_test_attempts || 3;

    if (students.length === 0) {
        container.innerHTML = '<p class="text-slate-400 text-sm text-center py-8">لا يوجد طلاب لديهم هذه المهارة</p>';
        return;
    }

    const attempted = students.filter(s => s.attempts_used > 0);
    const passed = students.filter(s => s.ever_passed);
    const failed = students.filter(s => s.attempts_used > 0 && !s.ever_passed);
    const notAttempted = students.filter(s => s.attempts_used === 0);
    const avgScore = attempted.length > 0
        ? (attempted.reduce((sum, s) => sum + (s.best_score || 0), 0) / attempted.length).toFixed(1)
        : '—';

    container.innerHTML = `
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div class="bg-indigo-50 rounded-lg p-3 text-center border border-indigo-100">
                <div class="text-2xl font-bold text-indigo-700">${students.length}</div>
                <div class="text-xs text-slate-500 mt-0.5">إجمالي الطلاب</div>
            </div>
            <div class="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
                <div class="text-2xl font-bold text-blue-700">${attempted.length}</div>
                <div class="text-xs text-slate-500 mt-0.5">حاولوا الاختبار</div>
            </div>
            <div class="bg-green-50 rounded-lg p-3 text-center border border-green-100">
                <div class="text-2xl font-bold text-green-700">${passed.length}</div>
                <div class="text-xs text-slate-500 mt-0.5">اجتازوا ✅</div>
            </div>
            <div class="bg-amber-50 rounded-lg p-3 text-center border border-amber-100">
                <div class="text-2xl font-bold text-amber-700">${avgScore}</div>
                <div class="text-xs text-slate-500 mt-0.5">متوسط أعلى نتيجة / 10</div>
            </div>
        </div>
        <div class="flex gap-1 bg-slate-100 rounded-lg p-1 mb-3">
            <button id="tsTabAll" onclick="_switchTestStatsTab('all')"
                class="flex-1 py-1.5 rounded-md text-sm font-medium transition bg-white shadow text-indigo-700">
                الكل <span class="bg-indigo-100 text-indigo-700 text-xs px-1.5 py-0.5 rounded-full ml-1">${students.length}</span>
            </button>
            <button id="tsTabPassed" onclick="_switchTestStatsTab('passed')"
                class="flex-1 py-1.5 rounded-md text-sm font-medium transition text-slate-500">
                اجتازوا <span class="bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded-full ml-1">${passed.length}</span>
            </button>
            <button id="tsTabFailed" onclick="_switchTestStatsTab('failed')"
                class="flex-1 py-1.5 rounded-md text-sm font-medium transition text-slate-500">
                لم يجتازوا <span class="bg-red-100 text-red-500 text-xs px-1.5 py-0.5 rounded-full ml-1">${failed.length}</span>
            </button>
            <button id="tsTabNone" onclick="_switchTestStatsTab('none')"
                class="flex-1 py-1.5 rounded-md text-sm font-medium transition text-slate-500">
                لم يحاولوا <span class="bg-slate-200 text-slate-600 text-xs px-1.5 py-0.5 rounded-full ml-1">${notAttempted.length}</span>
            </button>
        </div>
        <div id="testStatsContent"></div>
    `;

    window._cachedTestStatsStudents = students;
    window._cachedTestStatsMaxAttempts = maxAttempts;
    _switchTestStatsTab('all');
}

function _switchTestStatsTab(tab) {
    window._currentTestStatsTab = tab;
    const all = window._cachedTestStatsStudents || [];
    const maxAttempts = window._cachedTestStatsMaxAttempts || 3;

    const tabBtns = {
        all: { id: 'tsTabAll', activeCls: 'bg-white shadow text-indigo-700' },
        passed: { id: 'tsTabPassed', activeCls: 'bg-white shadow text-green-700' },
        failed: { id: 'tsTabFailed', activeCls: 'bg-white shadow text-red-600' },
        none: { id: 'tsTabNone', activeCls: 'bg-white shadow text-slate-600' }
    };
    Object.entries(tabBtns).forEach(([t, cfg]) => {
        const btn = document.getElementById(cfg.id);
        if (!btn) return;
        btn.className = `flex-1 py-1.5 rounded-md text-sm font-medium transition ${t === tab ? cfg.activeCls : 'text-slate-500'}`;
    });

    let filtered;
    if (tab === 'all') filtered = all;
    else if (tab === 'passed') filtered = all.filter(s => s.ever_passed);
    else if (tab === 'failed') filtered = all.filter(s => s.attempts_used > 0 && !s.ever_passed);
    else filtered = all.filter(s => s.attempts_used === 0);

    const container = document.getElementById('testStatsContent');
    if (!container) return;

    if (filtered.length === 0) {
        container.innerHTML = '<p class="text-slate-400 text-sm text-center py-8">لا يوجد طلاب في هذه الفئة</p>';
        return;
    }

    container.innerHTML = `<div class="space-y-2">${filtered.map(s => {
        const hasAttempts = s.attempts_used > 0;
        const score = hasAttempts ? (s.best_score ?? 0) : null;
        const pct = score !== null ? Math.round(score / 10 * 100) : 0;
        const barColor = score !== null && score >= 6 ? 'bg-green-500' : 'bg-red-400';

        const statusBadge = !hasAttempts
            ? '<span class="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">لم يحاول</span>'
            : s.ever_passed
                ? '<span class="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">✅ اجتاز</span>'
                : '<span class="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">❌ لم يجتز</span>';

        const attemptsLeft = Math.max(0, maxAttempts - s.attempts_used);
        const attemptsColor = attemptsLeft === 0 ? 'text-red-500' : attemptsLeft <= 1 ? 'text-amber-600' : 'text-slate-500';

        return `
            <div class="flex items-center gap-3 p-3 rounded-lg border ${s.ever_passed ? 'bg-green-50 border-green-200' : !hasAttempts ? 'bg-slate-50 border-slate-200' : 'bg-red-50 border-red-200'}">
                <div class="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0 select-none">
                    ${s.code || '?'}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-sm font-semibold text-slate-800">${_escHtml(s.student_name)}</span>
                        <span class="text-xs text-slate-400">#${s.code}</span>
                        ${statusBadge}
                    </div>
                    <div class="flex items-center gap-4 mt-1 text-xs ${attemptsColor}">
                        <span>المحاولات: <strong>${s.attempts_used}</strong> / ${maxAttempts}</span>
                        ${hasAttempts ? `<span class="text-slate-500">أعلى نتيجة: <strong class="text-slate-700">${score}/10</strong></span>` : ''}
                    </div>
                    ${hasAttempts ? `
                    <div class="flex items-center gap-2 mt-1.5">
                        <div class="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div class="h-full rounded-full ${barColor}" style="width:${pct}%"></div>
                        </div>
                        <span class="text-xs text-slate-500 w-8 text-right">${pct}%</span>
                    </div>` : ''}
                </div>
            </div>`;
    }).join('')}</div>`;
}
