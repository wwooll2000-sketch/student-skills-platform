// Announcements Module — Admin management + Student display

// ─────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────

const ANNOUNCEMENT_CONFIG = {
    basic:   { icon: 'ℹ️', colorClass: 'bg-blue-50 border-blue-200 text-blue-800',   badgeClass: 'bg-blue-100 text-blue-700',   label: 'تنبيه' },
    warning: { icon: '⚠️', colorClass: 'bg-yellow-50 border-yellow-200 text-yellow-800', badgeClass: 'bg-yellow-100 text-yellow-700', label: 'تحذير' },
    danger:  { icon: '🚨', colorClass: 'bg-red-50 border-red-200 text-red-800',     badgeClass: 'bg-red-100 text-red-700',     label: 'هام' },
};

function _announcementConfig(type) {
    return ANNOUNCEMENT_CONFIG[type] || ANNOUNCEMENT_CONFIG.basic;
}

// ─────────────────────────────────────────────────────────────
// Admin API helpers (delegated to adminAPI object)
// ─────────────────────────────────────────────────────────────

async function _adminGetAnnouncements() {
    if (!adminAPI.isAuthorized()) return { success: false, announcements: [] };
    try {
        const res = await fetch('/api/admin/announcements', {
            headers: { Authorization: `Bearer ${adminAPI.authToken}` }
        });
        return await res.json();
    } catch { return { success: false, announcements: [] }; }
}

async function _adminSaveAnnouncement(data, id = null) {
    if (!adminAPI.isAuthorized()) return { success: false, message: 'غير مصرح' };
    const isEdit = !!id;
    try {
        const res = await fetch(
            isEdit ? `/api/admin/announcements/${id}` : '/api/admin/announcements',
            {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminAPI.authToken}` },
                body: JSON.stringify(data)
            }
        );
        return await res.json();
    } catch { return { success: false, message: 'خطأ في الاتصال' }; }
}

async function _adminDeleteAnnouncement(id) {
    if (!adminAPI.isAuthorized()) return { success: false, message: 'غير مصرح' };
    try {
        const res = await fetch(`/api/admin/announcements/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${adminAPI.authToken}` }
        });
        return await res.json();
    } catch { return { success: false, message: 'خطأ في الاتصال' }; }
}

// ─────────────────────────────────────────────────────────────
// Admin: Load & Render
// ─────────────────────────────────────────────────────────────

async function loadAdminAnnouncements() {
    const list = document.getElementById('adminAnnouncementsList');
    if (!list) return;
    list.innerHTML = '<div class="text-center py-6 text-slate-400">جاري التحميل...</div>';

    const result = await _adminGetAnnouncements();
    if (!result.success) {
        list.innerHTML = '<div class="text-center py-6 text-red-400">فشل تحميل الإعلانات</div>';
        return;
    }

    const announcements = result.announcements || [];
    if (announcements.length === 0) {
        list.innerHTML = '<div class="text-center py-8 text-slate-400">لا توجد إعلانات حتى الآن</div>';
        return;
    }

    list.innerHTML = announcements.map(a => _renderAdminAnnouncementCard(a)).join('');
}

function _renderAdminAnnouncementCard(a) {
    const cfg = _announcementConfig(a.type);
    const targetLabel = a.target_all
        ? '<span class="text-xs text-slate-500">👥 جميع الطلاب</span>'
        : `<span class="text-xs text-slate-500">🎯 ${a.student_ids.length} طالب محدد</span>`;

    const date = a.created_at ? new Date(a.created_at).toLocaleDateString('ar-SA') : '';

    return `
    <div class="flex items-start gap-3 p-4 rounded-xl border ${cfg.colorClass} mb-3">
        <span class="text-2xl flex-shrink-0 mt-0.5">${cfg.icon}</span>
        <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2 mb-1">
                <span class="font-bold text-sm">${_escHtml(a.title)}</span>
                <span class="text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badgeClass}">${cfg.label}</span>
                ${targetLabel}
                <span class="text-xs text-slate-400 mr-auto">${date}</span>
            </div>
            ${a.description ? `<p class="text-sm opacity-80 leading-relaxed">${_escHtml(a.description)}</p>` : ''}
        </div>
        <div class="flex gap-1.5 flex-shrink-0">
            <button onclick="openEditAnnouncementModal('${a.id}')" title="تعديل"
                class="p-1.5 rounded-lg hover:bg-white hover:bg-opacity-60 transition text-base">✏️</button>
            <button onclick="confirmDeleteAnnouncement('${a.id}', '${_escHtml(a.title).replace(/'/g, "\\'")}')" title="حذف"
                class="p-1.5 rounded-lg hover:bg-white hover:bg-opacity-60 transition text-base">🗑️</button>
        </div>
    </div>`;
}

function _escHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────────────────────────
// Admin: Modal for Add / Edit
// ─────────────────────────────────────────────────────────────

let _editingAnnouncementId = null;
let _allStudentsCache = null;

async function openAddAnnouncementModal() {
    _editingAnnouncementId = null;
    document.getElementById('announcementModalTitle').textContent = 'إضافة إعلان جديد';
    document.getElementById('announcementTitleInput').value = '';
    document.getElementById('announcementDescInput').value = '';
    // Reset type radio to 'basic'
    const basicRadio = document.querySelector('input[name="announcementType"][value="basic"]');
    if (basicRadio) basicRadio.checked = true;
    document.getElementById('announcementTargetAll').checked = true;
    _toggleStudentPicker(true);
    await _populateStudentPicker([]);
    document.getElementById('announcementModal').classList.remove('hidden');
}

async function openEditAnnouncementModal(id) {
    const result = await _adminGetAnnouncements();
    const ann = (result.announcements || []).find(a => a.id === id);
    if (!ann) return;

    _editingAnnouncementId = id;
    document.getElementById('announcementModalTitle').textContent = 'تعديل الإعلان';
    document.getElementById('announcementTitleInput').value = ann.title;
    document.getElementById('announcementDescInput').value = ann.description || '';
    // Set type radio
    const typeRadio = document.querySelector(`input[name="announcementType"][value="${ann.type}"]`);
    if (typeRadio) typeRadio.checked = true;
    document.getElementById('announcementTargetAll').checked = ann.target_all;
    _toggleStudentPicker(ann.target_all);
    await _populateStudentPicker(ann.student_ids || []);
    document.getElementById('announcementModal').classList.remove('hidden');
}

function closeAnnouncementModal() {
    document.getElementById('announcementModal').classList.add('hidden');
    _editingAnnouncementId = null;
    _allStudentsCache = null; // refresh next time
}

function _toggleStudentPicker(targetAll) {
    const picker = document.getElementById('announcementStudentPicker');
    if (picker) picker.classList.toggle('hidden', targetAll);
}

async function _populateStudentPicker(selectedIds) {
    const container = document.getElementById('announcementStudentList');
    if (!container) return;

    // Load students once and cache
    if (!_allStudentsCache) {
        const r = await adminAPI.getAllStudents();
        _allStudentsCache = r.success ? (r.students || []) : [];
    }

    const students = _allStudentsCache;
    if (students.length === 0) {
        container.innerHTML = '<p class="text-sm text-slate-400 text-center py-3">لا يوجد طلاب</p>';
        return;
    }

    container.innerHTML = students.map(s => `
        <label class="flex items-center gap-2 py-1 cursor-pointer hover:bg-slate-50 rounded px-1">
            <input type="checkbox" value="${s.id}" class="announcement-student-cb rounded"
                ${selectedIds.includes(s.id) ? 'checked' : ''}>
            <span class="text-sm">${_escHtml(s.name)}</span>
            <span class="text-xs text-slate-400">(${s.code})</span>
        </label>
    `).join('');
}

function onAnnouncementTargetChange() {
    const targetAll = document.getElementById('announcementTargetAll').checked;
    _toggleStudentPicker(targetAll);
}

function toggleSelectAllAnnouncementStudents() {
    const selectAll = document.getElementById('announcementSelectAllStudents').checked;
    document.querySelectorAll('.announcement-student-cb').forEach(cb => cb.checked = selectAll);
}

async function saveAnnouncement() {
    const title = document.getElementById('announcementTitleInput').value.trim();
    const description = document.getElementById('announcementDescInput').value.trim();
    const checkedType = document.querySelector('input[name="announcementType"]:checked');
    const type = checkedType ? checkedType.value : 'basic';
    const target_all = document.getElementById('announcementTargetAll').checked;

    if (!title) {
        showToast('يرجى إدخال عنوان الإعلان', { type: 'error' });
        return;
    }

    const student_ids = target_all ? [] : Array.from(
        document.querySelectorAll('.announcement-student-cb:checked')
    ).map(cb => cb.value);

    if (!target_all && student_ids.length === 0) {
        showToast('يرجى اختيار طالب واحد على الأقل أو تحديد "جميع الطلاب"', { type: 'warning' });
        return;
    }

    const btn = document.getElementById('announcementSaveBtn');
    btn.disabled = true;
    btn.textContent = 'جاري الحفظ...';

    const result = await _adminSaveAnnouncement(
        { title, description, type, target_all, student_ids },
        _editingAnnouncementId
    );

    btn.disabled = false;
    btn.textContent = 'حفظ الإعلان';

    if (result.success) {
        showToast(result.message || 'تم حفظ الإعلان', { type: 'success' });
        closeAnnouncementModal();
        loadAdminAnnouncements();
    } else {
        showToast(result.message || 'فشل حفظ الإعلان', { type: 'error' });
    }
}

function confirmDeleteAnnouncement(id, title) {
    customConfirm(
        `هل أنت متأكد من حذف إعلان "${title}"؟`,
        async () => {
            const result = await _adminDeleteAnnouncement(id);
            if (result.success) {
                showToast('تم حذف الإعلان', { type: 'success' });
                loadAdminAnnouncements();
            } else {
                showToast(result.message || 'فشل الحذف', { type: 'error' });
            }
        },
        { icon: '🗑️', title: 'حذف الإعلان', confirmText: 'حذف', cancelText: 'إلغاء' }
    );
}

// ─────────────────────────────────────────────────────────────
// Student: Load & Render
// ─────────────────────────────────────────────────────────────

async function loadStudentAnnouncements(studentId) {
    const section = document.getElementById('studentAnnouncementsSection');
    if (!section) return;

    try {
        const res = await fetch(`/api/student/${studentId}/announcements`);
        const result = await res.json();

        if (!result.success || !result.announcements || result.announcements.length === 0) {
            section.classList.add('hidden');
            return;
        }

        section.classList.remove('hidden');
        section.innerHTML = result.announcements.map(a => _renderStudentAnnouncementCard(a)).join('');
    } catch {
        section.classList.add('hidden');
    }
}

function _renderStudentAnnouncementCard(a) {
    const cfg = _announcementConfig(a.type);
    return `
    <div class="flex items-start gap-3 p-3 sm:p-4 rounded-xl border ${cfg.colorClass}">
        <span class="text-xl sm:text-2xl flex-shrink-0 mt-0.5">${cfg.icon}</span>
        <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
                <span class="font-bold text-sm sm:text-base">${_escHtml(a.title)}</span>
                <span class="text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badgeClass}">${cfg.label}</span>
            </div>
            ${a.description ? `<p class="text-sm opacity-80 leading-relaxed">${_escHtml(a.description)}</p>` : ''}
        </div>
    </div>`;
}
