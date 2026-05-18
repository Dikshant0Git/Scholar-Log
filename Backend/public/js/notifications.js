// ── Intersection Observer for Scroll Reveal ──
    const mainEl = document.querySelector('.scroll-reveal');
    if (mainEl) {
        setTimeout(() => {
            mainEl.style.opacity = '1';
            mainEl.classList.add('revealed');
        }, 50);
    }

    const activeContainer = document.getElementById('active-timers-container');
    const completedContainer = document.getElementById('completed-timers-container');
    const noActivePlaceholder = document.getElementById('no-active-timers');
    const noCompletedPlaceholder = document.getElementById('no-completed-timers');

    function updateTimers() {
        const activeCards = document.querySelectorAll('.active-timer-card');
        
        if (activeCards.length === 0) {
            if (noActivePlaceholder) noActivePlaceholder.classList.remove('hidden');
            return;
        }

        const now = Date.now();

        activeCards.forEach(card => {
            const id = card.dataset.id;
            const title = card.dataset.title;
            const created = new Date(card.dataset.created).getTime();
            const durationMin = parseInt(card.dataset.duration, 10);
            const durationMs = durationMin * 60 * 1000;
            const endTime = created + durationMs;
            const remainingMs = endTime - now;

            if (remainingMs <= 0) {
                // ── Timer Completed! ──
                // 1. Fire browser flash popup immediately
                if (window.showFlash) {
                    window.showFlash(`Task: "${title}" duration has been completed!`, 'success');
                }

                // 2. Prepend dynamic completed log to completed table
                const endDate = new Date(endTime);
                const formattedTime = endDate.toLocaleString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });

                const newRow = document.createElement('tr');
                newRow.className = 'border-b border-border-default/50 table-row cursor-pointer opacity-0 transition-opacity duration-500';
                newRow.id = `completed-${id}`;
                newRow.onclick = () => { window.location.href = `/entries/${id}`; };
                newRow.innerHTML = `
                    <td class="py-3 pr-4 font-medium text-text-primary truncate max-w-[250px]">${escapeHtml(title)}</td>
                    <td class="py-3 px-4 font-mono text-[11px] text-text-secondary text-center">${durationMin}m</td>
                    <td class="py-3 px-4 text-center">
                        <span class="font-mono text-[10px] uppercase tracking-wider badge-${card.dataset.difficulty}">${card.dataset.difficulty}</span>
                    </td>
                    <td class="py-3 px-4 text-right font-mono text-[11px] text-text-secondary">${formattedTime}</td>
                    <td class="py-3 pl-4 text-right">
                        <button onclick="dismissNotification(event, '${id}')" class="text-text-tertiary hover:text-danger p-1 transition-colors cursor-pointer bg-transparent border-none inline-flex items-center justify-center rounded-sm" title="Dismiss Notification">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </td>
                `;

                if (noCompletedPlaceholder) noCompletedPlaceholder.classList.add('hidden');
                completedContainer.insertBefore(newRow, completedContainer.firstChild);
                
                // Fade-in new row
                setTimeout(() => { newRow.classList.remove('opacity-0'); }, 50);

                // 3. Smooth transition to remove active card
                card.classList.add('opacity-0', 'scale-95');
                setTimeout(() => {
                    card.remove();
                    const remainingActive = document.querySelectorAll('.active-timer-card');
                    if (remainingActive.length === 0 && noActivePlaceholder) {
                        noActivePlaceholder.classList.remove('hidden');
                    }
                }, 300);

            } else {
                // ── Countdown Tick ──
                const totalSeconds = Math.floor(remainingMs / 1000);
                const seconds = totalSeconds % 60;
                const totalMinutes = Math.floor(totalSeconds / 60);
                const minutes = totalMinutes % 60;
                const hours = Math.floor(totalMinutes / 60);

                let countdownStr = '';
                if (hours > 0) {
                    countdownStr += `${hours}h `;
                }
                countdownStr += `${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;

                card.querySelector('.countdown-display').textContent = countdownStr;

                // ── Progress Bar & Percentage Updates ──
                const elapsedMs = now - created;
                const percentage = Math.min(100, Math.max(0, (elapsedMs / durationMs) * 100));
                
                card.querySelector('.progress-fill').style.width = `${percentage}%`;
                card.querySelector('.elapsed-text').textContent = `${Math.round(percentage)}%`;
            }
        });
    }

    function escapeHtml(unsafe) {
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }

    // Run initial cycle to render timers immediately
    updateTimers();

    // Ticking interval running every 1 second
    const interval = setInterval(updateTimers, 1000);

    // Dismiss individual notification
    window.dismissNotification = async (event, id) => {
        event.stopPropagation();
        try {
            const res = await fetch(`/api/journal/${id}/clear-notification`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' }
            });
            if (res.ok) {
                const card = document.getElementById(`timer-${id}`);
                const row = document.getElementById(`completed-${id}`);

                if (card) {
                    card.classList.add('opacity-0', 'scale-95');
                    setTimeout(() => {
                        card.remove();
                        checkEmptyStates();
                    }, 300);
                }
                if (row) {
                    row.classList.add('opacity-0');
                    setTimeout(() => {
                        row.remove();
                        checkEmptyStates();
                    }, 300);
                }
                if (window.showFlash) {
                    window.showFlash('Notification dismissed', 'success');
                }
            }
        } catch (err) {
            console.error('Failed to dismiss notification:', err);
        }
    };

    // Clear all notifications
    window.clearAllNotifications = async () => {
        try {
            const res = await fetch('/api/journal/clear-all-notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' }
            });
            if (res.ok) {
                const cards = document.querySelectorAll('.active-timer-card');
                const rows = document.querySelectorAll('#completed-timers-container tr:not(#no-completed-timers)');

                cards.forEach(card => card.classList.add('opacity-0', 'scale-95'));
                rows.forEach(row => row.classList.add('opacity-0'));

                setTimeout(() => {
                    cards.forEach(card => card.remove());
                    rows.forEach(row => row.remove());
                    checkEmptyStates();

                    // Hide the "Clear All" button since there are no notifications left
                    const clearAllBtn = document.getElementById('clear-all-btn');
                    if (clearAllBtn) {
                        clearAllBtn.remove();
                    }
                }, 300);

                if (window.showFlash) {
                    window.showFlash('All notifications cleared', 'success');
                }
            }
        } catch (err) {
            console.error('Failed to clear all notifications:', err);
        }
    };

    // Check and display empty states if needed
    function checkEmptyStates() {
        const remainingActive = document.querySelectorAll('.active-timer-card');
        const remainingCompleted = document.querySelectorAll('#completed-timers-container tr:not(#no-completed-timers)');

        if (remainingActive.length === 0 && noActivePlaceholder) {
            noActivePlaceholder.classList.remove('hidden');
        }
        if (remainingCompleted.length === 0 && noCompletedPlaceholder) {
            noCompletedPlaceholder.classList.remove('hidden');
        }
    }

    // Cleanup interval on page unload
    window.addEventListener('beforeunload', () => {
        clearInterval(interval);
    });
