// UI Helper Functions

function showLoading(elementId, message = 'جاري التحميل...') {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `<div class="p-8 text-center"><div class="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600 mx-auto mb-3"></div><p class="text-slate-600">${message}</p></div>`;
    }
}

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

function updateStudentProgressBar(completedCount, totalCount) {
    const progressBar = document.getElementById('studentProgressBar');
    const progressText = document.getElementById('studentProgressText');
    if (!progressBar) return;

    const percentage = totalCount > 0 ? ((completedCount / totalCount) * 100).toFixed(1) : 0;
    
    // Update progress text
    if (progressText) {
        progressText.textContent = `${completedCount}/${totalCount} (${percentage}%)`;
    }
    
    // Update progress bar
    progressBar.innerHTML = `
        <div class="bg-slate-200 rounded-full h-3 overflow-hidden">
            <div class="bg-gradient-to-r from-green-400 to-green-600 h-full transition-all duration-500" style="width: ${percentage}%"></div>
        </div>
    `;
}

function getSkillLinkIcon(iconKey) {
    const icons = {
        youtube: `<svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle"><path fill="#FF0000" d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8z"/><polygon fill="white" points="9.6,15.6 15.8,12 9.6,8.4"/></svg>`,
        pdf: `<svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle"><path fill="#E53E3E" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path fill="#FEB2B2" d="M14 2v6h6"/><text x="5" y="18" font-size="5.5" fill="white" font-weight="bold" font-family="Arial,sans-serif">PDF</text></svg>`,
        website: `<svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#4F46E5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
        file: `<span style="display:inline-block;vertical-align:middle;font-size:22px;">📁</span>`
    };
    return icons[iconKey] || icons.file;
}

function getSkillIconEmoji(iconKey) {
    const emojis = { youtube: '▶️', pdf: '📄', website: '🌐', file: '📁' };
    return emojis[iconKey] || '📁';
}

function updateIconPreview(selectId, previewId) {
    const select = document.getElementById(selectId);
    const preview = document.getElementById(previewId);
    if (select && preview) {
        preview.innerHTML = getSkillLinkIcon(select.value);
    }
}

function getTimeAgo(dateString) {
    if (!dateString) return 'منذ فترة';
    
    const date = new Date(dateString);
    const now = new Date();
    
    // Check if date is valid
    if (isNaN(date.getTime())) return 'منذ فترة';
    
    const seconds = Math.floor((now - date) / 1000);

    // Handle negative values (future dates due to timezone issues)
    if (seconds < 0) return 'منذ لحظات';
    
    if (seconds < 60) return 'منذ لحظات';
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `منذ ${minutes} ${minutes === 1 ? 'دقيقة' : 'دقيقة'}`;
    
    const hours = Math.floor(seconds / 3600);
    if (hours < 24) return `منذ ${hours} ${hours === 1 ? 'ساعة' : hours === 2 ? 'ساعتين' : 'ساعة'}`;
    
    const days = Math.floor(seconds / 86400);
    if (days < 7) return `منذ ${days} ${days === 1 ? 'يوم' : days === 2 ? 'يومين' : 'أيام'}`;
    
    const weeks = Math.floor(seconds / 604800);
    return `منذ ${weeks} ${weeks === 1 ? 'أسبوع' : weeks === 2 ? 'أسبوعين' : 'أسابيع'}`;
}
