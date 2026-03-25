// Student Notes and Activity Feed Functions

function showStudentNotesModal() {
    if (!selectedStudent || !isAdmin) return;

    currentStudentForNotes = selectedStudent;
    const modal = document.getElementById('studentNotesModal');
    const studentName = document.getElementById('notesStudentName');
    const notesText = document.getElementById('studentNotesText');

    studentName.textContent = `ملاحظات عن: ${selectedStudent.name}`;
    
    // Load existing notes from localStorage
    const notes = localStorage.getItem(`student_notes_${selectedStudent.id}`) || '';
    notesText.value = notes;

    modal.classList.remove('hidden');
    notesText.focus();

    // Close on background click
    modal.onclick = function(e) {
        if (e.target === modal) {
            closeStudentNotesModal();
        }
    };
}

function closeStudentNotesModal() {
    document.getElementById('studentNotesModal').classList.add('hidden');
    currentStudentForNotes = null;
}

async function saveStudentNotes() {
    if (!currentStudentForNotes) return;

    const button = event?.target || document.querySelector('button[onclick="saveStudentNotes()"]');
    if (button) setButtonLoading(button, true);

    const notesText = document.getElementById('studentNotesText').value;
    localStorage.setItem(`student_notes_${currentStudentForNotes.id}`, notesText);

    // Small delay to show the loading state
    await new Promise(resolve => setTimeout(resolve, 300));

    if (button) setButtonLoading(button, false);

    // Close the modal first
    closeStudentNotesModal();

    // Then show success message
    showToast("تم حفظ الملاحظات بنجاح", { 
        title: 'تم الحفظ',
        type: 'success'
    });
}

async function loadRecentActivity() {
    await _fetchAndRenderActivities(true);
}

// ─── Activity feed filter state ───────────────────────────────────────────────
const _activityFilters = {
    type: 'all',
    date_from: '',
    date_to: '',
    student: '',
    limit: 20,
};
let _activitySearchDebounce = null;

// ─── Public API ───────────────────────────────────────────────────────────────

function refreshActivityFeed() {
    activitiesCache.data = null;
    activitiesCache.timestamp = 0;
    _fetchAndRenderActivities(true);
}

function setActivityTypeFilter(type) {
    _activityFilters.type = type;
    _activityFilters.limit = 20;          // reset pagination on new filter

    // Update chip active state
    document.querySelectorAll('.activity-type-chip').forEach(btn => {
        btn.classList.toggle('activity-chip-active', btn.dataset.type === type);
    });

    _updateClearBtnVisibility();
    activitiesCache.data = null;
    activitiesCache.timestamp = 0;
    _fetchAndRenderActivities(true);
}

function onActivityFilterChange() {
    _activityFilters.date_from = document.getElementById('activityDateFrom')?.value || '';
    _activityFilters.date_to   = document.getElementById('activityDateTo')?.value   || '';
    _activityFilters.limit = 20;
    _updateClearBtnVisibility();
    activitiesCache.data = null;
    activitiesCache.timestamp = 0;
    _fetchAndRenderActivities(true);
}

function onActivitySearchInput() {
    clearTimeout(_activitySearchDebounce);
    _activitySearchDebounce = setTimeout(() => {
        _activityFilters.student = document.getElementById('activityStudentSearch')?.value?.trim() || '';
        _activityFilters.limit = 20;
        _updateClearBtnVisibility();
        activitiesCache.data = null;
        activitiesCache.timestamp = 0;
        _fetchAndRenderActivities(true);
    }, 350);
}

function loadMoreActivities() {
    const btn = document.getElementById('activityLoadMoreBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-indigo-400 border-t-transparent align-middle"></span>';
    }
    _activityFilters.limit += 20;
    activitiesCache.data = null;
    activitiesCache.timestamp = 0;
    _fetchAndRenderActivities(false).finally(() => {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '⬇ تحميل المزيد';
        }
    });
}

function clearActivityFilters() {
    _activityFilters.type      = 'all';
    _activityFilters.date_from = '';
    _activityFilters.date_to   = '';
    _activityFilters.student   = '';
    _activityFilters.limit     = 20;

    // Reset UI controls
    const fromEl = document.getElementById('activityDateFrom');
    const toEl   = document.getElementById('activityDateTo');
    const srEl   = document.getElementById('activityStudentSearch');
    if (fromEl) fromEl.value = '';
    if (toEl)   toEl.value   = '';
    if (srEl)   srEl.value   = '';

    document.querySelectorAll('.activity-type-chip').forEach(btn => {
        btn.classList.toggle('activity-chip-active', btn.dataset.type === 'all');
    });

    _updateClearBtnVisibility();
    activitiesCache.data = null;
    activitiesCache.timestamp = 0;
    _fetchAndRenderActivities(true);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function _updateClearBtnVisibility() {
    const hasFilter = _activityFilters.type !== 'all'
        || _activityFilters.date_from
        || _activityFilters.date_to
        || _activityFilters.student;
    const btn = document.getElementById('activityClearFiltersBtn');
    if (btn) btn.classList.toggle('hidden', !hasFilter);
}

async function _fetchAndRenderActivities(showLoader) {
    const container = document.getElementById('recentActivityList');
    if (!container) return;

    if (showLoader) {
        container.innerHTML = '<div class="text-center text-slate-400 py-6"><div class="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto"></div></div>';
    }

    const result = await adminAPI.getRecentActivities({
        type:      _activityFilters.type,
        date_from: _activityFilters.date_from,
        date_to:   _activityFilters.date_to,
        student:   _activityFilters.student,
        limit:     _activityFilters.limit,
    });

    if (!result.success || !result.activities || result.activities.length === 0) {
        container.innerHTML = '<div class="text-center text-slate-400 py-6">لا توجد نشاطات تطابق الفلاتر المحددة</div>';
        _updateCountBadge(0);
        _updateLoadMoreBtn(0);
        return;
    }

    const activities = result.activities;
    _updateCountBadge(activities.length);
    renderActivities(container, activities);
    _updateLoadMoreBtn(activities.length);
}

function _updateCountBadge(count) {
    const badge = document.getElementById('activityCountBadge');
    if (!badge) return;
    if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function _updateLoadMoreBtn(count) {
    const wrapper = document.getElementById('activityLoadMoreWrapper');
    if (!wrapper) return;
    // Show "load more" when we got a full page (meaning there might be more)
    wrapper.classList.toggle('hidden', count < _activityFilters.limit);
}

// Optimized version with caching (called by init/dashboard)
async function loadRecentActivityOptimized() {
    const container = document.getElementById('recentActivityList');
    if (!container) return null;

    if (isCacheValid(activitiesCache)) {
        renderActivities(container, activitiesCache.data);
        _updateCountBadge(activitiesCache.data.length);
        _updateLoadMoreBtn(activitiesCache.data.length);
        return activitiesCache.data;
    }

    container.innerHTML = '<div class="text-center text-slate-400 py-6"><div class="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto"></div></div>';

    const result = await deduplicatedFetch('activities', () => adminAPI.getRecentActivities({
        limit: _activityFilters.limit,
    }));

    if (!result.success || !result.activities || result.activities.length === 0) {
        container.innerHTML = '<div class="text-center text-slate-400 py-6">لا توجد نشاطات حديثة</div>';
        _updateCountBadge(0);
        _updateLoadMoreBtn(0);
        return null;
    }

    activitiesCache.data = result.activities;
    activitiesCache.timestamp = Date.now();

    renderActivities(container, result.activities);
    _updateCountBadge(result.activities.length);
    _updateLoadMoreBtn(result.activities.length);
    return result.activities;
}

// ─── Render ───────────────────────────────────────────────────────────────────

const _ACTIVITY_META = {
    login:     { icon: '🔐', badge: 'bg-blue-100 text-blue-700',   label: 'تسجيل دخول' },
    logout:    { icon: '🚪', badge: 'bg-slate-100 text-slate-600', label: 'تسجيل خروج' },
    ready:     { icon: '🙋', badge: 'bg-green-100 text-green-700', label: 'جاهز' },
    unready:   { icon: '↩️', badge: 'bg-red-100 text-red-600',     label: 'إلغاء جاهزية' },
    completed: { icon: '✅', badge: 'bg-indigo-100 text-indigo-700', label: 'إنجاز مهارة' },
};

function renderActivities(container, activities) {
    container.innerHTML = '';

    activities.forEach(activity => {
        const meta = _ACTIVITY_META[activity.type] || _ACTIVITY_META.completed;
        const timeAgo = getTimeAgo(activity.date);
        const exactDate = activity.date ? new Date(activity.date).toLocaleString('ar-SA', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        }) : '';

        let detail = '';
        if (activity.type === 'login' || activity.type === 'logout') {
            detail = `<span class="text-slate-500">رقم: ${_esc(activity.studentCode)}</span>`;
        } else if (activity.skillName) {
            const colorClass = activity.type === 'unready' ? 'text-red-500 hover:text-red-700' : 'text-indigo-600 hover:text-indigo-800';
            detail = `<button type="button" data-skill-name="${_esc(activity.skillName)}" onclick="scrollToSkillTemplate(this.dataset.skillName)" class="font-medium ${colorClass} underline decoration-dotted underline-offset-2 cursor-pointer transition" title="انتقل إلى المهارة في إدارة المهارات">${_esc(activity.skillName)}</button>`;
        }

        const div = document.createElement('div');
        div.className = 'flex items-start gap-3 p-2.5 hover:bg-slate-50 rounded-lg transition group';
        div.innerHTML = `
            <span class="text-lg flex-shrink-0 mt-0.5">${meta.icon}</span>
            <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-baseline gap-1.5">
                    <span class="font-semibold text-slate-800 text-sm">${_esc(activity.studentName)}</span>
                    <span class="text-xs px-1.5 py-0.5 rounded-full ${meta.badge} font-medium">${meta.label}</span>
                    ${detail ? `<span class="text-sm">${detail}</span>` : ''}
                </div>
                <div class="text-xs text-slate-400 mt-0.5" title="${exactDate}">${timeAgo}</div>
            </div>
        `;
        container.appendChild(div);
    });
}

function _esc(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}