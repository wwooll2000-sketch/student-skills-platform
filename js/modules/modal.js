// Custom Modal System
function showModal(options) {
    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('modalContent');
    const icon = document.getElementById('modalIcon');
    const title = document.getElementById('modalTitle');
    const message = document.getElementById('modalMessage');
    const buttons = document.getElementById('modalButtons');

    // Set icon
    icon.textContent = options.icon || '💬';
    
    // Set title and message
    title.textContent = options.title || 'إشعار';
    message.textContent = options.message || '';
    
    // Clear previous buttons
    buttons.innerHTML = '';
    
    // Add buttons
    if (options.type === 'confirm') {
        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = options.confirmText || 'تأكيد';
        confirmBtn.className = 'flex-1 bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 font-medium transition';
        confirmBtn.onclick = () => {
            closeModal();
            if (options.onConfirm) options.onConfirm();
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
        onConfirm: onConfirm,
        onCancel: options.onCancel
    });
}
