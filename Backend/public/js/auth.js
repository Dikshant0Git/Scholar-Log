// Flash Message System moved to app.js

// Form handling utility
const handleFormSubmit = async (formId, endpoint, onSuccess, method = 'POST') => {
    const form = document.getElementById(formId);
    if (!form) return;

    const errorDiv = document.getElementById('form-error');
    const submitBtn = document.getElementById('submit-btn');
    const btnText = document.getElementById('btn-text');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (errorDiv) errorDiv.classList.add('hidden');
        
        const originalText = btnText.textContent;
        btnText.textContent = 'Processing...';
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-75', 'cursor-not-allowed');

        try {
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

            // Handle OTP boxes if present
            const otpBoxes = form.querySelectorAll('.otp-box');
            if (otpBoxes.length === 6) {
                data.otp = Array.from(otpBoxes).map(b => b.value).join('');
            }

            // Client-side Confirm Password Validation
            if (formId === 'reset-password-form') {
                if (!data.newPassword || !data.confirmPassword) {
                    throw new Error('All fields are required');
                }
                if (data.newPassword !== data.confirmPassword) {
                    throw new Error('Passwords do not match');
                }
            }

            const response = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'An error occurred');
            }

            if (onSuccess) {
                onSuccess(result, data);
            } else {
                showFlash(result.message || 'Success', 'success');
            }
        } catch (error) {
            if (errorDiv) {
                errorDiv.textContent = error.message;
                errorDiv.classList.remove('hidden');
            } else {
                showFlash(error.message, 'error');
            }
        } finally {
            btnText.textContent = originalText;
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
        }
    });
};

// OTP Input logic
const setupOtpInputs = () => {
    const otpContainer = document.getElementById('otp-container');
    if (!otpContainer) return;

    const inputs = otpContainer.querySelectorAll('.otp-box');
    
    inputs.forEach((input, index) => {
        // Auto focus next input
        input.addEventListener('input', (e) => {
            if (e.target.value && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
        });

        // Handle backspace
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                inputs[index - 1].focus();
            }
        });

        // Handle paste
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedData = e.clipboardData.getData('text').slice(0, 6).replace(/[^0-9]/g, '');
            pastedData.split('').forEach((char, i) => {
                if (inputs[i]) {
                    inputs[i].value = char;
                    if (i < inputs.length - 1) inputs[i + 1].focus();
                }
            });
        });
    });
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupOtpInputs();

    handleFormSubmit('register-form', '/api/students/register', (result, data) => {
        window.location.href = `/verify?email=${encodeURIComponent(data.email)}`;
    });

    handleFormSubmit('login-form', '/api/students/login', (result) => {
        window.location.href = '/dashboard';
    });

    handleFormSubmit('verify-form', '/api/students/verify-email', (result) => {
        window.location.href = '/login';
    });

    handleFormSubmit('forgot-password-form', '/api/students/forgot-password', (result, data) => {
        window.location.href = `/reset-password?email=${encodeURIComponent(data.email)}`;
    });

    handleFormSubmit('reset-password-form', '/api/students/reset-password', (result) => {
        window.location.href = '/login';
    });
});
