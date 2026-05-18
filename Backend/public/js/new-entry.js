let saveTimeout;
let uploadedFiles = [];

document.addEventListener('DOMContentLoaded', () => {
    // ── Segment Controls Logic ──
    const setupSegment = (groupId, hiddenInputId) => {
        const group = document.getElementById(groupId);
        const input = document.getElementById(hiddenInputId);
        if (!group || !input) return;

        const buttons = group.querySelectorAll('.segment-item');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                input.value = btn.dataset.value;
                triggerAutoSave();
            });
        });
    };

    setupSegment('difficulty-group', 'entry-difficulty');
    setupSegment('status-group', 'entry-status');

    // ── Auto-Draft Logic ──
    const form = document.getElementById('new-entry-form');
    if (form) {
        const inputs = form.querySelectorAll('input:not([type="file"]), textarea, select');
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                clearTimeout(saveTimeout);
                saveTimeout = setTimeout(saveDraft, 5000); // 5s debounce
            });
        });
    }

    // ── Dropzone Logic ──
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    
    if (dropzone && fileInput) {
        dropzone.addEventListener('click', () => fileInput.click());
        
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });
        
        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });
        
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                handleFiles(e.dataTransfer.files);
            }
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files.length) {
                handleFiles(fileInput.files);
            }
        });
    }

    // ── Form Submission ──
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btn = document.getElementById('submit-btn');
            const text = document.getElementById('btn-text');
            const originalText = text.textContent;
            
            try {
                btn.disabled = true;
                text.textContent = 'Saving...';
                
                const formData = new FormData(form);
                const data = Object.fromEntries(formData.entries());
                data.duration = Number(data.duration);
                data.attachments = uploadedFiles; // Cloudinary URLs
                
                const res = await fetch('/api/journal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                const result = await res.json();
                
                if (res.ok) {
                    window.location.href = `/entries/${result.entry._id}`;
                } else {
                    throw new Error(result.message);
                }
            } catch (err) {
                showFlash(err.message, 'error');
                btn.disabled = false;
                text.textContent = originalText;
            }
        });
    }
});

// Auto-draft API call
async function saveDraft() {
    const indicator = document.getElementById('save-indicator');
    if (indicator) indicator.classList.remove('opacity-0');
    
    const form = document.getElementById('new-entry-form');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    try {
        await fetch('/api/journal/draft', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch (err) {
        console.error('Draft save failed', err);
    } finally {
        setTimeout(() => {
            if (indicator) indicator.classList.add('opacity-0');
        }, 1500);
    }
}

// Clear draft and redirect
function clearDraftAndExit() {
    window.showConfirmModal({
        title: 'DISCARD JOURNAL ENTRY',
        message: 'Are you absolutely sure you want to discard this new academic entry? All unsaved draft modifications and attachment files will be permanently lost.',
        confirmText: 'CONFIRM DISCARD',
        onConfirm: async () => {
            await fetch('/api/journal/draft', { method: 'DELETE' });
            window.location.href = '/entries';
        }
    });
}

// Real implementation for file upload to Cloudinary via fallback endpoint
async function handleFiles(files) {
    const preview = document.getElementById('upload-preview');
    
    Array.from(files).forEach(async (file) => {
        // Create an optimistic UI preview container
        const div = document.createElement('div');
        div.className = 'relative aspect-square border border-border-default rounded bg-surface-2 overflow-hidden flex items-center justify-center';
        div.innerHTML = `<span class="dot"></span>`; // Loading state
        preview.appendChild(div);
        
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', 'journal_attachments');
            
            const res = await fetch('/api/students/upload', {
                method: 'POST',
                body: formData
            });
            const result = await res.json();
            
            if (!res.ok) throw new Error(result.message);
            
            // Result should have url, public_id, resource_type
            const attachment = {
                url: result.url,
                public_id: result.public_id,
                resource_type: result.resourceType || (file.type.startsWith('image/') ? 'image' : 'raw')
            };
            
            uploadedFiles.push(attachment);
            
            // Update UI with the actual file
            if (file.type.startsWith('image/')) {
                div.innerHTML = `<img src="${result.url}" class="w-full h-full object-cover">`;
            } else {
                div.innerHTML = `<div class="flex flex-col items-center justify-center h-full p-2"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-text-tertiary mb-2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg><span class="font-mono text-[9px] text-text-secondary truncate w-full text-center">${file.name}</span></div>`;
            }
            
            // Delete button overlay
            const delBtn = document.createElement('button');
            delBtn.className = 'absolute top-1 right-1 w-6 h-6 bg-bg-base/80 rounded flex items-center justify-center text-text-tertiary hover:text-danger hover:bg-bg-base transition-colors';
            delBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            delBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                div.remove();
                uploadedFiles = uploadedFiles.filter(item => item.public_id !== attachment.public_id);
            };
            
            div.appendChild(delBtn);
        } catch (err) {
            console.error('Upload failed', err);
            div.innerHTML = `<span class="text-danger font-mono text-[10px] text-center p-2">Upload Failed</span>`;
            setTimeout(() => div.remove(), 3000);
        }
    });
}
