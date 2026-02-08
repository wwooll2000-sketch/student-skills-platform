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
    customAlert("تم حفظ الملاحظات بنجاح", { 
        icon: '✅', 
        title: 'تم الحفظ'
    });
}

async function loadRecentActivity() {
    const container = document.getElementById('recentActivityList');
    if (!container) return;

    container.innerHTML = '<div class="text-center text-slate-400 p-4"><div class="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto"></div></div>';

    const result = await adminAPI.getRecentActivities();
    if (!result.success || !result.activities || result.activities.length === 0) {
        container.innerHTML = '<div class="text-center text-slate-400 p-4">لا توجد نشاطات حديثة</div>';
        return;
    }

    // Display top 10 recent activities
    const recentActivities = result.activities.slice(0, 10);
    
    container.innerHTML = '';
    recentActivities.forEach(activity => {
        const div = document.createElement('div');
        div.className = 'flex items-start gap-2 p-2 hover:bg-slate-50 rounded text-sm';
        const timeAgo = getTimeAgo(activity.date);
        div.innerHTML = `
            <span class="text-lg">✅</span>
            <div class="flex-1">
                <span class="font-medium">${activity.studentName}</span>
                <span class="text-slate-600">أكمل</span>
                <span class="font-medium text-indigo-600">${activity.skillName}</span>
                <div class="text-xs text-slate-400">${timeAgo}</div>
            </div>
        `;
        container.appendChild(div);
    });
}
