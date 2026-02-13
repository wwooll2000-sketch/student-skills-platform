// Custom Modal System
function showModal(options) {
    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('modalContent');
    const icon = document.getElementById('modalIcon');
    const title = document.getElementById('modalTitle');
    const message = document.getElementById('modalMessage');
    const buttons = document.getElementById('modalButtons');

    // Check if all required elements exist
    if (!modal || !modalContent || !icon || !title || !message || !buttons) {
        console.error('Modal elements not found in DOM. Required elements: customModal, modalContent, modalIcon, modalTitle, modalMessage, modalButtons');
        return;
    }

    // Set icon
    icon.textContent = options.icon || '💬';
    
    // Set title and message
    title.textContent = options.title || 'إشعار';
    
    // Handle message (can be string or DOM element)
    if (typeof options.message === 'string') {
        message.textContent = options.message;
    } else if (options.message instanceof HTMLElement) {
        message.innerHTML = '';
        message.appendChild(options.message);
    } else {
        message.innerHTML = options.message || '';
    }
    
    // Add checkbox if provided
    if (options.checkbox) {
        const checkboxContainer = document.createElement('div');
        checkboxContainer.className = 'mt-4 mb-2';
        checkboxContainer.innerHTML = `
            <label class="flex items-start cursor-pointer p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition">
                <input type="checkbox" id="modalCheckbox" 
                    class="mt-0.5 w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500">
                <span class="mr-3 text-sm text-slate-700 font-medium">${options.checkbox.label}</span>
            </label>
        `;
        message.appendChild(checkboxContainer);
    }
    
    // Clear previous buttons
    buttons.innerHTML = '';
    
    // Add buttons
    if (options.type === 'confirm') {
        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = options.confirmText || 'تأكيد';
        confirmBtn.className = 'flex-1 bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 font-medium transition';
        confirmBtn.onclick = () => {
            const checkboxValue = options.checkbox ? document.getElementById('modalCheckbox')?.checked : false;
            closeModal();
            if (options.onConfirm) options.onConfirm(checkboxValue);
        };
        
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = options.cancelText || 'إلغاء';
        cancelBtn.className = 'flex-1 bg-slate-200 text-slate-700 py-3 px-4 rounded-lg hover:bg-slate-300 font-medium transition';
        cancelBtn.onclick = () => {
            closeModal();
            if (options.onCancel) options.onCancel();
        };
        
        buttons.appendChild(confirmBtn);
        buttons.appendChild(cancelBtn);
    } else {
        const okBtn = document.createElement('button');
        okBtn.textContent = options.buttonText || 'حسناً';
        okBtn.className = 'w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 font-medium transition';
        okBtn.onclick = () => {
            closeModal();
            if (options.onClose) options.onClose();
        };
        buttons.appendChild(okBtn);
    }
    
    // Show modal with animation
    modal.classList.remove('hidden');
    setTimeout(() => {
        modalContent.classList.remove('scale-95');
        modalContent.classList.add('scale-100');
    }, 10);
    
    // Close on background click
    modal.onclick = function(e) {
        if (e.target === modal) {
            closeModal();
        }
    };
}

function closeModal() {
    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('modalContent');
    
    // Check if elements exist
    if (!modal || !modalContent) {
        console.error('Modal elements not found when trying to close');
        return;
    }
    
    modalContent.classList.remove('scale-100');
    modalContent.classList.add('scale-95');
    
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 200);
}

function customAlert(message, options = {}) {
    showModal({
        type: 'alert',
        icon: options.icon || '💬',
        title: options.title || 'إشعار',
        message: message,
        buttonText: options.buttonText || 'حسناً',
        onClose: options.onClose
    });
}

function customConfirm(message, onConfirm, options = {}) {
    showModal({
        type: 'confirm',
        icon: options.icon || '❓',
        title: options.title || 'تأكيد',
        message: message,
        confirmText: options.confirmText || 'تأكيد',
        cancelText: options.cancelText || 'إلغاء',
        checkbox: options.checkbox, // Pass through checkbox option
        onConfirm: onConfirm,
        onCancel: options.onCancel
    });
}

// Custom HTML Modal (for complex content)
function showCustomModal(htmlContent) {
    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('modalContent');
    
    // Clear and set custom content
    modalContent.innerHTML = htmlContent;
    
    // Show modal with animation
    modal.classList.remove('hidden');
    setTimeout(() => {
        modalContent.classList.remove('scale-95');
        modalContent.classList.add('scale-100');
    }, 10);
    
    // Close on background click
    modal.onclick = function(e) {
        if (e.target === modal) {
            closeCustomModal();
        }
    };
}

function closeCustomModal() {
    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('modalContent');
    
    modalContent.classList.remove('scale-100');
    modalContent.classList.add('scale-95');
    
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 200);
}

// Toast Notification System
let toastQueue = [];
let audioContext = null;

// Initialize Web Audio API (lazy load)
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
}

// Play success sound
function playSuccessSound() {
    try {
        const ctx = initAudio();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        // Success sound: C major chord arpeggio (C-E-G)
        oscillator.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        oscillator.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
        oscillator.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
        
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.3);
    } catch (e) {
        console.log('Audio not supported:', e);
    }
}

// Show toast notification
function showToast(message, options = {}) {
    const container = document.getElementById('toastContainer');
    if (!container) {
        console.error('Toast container not found');
        return;
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'pointer-events-auto bg-white rounded-lg shadow-lg border-r-4 p-4 min-w-[320px] max-w-md toast-enter';
    
    // Set border color based on type
    const type = options.type || 'success';
    const colors = {
        success: 'border-green-500 bg-green-50',
        error: 'border-red-500 bg-red-50',
        warning: 'border-yellow-500 bg-yellow-50',
        info: 'border-blue-500 bg-blue-50'
    };
    toast.className += ` ${colors[type] || colors.success}`;
    
    // Set icon based on type
    const icons = {
        success: options.icon || '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    const icon = icons[type] || icons.success;
    
    // Build toast content
    toast.innerHTML = `
        <div class="flex items-start gap-3">
            <span class="text-2xl flex-shrink-0">${icon}</span>
            <div class="flex-1 min-w-0">
                ${options.title ? `<div class="font-bold text-sm text-slate-800 mb-1">${options.title}</div>` : ''}
                <div class="text-sm text-slate-700 break-words">${message}</div>
            </div>
        </div>
    `;
    
    // Add to container
    container.appendChild(toast);
    toastQueue.push(toast);
    
    // Play sound for success toasts (only if not muted)
    if (type === 'success' && !isNotificationMuted) {
        playSuccessSound();
    }
    
    // Auto-dismiss after duration (default 3 seconds)
    const duration = options.duration || 3000;
    setTimeout(() => {
        removeToast(toast);
    }, duration);
}

// Remove toast with animation
function removeToast(toast) {
    if (!toast || !toast.parentElement) return;
    
    toast.classList.remove('toast-enter');
    toast.classList.add('toast-exit');
    
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
        const index = toastQueue.indexOf(toast);
        if (index > -1) {
            toastQueue.splice(index, 1);
        }
    }, 300);
}
// Toggle notification sound mute
function toggleNotificationMute() {
    isNotificationMuted = !isNotificationMuted;
    localStorage.setItem('notificationMuted', isNotificationMuted.toString());
    updateNotificationMuteButton();
    
    // Show a brief message (sound will play only if unmuting)
    const message = isNotificationMuted ? 'تم كتم الصوت' : 'تم تفعيل الصوت';
    showToast(message, { 
        type: 'success', 
        title: 'الصوت',
        duration: 2000
    });
}

// Update notification sound mute button icon
function updateNotificationMuteButton() {
    const btn = document.getElementById('notificationMuteBtn');
    if (!btn) return;
    
    if (isNotificationMuted) {
        btn.textContent = '🔇';
        btn.title = 'تفعيل الصوت';
    } else {
        btn.textContent = '🔊';
        btn.title = 'كتم الصوت';
    }
}
