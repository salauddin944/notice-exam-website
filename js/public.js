// ===== PUBLIC PAGE LOGIC WITH SUPABASE =====

let countdownInterval;

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    loadNotices();
    loadExams();
});

// Load notices from Supabase in real-time
async function loadNotices() {
    try {
        // Get notices ordered by creation date
        const { data, error } = await supabase
            .from('notices')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const noticesList = document.getElementById('noticesList');

        if (!data || data.length === 0) {
            noticesList.innerHTML = '<p class="empty-message">No notices at the moment</p>';
            return;
        }

        noticesList.innerHTML = data.map(notice => `
            <div class="notice-card">
                <p>${notice.text}</p>
                <p class="notice-date">${notice.date}</p>
            </div>
        `).join('');

        // Subscribe to real-time changes
        supabase
            .channel('notices-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, () => {
                loadNotices();
            })
            .subscribe();

    } catch (error) {
        console.error('Error loading notices:', error);
        document.getElementById('noticesList').innerHTML =
            '<p class="empty-message">Error loading notices. Please refresh.</p>';
    }
}

// Load exams from Supabase in real-time
async function loadExams() {
    try {
        // Get exams ordered by date
        const { data, error } = await supabase
            .from('exams')
            .select('*')
            .order('date_time', { ascending: true });

        if (error) throw error;

        const examsList = document.getElementById('examsList');

        if (!data || data.length === 0) {
            examsList.innerHTML = '<p class="empty-message">No exams scheduled</p>';
            return;
        }

        examsList.innerHTML = data.map(exam => {
            const examDate = new Date(exam.date_time);
            const countdown = calculateCountdown(examDate);
            const isExpired = countdown.expired;

            return `
                <div class="exam-card ${isExpired ? 'expired' : ''}">
                    <h3>${exam.name}</h3>
                    <div class="exam-details">
                        <div class="exam-detail">
                            📅 ${examDate.toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })}
                        </div>
                        <div class="exam-detail">
                            🕐 ${examDate.toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </div>
                    </div>
                    <div class="countdown-box ${isExpired ? 'expired' : ''}" data-exam-date="${exam.date_time}">
                        <div class="countdown-label">Time Remaining</div>
                        <div class="countdown-time">${countdown.text}</div>
                    </div>
                </div>
            `;
        }).join('');

        startCountdown();

        // Subscribe to real-time changes
        supabase
            .channel('exams-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'exams' }, () => {
                loadExams();
            })
            .subscribe();

    } catch (error) {
        console.error('Error loading exams:', error);
        document.getElementById('examsList').innerHTML =
            '<p class="empty-message">Error loading exams. Please refresh.</p>';
    }
}

// Calculate countdown
function calculateCountdown(targetDate) {
    const now = new Date();
    const diff = targetDate - now;

    if (diff <= 0) {
        return { expired: true, text: 'Exam has passed' };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return {
        expired: false,
        text: `${days}d ${hours}h ${minutes}m ${seconds}s`
    };
}

// Update countdowns every second
function startCountdown() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }

    countdownInterval = setInterval(() => {
        document.querySelectorAll('.countdown-box:not(.expired)').forEach(box => {
            const examDate = new Date(box.dataset.examDate);
            const countdown = calculateCountdown(examDate);
            const timeElement = box.querySelector('.countdown-time');

            if (timeElement) {
                timeElement.textContent = countdown.text;

                if (countdown.expired) {
                    box.classList.add('expired');
                    timeElement.textContent = 'Exam has passed';
                }
            }
        });
    }, 1000);
}