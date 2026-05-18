document.addEventListener('DOMContentLoaded', () => {
    // Check if dashboard data was injected
    if (!window.DASHBOARD_DATA) return;

    const data = window.DASHBOARD_DATA;

    // Chart.js Global Defaults for Oxide Theme
    Chart.defaults.color = '#8C8A97'; // text-secondary
    Chart.defaults.font.family = "'JetBrains Mono', 'Geist Mono', monospace";
    Chart.defaults.font.size = 10;
    Chart.defaults.plugins.tooltip.backgroundColor = '#111116'; // surface-1
    Chart.defaults.plugins.tooltip.titleColor = '#F0EDE6'; // text-primary
    Chart.defaults.plugins.tooltip.bodyColor = '#8C8A97'; // text-secondary
    Chart.defaults.plugins.tooltip.borderColor = '#3C3C48'; // border-emphasis
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.cornerRadius = 4;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.displayColors = false;

    // ── Weekly Activity Bar Chart ──
    const weeklyCtx = document.getElementById('weeklyChart');
    if (weeklyCtx && data.weeklySummary) {
        // Map data to the last 7 days
        const labels = [];
        const chartData = [];
        const today = new Date();
        
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const shortDay = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
            
            labels.push(shortDay);
            
            // Find data for this date
            const entry = data.weeklySummary.find(s => s._id === dateStr);
            chartData.push(entry ? parseFloat((entry.duration / 60).toFixed(1)) : 0);
        }

        new Chart(weeklyCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Hours Logged',
                    data: chartData,
                    backgroundColor: '#F0A500', // accent-amber
                    hoverBackgroundColor: '#FFB81C',
                    borderRadius: 2,
                    barPercentage: 0.5,
                    categoryPercentage: 0.8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 800,
                    easing: 'easeOutQuart'
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#26262E', // border-default
                            drawBorder: false,
                        },
                        border: { display: false },
                        ticks: {
                            stepSize: 1,
                            padding: 10
                        }
                    },
                    x: {
                        grid: {
                            display: false,
                            drawBorder: false,
                        },
                        border: { display: false }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.raw} hrs`
                        }
                    }
                }
            }
        });
    }

    // ── Complexity Distribution Donut Chart ──
    const mixCtx = document.getElementById('mixChart');
    if (mixCtx && data.productivity) {
        const prodData = data.productivity;
        const getCount = (level) => {
            const item = prodData.find(p => p._id === level);
            return item ? item.count : 0;
        };

        const values = [getCount('low'), getCount('medium'), getCount('high')];
        // Only render if there is data, else show empty state ring
        const hasData = values.some(v => v > 0);

        new Chart(mixCtx, {
            type: 'doughnut',
            data: {
                labels: ['Low', 'Nominal', 'High'],
                datasets: [{
                    data: hasData ? values : [1],
                    backgroundColor: hasData ? [
                        '#22C55E', // success (Low)
                        '#F0A500', // amber (Nominal)
                        '#EF4444'  // danger (High)
                    ] : ['#26262E'], // Empty state
                    borderWidth: 0,
                    hoverOffset: hasData ? 4 : 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: hasData,
                        callbacks: {
                            label: (context) => ` ${context.label}: ${context.raw} entries`
                        }
                    }
                }
            }
        });
    }
});

// Draft clearing function
async function clearDraft() {
    try {
        const res = await fetch('/api/journal/draft', { method: 'DELETE' });
        if (res.ok) {
            window.location.reload();
        }
    } catch (err) {
        console.error('Failed to clear draft', err);
    }
}
