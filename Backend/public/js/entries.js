let searchTimeout;
let currentPage = 1;

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    const statusFilter = document.getElementById('status-filter');
    const diffFilter = document.getElementById('diff-filter');
    const categoryFilter = document.getElementById('category-filter');
    const tableBody = document.getElementById('entries-table-body');
    const suggestionsBox = document.getElementById('search-suggestions');

    // Load initial page from URL if present
    const urlParams = new URLSearchParams(window.location.search);
    currentPage = parseInt(urlParams.get('page')) || 1;

    const fetchEntries = async (isNewSearch = false) => {
        if (isNewSearch) {
            currentPage = 1;
            suggestionsBox.classList.add('hidden');
        }
        
        const topic = searchInput.value.trim();
        const status = statusFilter.value;
        const difficulty = diffFilter.value;
        const category = categoryFilter.value;
        
        const params = new URLSearchParams();
        if (topic) params.set('topic', topic);
        if (status) params.set('status', status);
        if (difficulty) params.set('difficulty', difficulty);
        if (category) params.set('category', category);
        params.set('page', currentPage);
        
        // Update URL without reload
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState({ path: newUrl }, '', newUrl);

        const renderSkeleton = () => {
            tableBody.innerHTML = Array(5).fill(0).map(() => `
                <tr class="border-b border-border-default/50 animate-pulse">
                  <td class="py-3.5 pr-4">
                    <div class="h-3 bg-surface-3 rounded w-16 mb-2"></div>
                    <div class="h-2 bg-surface-3 rounded w-10"></div>
                  </td>
                  <td class="py-3.5 px-4">
                    <div class="h-3 bg-surface-3 rounded w-48 mb-2"></div>
                    <div class="h-2 bg-surface-3 rounded w-20"></div>
                  </td>
                  <td class="py-3.5 px-4">
                    <div class="h-3 bg-surface-3 rounded w-8 mx-auto"></div>
                  </td>
                  <td class="py-3.5 px-4">
                    <div class="h-4 bg-surface-3 rounded-full w-14 mx-auto"></div>
                  </td>
                  <td class="py-3.5 px-4">
                    <div class="h-3 bg-surface-3 rounded w-16 mx-auto"></div>
                  </td>
                  <td class="py-3.5 pl-4 text-right">
                    <div class="h-5 bg-surface-3 rounded w-14 ml-auto"></div>
                  </td>
                </tr>
            `).join('');
        };

        try {
            // Visual feedback - dynamic shimmering skeleton loaders
            renderSkeleton();
            
            const res = await fetch(`/api/journal?${params.toString()}`);
            const data = await res.json();
            
            if (data.success) {
                renderTable(data.entries);
                renderPagination(data.pagination);
            }
        } catch (err) {
            console.error('Fetch failed:', err);
        }
    };

    const fetchSuggestions = async (q) => {
        if (q.length < 2) {
            suggestionsBox.classList.add('hidden');
            return;
        }

        try {
            const res = await fetch(`/api/journal/suggestions?q=${encodeURIComponent(q)}`);
            const data = await res.json();
            
            if (data.success && data.suggestions.length > 0) {
                renderSuggestions(data.suggestions);
            } else {
                suggestionsBox.classList.add('hidden');
            }
        } catch (err) {
            console.error('Suggestions fetch failed:', err);
        }
    };

    const renderSuggestions = (suggestions) => {
        suggestionsBox.innerHTML = suggestions.map(s => `
            <div class="px-4 py-2 hover:bg-surface-2 cursor-pointer font-mono text-xs text-text-primary border-b border-border-default/30 last:border-0 transition-colors" onclick="selectSuggestion('${s.replace(/'/g, "\\'")}')">
                ${s}
            </div>
        `).join('');
        suggestionsBox.classList.remove('hidden');
    };

    window.selectSuggestion = (title) => {
        searchInput.value = title;
        suggestionsBox.classList.add('hidden');
        fetchEntries(true);
    };

    // Close suggestions on outside click
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
            suggestionsBox.classList.add('hidden');
        }
    });

    const renderTable = (entries) => {
        if (!entries || entries.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="py-16 text-center">
                        <div class="w-12 h-12 border border-border-default border-dashed rounded-lg mx-auto flex items-center justify-center mb-3">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-text-tertiary"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </div>
                        <p class="font-mono text-xs text-text-secondary uppercase tracking-widest">No matching records found.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = entries.map(entry => {
            const date = new Date(entry.createdAt);
            const dateStr = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            
            return `
                <tr class="border-b border-border-default/50 table-row cursor-pointer group" onclick="window.location.href='/entries/${entry._id}'">
                  <td class="py-3.5 pr-4">
                    <div class="font-mono text-[11px] text-text-primary">${dateStr}</div>
                    <div class="font-mono text-[10px] text-text-tertiary mt-0.5">${timeStr}</div>
                  </td>
                  <td class="py-3.5 px-4">
                    <div class="font-medium text-text-primary truncate max-w-[300px] md:max-w-[400px] group-hover:text-accent-amber transition-colors">${escapeHtml(entry.title)}</div>
                    ${entry.attachments && entry.attachments.length > 0 ? `
                      <div class="flex items-center gap-1 mt-1 text-text-tertiary">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                        <span class="font-mono text-[9px]">${entry.attachments.length} attached</span>
                      </div>
                    ` : ''}
                  </td>
                  <td class="py-3.5 px-4 font-mono text-[11px] text-text-secondary text-center">${entry.duration}m</td>
                  <td class="py-3.5 px-4 text-center">
                    <span class="font-mono text-[10px] uppercase tracking-wider badge-${entry.difficulty}">${entry.difficulty}</span>
                  </td>
                  <td class="py-3.5 px-4 text-center">
                    <span class="font-mono text-[10px] text-text-secondary uppercase">${entry.category || 'General'}</span>
                  </td>
                  <td class="py-3.5 pl-4 text-right">
                    <span class="badge badge-${entry.status}">${entry.status}</span>
                  </td>
                </tr>
            `;
        }).join('');
    };

    const renderPagination = (pagination) => {
        const info = document.getElementById('pagination-info');
        const controls = document.getElementById('pagination-controls');
        
        if (!info || !controls) return;

        const start = pagination.total === 0 ? 0 : ((pagination.page - 1) * pagination.limit) + 1;
        const end = ((pagination.page - 1) * pagination.limit) + pagination.limit;
        const actualEnd = Math.min(end, pagination.total);

        info.textContent = `SHOWING ${start}-${actualEnd} OF ${pagination.total}`;

        controls.innerHTML = `
            <button class="w-7 h-7 border border-border-default rounded flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-border-emphasis transition-all disabled:opacity-50 disabled:pointer-events-none" 
                    ${pagination.page <= 1 ? 'disabled' : ''}
                    onclick="changePage(${pagination.page - 1})">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <button class="w-7 h-7 border border-border-default rounded flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-border-emphasis transition-all disabled:opacity-50 disabled:pointer-events-none"
                    ${pagination.page >= pagination.pages ? 'disabled' : ''}
                    onclick="changePage(${pagination.page + 1})">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
        `;
    };

    const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const val = searchInput.value.trim();
            clearTimeout(searchTimeout);
            // Faster feedback: 300ms instead of 500ms
            searchTimeout = setTimeout(() => {
                fetchEntries(true);
                fetchSuggestions(val);
            }, 300);
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                clearTimeout(searchTimeout);
                fetchEntries(true);
            }
        });
    }

    if (statusFilter) statusFilter.addEventListener('change', () => fetchEntries(true));
    if (diffFilter) diffFilter.addEventListener('change', () => fetchEntries(true));
    if (categoryFilter) categoryFilter.addEventListener('change', () => fetchEntries(true));

    // Expose changePage globally for the onclick handlers
    window.changePage = (page) => {
        currentPage = page;
        fetchEntries(false);
    };
});
