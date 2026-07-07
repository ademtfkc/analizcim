(function () {
    function showInlineToast({ container, message, className = '', duration = 4000 }) {
        if (!container) return;
        const messageEl = container.querySelector('.error-message');
        if (messageEl) {
            messageEl.textContent = message;
        } else {
            container.textContent = message;
        }
        container.classList.add('active');
        if (className) {
            container.classList.add(className);
        }

        setTimeout(() => {
            container.classList.remove('active');
            if (className) {
                container.classList.remove(className);
            }
        }, duration);
    }

    function showFloatingSuccess(message) {
        const toast = document.createElement('div');
        toast.className = 'error-toast success-toast';
        toast.innerHTML = '<span class="error-icon">OK</span><span class="error-message"></span>';
        toast.querySelector('.error-message').textContent = message;
        toast.style.background = 'var(--success)';
        document.body.appendChild(toast);
        toast.classList.add('active');
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    window.AnalizcimNotify = {
        showInlineToast,
        showFloatingSuccess
    };
})();
