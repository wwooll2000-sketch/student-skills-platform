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
