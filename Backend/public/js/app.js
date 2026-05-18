// Flash Message System
window.showFlash = (message, type = 'success') => {
    const container = document.getElementById('flash-container');
    const template = document.getElementById('flash-template');
    
    if (!container || !template) return;
    
    const clone = template.content.cloneNode(true);
    const flashEl = clone.querySelector('.flash-message');
    const textEl = clone.querySelector('.flash-text');
    const iconEl = clone.querySelector('.flash-icon');
    
    textEl.textContent = message;
    
    if (type === 'error') {
        flashEl.classList.add('border-danger-dim', 'bg-danger-dim/10');
        iconEl.classList.add('text-danger');
        iconEl.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
    } else {
        flashEl.classList.add('border-border-emphasis', 'border-l-[3px]', 'border-l-accent-amber');
        iconEl.classList.add('text-accent-amber');
        iconEl.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
    }
    
    container.appendChild(clone);
    
    // Animate in
    requestAnimationFrame(() => {
        const newFlash = container.lastElementChild;
        newFlash.classList.remove('opacity-0', 'translate-y-[-8px]');
        
        // Auto remove
        setTimeout(() => {
            newFlash.classList.add('opacity-0', 'translate-y-[-8px]');
            setTimeout(() => newFlash.remove(), 200);
        }, 5000);
    });
};

// Logout function
window.logout = async () => {
    try {
        const res = await fetch('/api/students/logout', { method: 'POST' });
        if (res.ok) {
            window.location.href = '/login';
        }
    } catch (err) {
        console.error('Logout failed:', err);
        window.location.href = '/login'; // Fallback
    }
};

// Global app JS
document.addEventListener('DOMContentLoaded', () => {
    // ── Intersection Observer for Scroll Reveals ──
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                // Optional: Stop observing once revealed
                // observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.scroll-reveal').forEach(el => {
        revealObserver.observe(el);
    });

    // ── Global Page Enter Animation Fallback ──
    document.querySelectorAll('.page-enter').forEach(el => {
        el.style.opacity = '1';
    });

    // ── Profile Dropdown Toggle Logic ──
    const profileBtn = document.getElementById('profile-dropdown-btn');
    const profileMenu = document.getElementById('profile-dropdown-menu');

    if (profileBtn && profileMenu) {
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            profileMenu.classList.toggle('opacity-0');
            profileMenu.classList.toggle('invisible');
            profileMenu.classList.toggle('translate-y-2');
            profileMenu.classList.toggle('pointer-events-none');
        });

        // Click outside to close
        document.addEventListener('click', (e) => {
            if (!profileMenu.contains(e.target) && !profileBtn.contains(e.target)) {
                profileMenu.classList.add('opacity-0', 'invisible', 'pointer-events-none');
                profileMenu.classList.remove('translate-y-2');
            }
        });
    }

    // ── Global Custom Select Dropdown Initializer ──
    const initCustomSelects = () => {
        const customSelects = document.querySelectorAll('.custom-select');
        
        customSelects.forEach(select => {
            if (select.dataset.initialized) return;
            select.dataset.initialized = 'true';

            const btn = select.querySelector('.select-btn');
            const menu = select.querySelector('.dropdown-menu');
            const hiddenInput = select.querySelector('input[type="hidden"]');
            const options = select.querySelectorAll('.option-item');
            const chevron = select.querySelector('.chevron');
            
            if (!btn || !menu) return;

            // Toggle open/close
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Close other custom selects first
                document.querySelectorAll('.custom-select .dropdown-menu').forEach(otherMenu => {
                    if (otherMenu !== menu) {
                        otherMenu.classList.add('hidden');
                        otherMenu.parentElement.querySelector('.chevron')?.classList.remove('rotate-180');
                    }
                });

                menu.classList.toggle('hidden');
                chevron?.classList.toggle('rotate-180');
            });

            // Handle item selection
            options.forEach(opt => {
                opt.addEventListener('click', (e) => {
                    e.stopPropagation();
                    
                    const val = opt.getAttribute('data-value');
                    const displayNameSpan = opt.querySelector('.option-display-name');
                    const htmlContent = displayNameSpan ? displayNameSpan.innerHTML : opt.innerHTML;
                    
                    // Update button text and hidden input value
                    const selectedTextSpan = btn.querySelector('.selected-text');
                    if (selectedTextSpan) {
                        selectedTextSpan.innerHTML = htmlContent;
                    }
                    
                    if (hiddenInput) {
                        hiddenInput.value = val;
                        hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    
                    // Update active states
                    options.forEach(o => o.classList.remove('active'));
                    opt.classList.add('active');

                    // Hide menu
                    menu.classList.add('hidden');
                    chevron?.classList.remove('rotate-180');
                });
            });
        });

        // Close all open dropdowns on click outside
        document.addEventListener('click', () => {
            document.querySelectorAll('.custom-select .dropdown-menu').forEach(menu => {
                menu.classList.add('hidden');
                menu.parentElement.querySelector('.chevron')?.classList.remove('rotate-180');
            });
        });
    };

    initCustomSelects();
    window.initCustomSelects = initCustomSelects;

    // ── Observation Log Character & Line Limit Validation ──
    const initLogLimiter = () => {
        const maxChars = 4000;
        const maxLines = 10000;
        const textarea = document.getElementById('entry-description');
        const counter = document.getElementById('log-counter');

        if (!textarea || !counter) return;

        const updateCounter = () => {
            let val = textarea.value;
            let lines = val.split('\n');
            
            // Enforce max lines limit
            if (lines.length > maxLines) {
                val = lines.slice(0, maxLines).join('\n');
                textarea.value = val;
                lines = val.split('\n');
            }
            
            // Enforce max characters limit
            if (val.length > maxChars) {
                val = val.substring(0, maxChars);
                textarea.value = val;
            }

            const charCount = val.length;
            const lineCount = lines.length;

            counter.textContent = `${charCount}/${maxChars} CHARS | ${lineCount}/${maxLines} LINES`;

            // Visual feedback states matching Oxide brand aesthetics
            if (charCount >= maxChars || lineCount >= maxLines) {
                counter.className = 'text-danger font-bold';
            } else if (charCount >= maxChars * 0.9 || lineCount >= maxLines * 0.9) {
                counter.className = 'text-accent-amber';
            } else {
                counter.className = 'text-text-secondary';
            }
        };

        textarea.addEventListener('input', updateCounter);
        textarea.addEventListener('keyup', updateCounter);
        
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const lines = textarea.value.split('\n');
                if (lines.length >= maxLines) {
                    e.preventDefault();
                }
            }
        });

        // Initialize immediately
        updateCounter();
    };

    initLogLimiter();
});

// ── Global HTML5 Canvas High-Quality Image Compressor ──
window.compressImage = function(file, maxWidth = 1600, maxHeight = 1600, quality = 0.9) {
    return new Promise((resolve, reject) => {
        // Return original if it is not an image
        if (!file || !file.type.startsWith('image/')) {
            return resolve(file);
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Aspect ratio calculation keeping pristine high resolution bounds
                if (width > maxWidth || height > maxHeight) {
                    if (width > height) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    } else {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to compressed, ultra-crisp JPEG
                canvas.toBlob((blob) => {
                    if (!blob) {
                        return reject(new Error('Canvas compression failed'));
                    }
                    const optimizedName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
                    const compressedFile = new File([blob], optimizedName, {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    });
                    resolve(compressedFile);
                }, 'image/jpeg', quality);
            };
            img.onerror = () => reject(new Error('Failed to load image structure'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('Failed to read image buffer'));
        reader.readAsDataURL(file);
    });
};
