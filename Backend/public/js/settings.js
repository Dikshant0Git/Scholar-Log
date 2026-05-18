document.addEventListener('DOMContentLoaded', () => {
    // ── Tab Navigation ──
    const tabs = document.querySelectorAll('.settings-tab');
    const sections = document.querySelectorAll('.settings-section');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Update Tab UI
            tabs.forEach(t => {
                t.classList.remove('active', 'bg-surface-2', 'text-text-primary', 'border-l-accent-amber');
                t.classList.add('text-text-secondary', 'border-l-transparent');
            });
            tab.classList.add('active', 'bg-surface-2', 'text-text-primary', 'border-l-accent-amber');
            tab.classList.remove('text-text-secondary', 'border-l-transparent');

            // Update Section Visibility
            const targetId = tab.dataset.target + '-section';
            sections.forEach(s => {
                if (s.id === targetId) {
                    s.classList.remove('hidden');
                    // Retrigger reveal animation
                    s.classList.remove('revealed');
                    setTimeout(() => s.classList.add('revealed'), 10);
                } else {
                    s.classList.add('hidden');
                }
            });
        });
    });

    // ── Profile Form ──
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnText = document.getElementById('profile-btn-text');
            btnText.textContent = 'Saving...';
            
            try {
                const formData = new FormData(profileForm);
                const data = Object.fromEntries(formData.entries());
                
                const res = await fetch('/api/students/profile', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                const result = await res.json();
                if (res.ok) {
                    showFlash('PROFILE MATRIX UPDATED', 'success');
                } else {
                    throw new Error(result.message);
                }
            } catch (err) {
                showFlash(err.message, 'error');
            } finally {
                btnText.textContent = 'Save Changes';
            }
        });
    }

    // ── Appearance Form ──
    const appearanceForm = document.getElementById('appearance-form');
    if (appearanceForm) {
        appearanceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnText = document.getElementById('appearance-btn-text');
            btnText.textContent = 'Updating...';
            
            try {
                const formData = new FormData(appearanceForm);
                const data = Object.fromEntries(formData.entries());
                
                // Get toggle state manually
                const toggle = document.querySelector('.toggle');
                data.showStats = toggle ? toggle.classList.contains('active') : true;
                
                const res = await fetch('/api/students/settings', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                const result = await res.json();
                if (res.ok) {
                    showFlash('INTERFACE CONFIG SAVED', 'success');
                    if (data.preferredTheme) {
                        let actualTheme = data.preferredTheme;
                        if (actualTheme === 'system') {
                            actualTheme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
                        }
                        document.documentElement.setAttribute('data-theme', actualTheme);
                    }
                    setTimeout(() => {
                        window.location.reload();
                    }, 800);
                } else {
                    throw new Error(result.message);
                }
            } catch (err) {
                showFlash(err.message, 'error');
            } finally {
                btnText.textContent = 'Update Interface';
            }
        });
    }

    // ── Avatar Upload Logic ──
    const avatarBtn = document.getElementById('avatar-btn');
    const avatarInput = document.getElementById('avatar-input');
    if (avatarBtn && avatarInput) {
        avatarBtn.addEventListener('click', () => avatarInput.click());
        avatarInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            handleUpload(file, 'profile', (url) => {
                document.getElementById('profile-pic-url').value = url;
                
                // Update Settings preview
                const settingsPreview = avatarBtn.previousElementSibling;
                settingsPreview.innerHTML = `<img src="${url}" class="w-full h-full object-cover">`;
                
                // Update Topbar avatar in real-time
                const topbarAvatar = document.getElementById('topbar-avatar-container');
                if (topbarAvatar) {
                    topbarAvatar.innerHTML = `<img src="${url}" alt="Profile" class="w-full h-full object-cover">`;
                }
            });
        });
    }

    // ── Background Upload Logic ──
    const bgUploadBtn = document.getElementById('bg-upload-btn');
    const bgInput = document.getElementById('bg-input');
    const bgClearBtn = document.getElementById('bg-clear-btn');
    if (bgUploadBtn && bgInput) {
        bgUploadBtn.addEventListener('click', () => bgInput.click());
        bgInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            handleUpload(file, 'background', (url) => {
                document.getElementById('bg-url').value = url;
                const previewContainer = document.querySelector('.flex-1.h-20');
                previewContainer.innerHTML = `<img src="${url}" id="bg-preview" class="w-full h-full object-cover">`;
            });
        });
        bgClearBtn.addEventListener('click', () => {
            document.getElementById('bg-url').value = '';
            const previewContainer = document.querySelector('.flex-1.h-20');
            previewContainer.innerHTML = `<div id="bg-placeholder" class="w-full h-full flex items-center justify-center font-mono text-[10px] text-text-tertiary uppercase">No Custom Background</div>`;
        });
    }

    // Helper: Handle Cloudinary Direct Upload
    async function handleUpload(file, type, callback) {
        let btn = null;
        if (type === 'profile') btn = document.getElementById('avatar-btn');
        if (type === 'background') btn = document.getElementById('bg-upload-btn');
        
        const originalText = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="dot"></span> UPLOADING...';
        }

        try {
            showFlash(`Uploading ${type}...`, 'success');
            
            // 1. Client-Side Pristine Canvas Compression
            const optimizedFile = await window.compressImage(file);

            // 2. Get Signature
            const sigRes = await fetch(`/api/students/upload-signature?type=${type}`);
            const sigData = await sigRes.json();
            
            if (!sigRes.ok) throw new Error('Failed to get upload signature');

            // 3. Upload to Cloudinary
            const formData = new FormData();
            formData.append('file', optimizedFile);
            formData.append('api_key', sigData.apiKey);
            formData.append('timestamp', sigData.timestamp);
            formData.append('signature', sigData.signature);
            formData.append('folder', sigData.folder);
            if (sigData.transformation) formData.append('transformation', sigData.transformation);

            const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${sigData.cloudName}/image/upload`, {
                method: 'POST',
                body: formData
            });

            const cloudData = await cloudRes.json();
            if (!cloudRes.ok) throw new Error(cloudData.error?.message || 'Upload failed');

            callback(cloudData.secure_url);
            showFlash(`${type.toUpperCase()} UPLOADED`, 'success');
        } catch (err) {
            showFlash(err.message, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        }
    }
});

// ── Security Actions ──
// Note: logout() is now in app.js

function deleteAccount() {
    window.showConfirmModal({
        title: 'INITIATE PURGE SEQUENCE',
        message: 'CRITICAL WARNING: This action is completely irreversible. Your student account, all logged journal entries, workspaces, settings, and uploaded assets will be permanently purged from the system.',
        confirmText: 'CONFIRM PURGE',
        requireConfirmText: 'PURGE',
        onConfirm: async () => {
            const res = await fetch('/api/students/profile', { method: 'DELETE' });
            const result = await res.json();
            if (res.ok) {
                showFlash('PURGE SEQUENCE SUCCESSFUL. ACCOUNT TERMINATED.', 'success');
                setTimeout(() => {
                    window.location.href = '/register';
                }, 1000);
            } else {
                throw new Error(result.message || 'Purge sequence failed');
            }
        }
    });
}

async function requestPwChange() {
    try {
        const res = await fetch('/api/students/request-password-change', { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
            showFlash('OTP sent to your email. Redirecting...', 'success');
            setTimeout(() => {
                window.location.href = `/reset-password?email=${encodeURIComponent(data.email)}`;
            }, 2000);
        } else {
            throw new Error(data.message);
        }
    } catch (err) {
        showFlash(err.message, 'error');
    }
}
