// Test Flow Module — Student skill quiz

let _testCurrentSkillId = null;
let _testCurrentSkillName = null;
let _testCurrentQuestions = [];
let _testRemainingAttempts = 0;

// ── Confirm Modal ────────────────────────────────────────────────────────────

async function openTestConfirmModal(skillId, skillName) {
    _testCurrentSkillId = skillId;
    _testCurrentSkillName = skillName;
    _testCurrentQuestions = [];

    const modal = document.getElementById('testConfirmModal');
    if (!modal) return;

    const nameEl = document.getElementById('testConfirmSkillName');
    const infoEl = document.getElementById('testConfirmInfo');
    const startBtn = document.getElementById('testConfirmStartBtn');

    if (nameEl) nameEl.textContent = skillName;
    if (infoEl) infoEl.textContent = 'جاري تحميل معلومات الاختبار...';
    if (startBtn) { startBtn.disabled = true; startBtn.textContent = '...'; }

    modal.classList.remove('hidden');

    const studentId = sessionStorage.getItem('student_id');
    if (!studentId) {
        if (infoEl) infoEl.textContent = 'خطأ: لم يتم التعرف على الطالب.';
        return;
    }

    const result = await studentAPI.getTestInfo(skillId);

    if (!result.success) {
        if (infoEl) infoEl.textContent = result.message || 'خطأ في تحميل معلومات الاختبار.';
        if (startBtn) startBtn.disabled = true;
        return;
    }

    if (!result.has_test) {
        if (infoEl) infoEl.textContent = 'لا يوجد اختبار محدد لهذه المهارة بعد.';
        if (startBtn) startBtn.disabled = true;
        return;
    }

    _testCurrentQuestions = result.questions || [];
    _testRemainingAttempts = result.remaining_attempts ?? 0;

    const attemptsUsed = result.attempts_used ?? 0;
    const maxAttempts = result.max_attempts ?? 3;

    if (_testRemainingAttempts <= 0) {
        if (infoEl) infoEl.textContent = `لقد استنفدت جميع المحاولات (${attemptsUsed}/${maxAttempts}). لا يمكنك أداء الاختبار مجدداً.`;
        if (startBtn) startBtn.disabled = true;
        return;
    }

    if (infoEl) {
        infoEl.innerHTML = `
            عدد الأسئلة: <strong>${_testCurrentQuestions.length}</strong> &nbsp;|&nbsp;
            المحاولات المتبقية: <strong>${_testRemainingAttempts} / ${maxAttempts}</strong><br>
            <span class="text-xs text-slate-500 mt-1 block">الدرجة الكاملة: 10 نقاط — للنجاح تحتاج 6 نقاط على الأقل</span>
        `;
    }

    if (startBtn) {
        startBtn.disabled = false;
        startBtn.textContent = 'ابدأ الآن';
    }
}

function closeTestConfirmModal() {
    const modal = document.getElementById('testConfirmModal');
    if (modal) modal.classList.add('hidden');
}

function confirmStartTest() {
    closeTestConfirmModal();
    showTestPage(_testCurrentSkillId, _testCurrentSkillName, _testCurrentQuestions, _testRemainingAttempts);
}

// ── Test Page ────────────────────────────────────────────────────────────────

function showTestPage(skillId, skillName, questions, remaining) {
    // Hide student view, show test view
    ['studentView', 'skillsDetailView', 'studentDashboardView'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    const testView = document.getElementById('testView');
    if (!testView) return;
    testView.classList.remove('hidden');

    // Hide footer and logout button while in test view
    const footer = document.getElementById('siteFooter');
    if (footer) footer.classList.add('hidden');
    const logoutBtn = document.getElementById('studentLogoutBtn');
    if (logoutBtn) logoutBtn.classList.add('hidden');

    const titleEl = document.getElementById('testViewTitle');
    if (titleEl) titleEl.textContent = `اختبار: ${skillName}`;

    const subtitleEl = document.getElementById('testViewSubtitle');
    if (subtitleEl) subtitleEl.textContent = 'أجب على جميع الأسئلة بصح أو خطأ';

    const form = document.getElementById('testQuestionsForm');
    if (!form) return;

    if (questions.length === 0) {
        form.innerHTML = '<p class="text-center text-slate-400 py-6">لا توجد أسئلة لهذا الاختبار.</p>';
        return;
    }

    form.innerHTML = questions.map((q, i) => `
        <div class="border border-slate-200 rounded-xl p-4 bg-slate-50">
            <p class="font-medium text-slate-800 mb-3 text-sm sm:text-base">${i + 1}. ${_escTestHtml(q.question)}</p>
            <div class="flex gap-4">
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="q_${q.id}" value="true" class="w-4 h-4 accent-green-500">
                    <span class="text-sm font-medium text-green-700">✅ صح</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="q_${q.id}" value="false" class="w-4 h-4 accent-red-500">
                    <span class="text-sm font-medium text-red-600">❌ خطأ</span>
                </label>
            </div>
        </div>
    `).join('');

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Submit ───────────────────────────────────────────────────────────────────

async function submitStudentTest() {
    if (!_testCurrentSkillId || _testCurrentQuestions.length === 0) return;

    // Collect answers
    const answers = {};
    let allAnswered = true;

    for (const q of _testCurrentQuestions) {
        const selected = document.querySelector(`input[name="q_${q.id}"]:checked`);
        if (!selected) { allAnswered = false; break; }
        answers[q.id] = selected.value === 'true';
    }

    if (!allAnswered) {
        showToast('يرجى الإجابة على جميع الأسئلة قبل التسليم', { type: 'error' });
        return;
    }

    const btn = document.getElementById('submitTestBtn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ جاري التسليم...'; }

    const result = await studentAPI.submitTest(_testCurrentSkillId, answers);

    if (btn) { btn.disabled = false; btn.textContent = '✅ تسليم الاختبار'; }

    if (!result.success) {
        showToast(result.message || 'خطأ في تسليم الاختبار', { type: 'error' });
        return;
    }

    // Store result for banner display after navigation
    sessionStorage.setItem('pendingTestResult', JSON.stringify({
        passed: result.passed,
        score: result.score,
        skill_name: _testCurrentSkillName,
        message: result.message,
        remaining_attempts: result.remaining_attempts
    }));

    backToDashboard();
}

// ── Navigation ───────────────────────────────────────────────────────────────

function backToDashboard(result) {
    // Hide test view
    const testView = document.getElementById('testView');
    if (testView) testView.classList.add('hidden');

    // Restore footer and logout button
    const footer = document.getElementById('siteFooter');
    if (footer) footer.classList.remove('hidden');
    const logoutBtn = document.getElementById('studentLogoutBtn');
    if (logoutBtn) logoutBtn.classList.remove('hidden');

    // Show student view
    const studentView = document.getElementById('studentView');
    if (studentView) studentView.classList.remove('hidden');

    // Reload student view to reflect updated skill status
    const studentId = sessionStorage.getItem('student_id');
    if (studentId && typeof loadSimpleStudentView === 'function') {
        loadSimpleStudentView(studentId, true);
    }
}

function _escTestHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
