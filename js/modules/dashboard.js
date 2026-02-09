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
async function loadSimpleStudentView(studentId) {
    // Load skill templates to get icons
    let skillTemplatesMap = {};
    try {
        const templatesResponse = await fetch('/api/skill-templates?is_active=true');
        if (templatesResponse.ok) {
            const templatesData = await templatesResponse.json();
            const templates = templatesData.templates || [];
            templates.forEach(t => {
                skillTemplatesMap[t.name] = t;
            });
        }
    } catch (e) {
        console.error('Error loading skill templates:', e);
    }
    
    const skillsResult = await studentAPI.getSkills();
    
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
        tbody.innerHTML = `<tr><td colspan="3" class="p-10 text-center text-slate-400">لا توجد مهارات مضافة حتى الآن</td></tr>`;
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

        const statusText = isDone ? '✅ تم' : '❌ لم تكتمل';
        const statusColor = isDone ? 'text-green-600' : 'text-red-400';

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
                <span class="${statusColor} font-bold text-xs sm:text-sm">
                    ${statusText}
                </span>
            </td>
        `;
        tbody.appendChild(row);
    });
}
