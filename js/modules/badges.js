// Admin Badges Management Module

const BADGE_ICONS = [
    '🌟','⭐','🔥','💫','🏅','👑','🎯','🏆','🎖️','🥇','🥈','🥉',
    '💪','🚀','⚡','🌈','💎','🎓','📚','✨','🌸','🦁','🎨','🐉',
    '🎪','🎵','🌙','☀️','🍀','🌺','🦋','🦅','🏄','🎠','🎡','🎢'
];

const CRITERIA_LABELS = {
    skills_completed:  'عدد المهارات المكتملة (مستوى 2 أو 3)',
    completion_percent: 'نسبة الإنجاز الكلية (%)',
    tests_passed:      'عدد الاختبارات التي اجتازها',
    level3_skills:     'عدد المهارات بالمستوى الثالث',
    tests_attempted:   'عدد محاولات الاختبار (ناجح أو فاشل)',
    perfect_tests:     'اختبارات حصل فيها على علامة كاملة (10/10)',
    ready_actions:     'عدد مرات الضغط على زر "جاهز"',
    login_count:       'عدد مرات تسجيل الدخول'
};

let _editingBadgeId = null;

// ─── Load & Render ────────────────────────────────────────────────────────────

async function loadAdminBadges() {
    const container = document.getElementById('adminBadgesList');
    if (!container) return;
    container.innerHTML = '<div class="col-span-full text-center py-6 text-slate-400 text-sm">جاري التحميل...</div>';

    const result = await adminAPI.getBadges();
    if (!result.success) {
        container.innerHTML = `<div class="col-span-full text-center py-6 text-red-400 text-sm">${result.message}</div>`;
        return;
    }
    renderAdminBadges(result.badges);
    loadBadgeDisplayMode();
}

function renderAdminBadges(badges) {
    const container = document.getElementById('adminBadgesList');
    if (!container) return;
    container.innerHTML = '';

    if (!badges.length) {
        container.innerHTML = '<div class="col-span-full text-center py-6 text-slate-400 text-sm">لا توجد إنجازات. أضف إنجازاً جديداً!</div>';
        return;
    }

    badges.forEach(badge => {
        const card = document.createElement('div');
        card.className = 'flex items-center gap-3 p-3 border border-slate-200 rounded-xl bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 transition group';
        card.innerHTML = `
            <div class="text-4xl flex-shrink-0">${badge.icon}</div>
            <div class="flex-1 min-w-0">
                <div class="font-bold text-slate-800 text-sm truncate">${badge.name}</div>
                <div class="text-xs text-slate-500 truncate">${badge.description || CRITERIA_LABELS[badge.criteria_type] || ''}</div>
                <div class="text-xs text-indigo-600 mt-0.5">${_criteriaText(badge)}</div>
            </div>
            <div class="flex flex-col gap-1 flex-shrink-0">
                <button onclick="openEditBadgeModal(${JSON.stringify(badge).replace(/"/g, '&quot;')})"
                    class="text-xs bg-white border border-slate-300 hover:border-indigo-400 hover:text-indigo-600 px-2 py-1 rounded-lg transition">
                    ✏️ تعديل
                </button>
                <button onclick="confirmDeleteBadge('${badge.id}', '${badge.name.replace(/'/g, "\\'")}')"
                    class="text-xs bg-white border border-slate-300 hover:border-red-400 hover:text-red-600 px-2 py-1 rounded-lg transition">
                    🗑️ حذف
                </button>
            </div>
        `;
        container.appendChild(card);
    });
}

function _criteriaText(badge) {
    const v = badge.criteria_value;
    switch (badge.criteria_type) {
        case 'skills_completed':  return `أكمل ${v} مهارة`;
        case 'completion_percent': return `وصل إلى ${v}% من الإنجاز`;
        case 'tests_passed':      return `اجتاز ${v} اختبار`;
        case 'level3_skills':     return `${v} مهارة بالمستوى 3`;
        case 'tests_attempted':   return `قام بـ ${v} محاولة في الاختبارات`;
        case 'perfect_tests':     return `اجتاز ${v} اختبار بعلامة كاملة`;
        case 'ready_actions':     return `ضغط "جاهز" ${v} مرة`;
        case 'login_count':       return `سجّل دخول ${v} مرة`;
        default: return `القيمة: ${v}`;
    }
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function openAddBadgeModal() {
    _editingBadgeId = null;
    document.getElementById('badgeModalTitle').textContent = 'إضافة إنجاز جديد';
    document.getElementById('badgeNameInput').value = '';
    document.getElementById('badgeDescInput').value = '';
    document.getElementById('badgeCriteriaType').value = 'skills_completed';
    document.getElementById('badgeCriteriaValue').value = '1';
    _selectBadgeIcon('🏅');
    document.getElementById('badgeModal').classList.remove('hidden');
    document.getElementById('badgeNameInput').focus();
}

function openEditBadgeModal(badge) {
    _editingBadgeId = badge.id;
    document.getElementById('badgeModalTitle').textContent = 'تعديل الإنجاز';
    document.getElementById('badgeNameInput').value = badge.name;
    document.getElementById('badgeDescInput').value = badge.description || '';
    document.getElementById('badgeCriteriaType').value = badge.criteria_type;
    document.getElementById('badgeCriteriaValue').value = badge.criteria_value;
    _selectBadgeIcon(badge.icon);
    document.getElementById('badgeModal').classList.remove('hidden');
    document.getElementById('badgeNameInput').focus();
}

function closeBadgeModal() {
    document.getElementById('badgeModal').classList.add('hidden');
    _editingBadgeId = null;
}

function _selectBadgeIcon(icon) {
    document.getElementById('badgeSelectedIcon').textContent = icon;
    document.querySelectorAll('#badgeIconGrid button').forEach(btn => {
        btn.classList.toggle('ring-2', btn.dataset.icon === icon);
        btn.classList.toggle('ring-indigo-500', btn.dataset.icon === icon);
        btn.classList.toggle('bg-indigo-50', btn.dataset.icon === icon);
    });
}

function selectBadgeIcon(icon) {
    _selectBadgeIcon(icon);
}

function _buildIconGrid() {
    const grid = document.getElementById('badgeIconGrid');
    if (!grid || grid.children.length > 0) return;  // already built
    BADGE_ICONS.forEach(icon => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.icon = icon;
        btn.textContent = icon;
        btn.className = 'text-2xl p-1.5 rounded-lg border border-transparent hover:border-indigo-400 hover:bg-indigo-50 transition';
        btn.onclick = () => selectBadgeIcon(icon);
        grid.appendChild(btn);
    });
}

async function saveBadge() {
    const name = document.getElementById('badgeNameInput').value.trim();
    const icon = document.getElementById('badgeSelectedIcon').textContent.trim() || '🏅';
    const description = document.getElementById('badgeDescInput').value.trim();
    const criteria_type = document.getElementById('badgeCriteriaType').value;
    const criteria_value = parseInt(document.getElementById('badgeCriteriaValue').value, 10);

    if (!name) {
        showToast('أدخل اسم الإنجاز', { type: 'error' });
        document.getElementById('badgeNameInput').focus();
        return;
    }
    if (!criteria_value || criteria_value < 1) {
        showToast('أدخل قيمة صحيحة للمعيار', { type: 'error' });
        return;
    }

    const payload = { name, icon, description, criteria_type, criteria_value };
    const result = _editingBadgeId
        ? await adminAPI.updateBadge(_editingBadgeId, payload)
        : await adminAPI.createBadge(payload);

    if (result.success) {
        showToast(_editingBadgeId ? 'تم تحديث الإنجاز' : 'تم إضافة الإنجاز', { type: 'success' });
        closeBadgeModal();
        loadAdminBadges();
    } else {
        showToast(result.message || 'حدث خطأ', { type: 'error' });
    }
}

async function confirmDeleteBadge(id, name) {
    customConfirm(
        `هل أنت متأكد من حذف إنجاز "${name}"؟`,
        async () => {
            const result = await adminAPI.deleteBadge(id);
            if (result.success) {
                showToast('تم حذف الإنجاز', { type: 'success' });
                loadAdminBadges();
            } else {
                showToast(result.message || 'حدث خطأ أثناء الحذف', { type: 'error' });
            }
        },
        { icon: '🗑️', title: 'حذف الإنجاز', confirmText: 'حذف', cancelText: 'إلغاء' }
    );
}

async function confirmDeleteAllBadges() {
    customConfirm(
        'سيتم حذف جميع الإنجازات نهائياً. هل أنت متأكد؟',
        async () => {
            const result = await adminAPI.deleteAllBadges();
            if (result.success) {
                showToast('تم حذف جميع الإنجازات', { type: 'success' });
                loadAdminBadges();
            } else {
                showToast(result.message || 'حدث خطأ أثناء الحذف', { type: 'error' });
            }
        },
        { icon: '🗑️', title: 'حذف جميع الإنجازات', confirmText: 'حذف الكل', cancelText: 'إلغاء' }
    );
}

// Build icon grid when DOM is ready (called once at page load)
document.addEventListener('DOMContentLoaded', _buildIconGrid);

// ─── Badge Display Mode ───────────────────────────────────────────────────────

async function loadBadgeDisplayMode() {
    try {
        const res = await fetch('/api/settings/badge-display-mode');
        const data = await res.json();
        _applyBadgeDisplayModeUI(data.success ? (data.mode || 'show_all') : 'show_all');
    } catch {
        _applyBadgeDisplayModeUI('show_all');
    }
}

function _applyBadgeDisplayModeUI(mode) {
    document.querySelectorAll('.bdm-btn').forEach(btn => {
        const isActive = btn.id === `bdm-${mode}`;
        btn.className = btn.className
            .replace(/bg-indigo-600 text-white border-indigo-600/g, '')
            .replace(/bg-white text-slate-600 border-slate-300/g, '')
            .trim();
        if (isActive) {
            btn.classList.add('bg-indigo-600', 'text-white', 'border-indigo-600');
        } else {
            btn.classList.add('bg-white', 'text-slate-600', 'border-slate-300');
        }
    });
}

async function setBadgeDisplayMode(mode) {
    _applyBadgeDisplayModeUI(mode); // optimistic update
    window._badgeDisplayModeCache = mode;
    const result = await adminAPI.updateBadgeDisplayMode(mode);
    if (!result.success) {
        showToast(result.message || 'حدث خطأ أثناء الحفظ', { type: 'error' });
    } else {
        showToast('تم تحديث طريقة العرض', { type: 'success' });
    }
}
