// Dashboard and Statistics Functions

async function updateStatistics() {
    const result = await adminAPI.getStatistics();
    if (!result.success || !result.statistics) return;

    const stats = result.statistics;

    document.getElementById('totalStudentsCount').textContent = stats.totalStudents;
    document.getElementById('totalSkillsCount').textContent = stats.totalSkills;
    document.getElementById('completedSkillsCount').textContent = stats.completedSkills;
    document.getElementById('completionRate').textContent = stats.completionRate + '%';
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
    // Show loading indicator
    if (showLoading) {
        const loadingEl = document.getElementById('studentSkillsLoading');
        const tableContainer = document.getElementById('studentSkillsTableContainer');
        if (loadingEl && tableContainer) {
            loadingEl.classList.remove('hidden');
            tableContainer.classList.add('hidden');
        }
    }
    
    // Use cached skill templates
    const skillTemplatesMap = await getSkillTemplatesMap();
    
    const skillsResult = await studentAPI.getSkills();
    
    // Hide loading indicator
    if (showLoading) {
        const loadingEl = document.getElementById('studentSkillsLoading');
        const tableContainer = document.getElementById('studentSkillsTableContainer');
        if (loadingEl && tableContainer) {
            loadingEl.classList.add('hidden');
            tableContainer.classList.remove('hidden');
        }
    }
    
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
        tbody.innerHTML = `<tr><td colspan="4" class="p-10 text-center text-slate-400">لا توجد مهارات مضافة حتى الآن</td></tr>`;
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
        const skillIcon = template?.icon || '📚';

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
                <span class="${statusColor} font-bold text-xs sm:text-sm">
                    ${statusText}
                </span>
            </td>
        `;
        tbody.appendChild(row);
    });
}
