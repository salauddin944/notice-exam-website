// ===== ADMIN DASHBOARD LOGIC WITH SUPABASE =====

let countdownInterval;

// Check if already logged in
window.addEventListener('load', function() {
    if (sessionStorage.getItem('adminLoggedIn') === 'true') {
        showDashboard();
    }
});

// Handle Enter key on password input
document.getElementById('passwordInput')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        login();
    }
});

// Login function
function login() {
    const password = document.getElementById('passwordInput').value;
    if (password === ADMIN_PASSWORD) {
        sessionStorage.setItem('adminLoggedIn', 'true');
        showDashboard();
    } else {
        alert('Incorrect password!');
    }
}

// Logout function
function logout() {
    sessionStorage.removeItem('adminLoggedIn');
    window.location.reload();
}

// Show dashboard
function showDashboard() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'block';
    loadAdminNotices();
    loadAdminExams();
}

// ===== NOTICES MANAGEMENT =====

async function addNotice() {
    const input = document.getElementById('noticeInput');
    const text = input.value.trim();

    if (!text) {
        alert('Please enter notice text');
        return;
    }

    try {
        const { error } = await supabase
            .from('notices')
            .insert([
                {
                    text: text,
                    date: new Date().toLocaleString()
                }
            ]);

        if (error) throw error;

        input.value = '';
        alert('Notice added successfully!');
    } catch (error) {
        console.error('Error adding notice:', error);
        alert('Error adding notice. Please try again.');
    }
}

async function loadAdminNotices() {
    try {
        const { data, error } = await supabase
            .from('notices')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const container = document.getElementById('adminNoticesList');

        if (!data || data.length === 0) {
            container.innerHTML = '<p class="empty-message">No notices yet</p>';
            return;
        }

        container.innerHTML = data.map(notice => `
            <div class="admin-item">
                <div class="admin-item-content">
                    <p>${notice.text}</p>
                    <p style="font-size: 0.9rem; color: #999; margin-top: 5px;">${notice.date}</p>
                </div>
                <button onclick="deleteNotice(${notice.id})" class="btn btn-delete">🗑️ Delete</button>
            </div>
        `).join('');

        // Subscribe to real-time changes
        supabase
            .channel('admin-notices-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, () => {
                loadAdminNotices();
            })
            .subscribe();

    } catch (error) {
        console.error('Error loading notices:', error);
    }
}

async function deleteNotice(id) {
    if (!confirm('Are you sure you want to delete this notice?')) {
        return;
    }

    try {
        const { error } = await supabase
            .from('notices')
            .delete()
            .eq('id', id);

        if (error) throw error;

        alert('Notice deleted successfully!');
    } catch (error) {
        console.error('Error deleting notice:', error);
        alert('Error deleting notice. Please try again.');
    }
}

// ===== EXAMS MANAGEMENT =====

async function addExam() {
    const name = document.getElementById('examNameInput').value.trim();
    const date = document.getElementById('examDateInput').value;
    const time = document.getElementById('examTimeInput').value;

    if (!name || !date || !time) {
        alert('Please fill in all exam details');
        return;
    }

    const examDateTime = new Date(`${date}T${time}`);

    try {
        const { error } = await supabase
            .from('exams')
            .insert([
                {
                    name: name,
                    date_time: examDateTime.toISOString()
                }
            ]);

        if (error) throw error;

        // Clear inputs
        document.getElementById('examNameInput').value = '';
        document.getElementById('examDateInput').value = '';
        document.getElementById('examTimeInput').value = '';

        alert('Exam added successfully!');
    } catch (error) {
        console.error('Error adding exam:', error);
        alert('Error adding exam. Please try again.');
    }
}

async function loadAdminExams() {
    try {
        const { data, error } = await supabase
            .from('exams')
            .select('*')
            .order('date_time', { ascending: true });

        if (error) throw error;

        const container = document.getElementById('adminExamsList');

        if (!data || data.length === 0) {
            container.innerHTML = '<p class="empty-message">No exams scheduled</p>';
            return;
        }

        container.innerHTML = data.map(exam => {
            const examDate = new Date(exam.date_time);
            const countdown = calculateCountdown(examDate);

            return `
                <div class="admin-item">
                    <div class="admin-item-content">
                        <h4>${exam.name}</h4>
                        <p>📅 ${examDate.toLocaleDateString('en-US', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                        })}</p>
                        <p>🕐 ${examDate.toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                        })}</p>
                        <p class="countdown-info ${countdown.expired ? 'expired' : ''}" data-exam-date="${exam.date_time}">
                            ${countdown.expired ? '❌' : '⏱️'} ${countdown.text}
                        </p>
                    </div>
                    <button onclick="deleteExam(${exam.id})" class="btn btn-delete">🗑️ Delete</button>
                </div>
            `;
        }).join('');

        startCountdown();

        // Subscribe to real-time changes
        supabase
            .channel('admin-exams-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'exams' }, () => {
                loadAdminExams();
            })
            .subscribe();

    } catch (error) {
        console.error('Error loading exams:', error);
    }
}

async function deleteExam(id) {
    if (!confirm('Are you sure you want to delete this exam?')) {
        return;
    }

    try {
        const { error } = await supabase
            .from('exams')
            .delete()
            .eq('id', id);

        if (error) throw error;

        alert('Exam deleted successfully!');
    } catch (error) {
        console.error('Error deleting exam:', error);
        alert('Error deleting exam. Please try again.');
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
        document.querySelectorAll('.countdown-info:not(.expired)').forEach(element => {
            const examDate = new Date(element.dataset.examDate);
            const countdown = calculateCountdown(examDate);

            element.textContent = `${countdown.expired ? '❌' : '⏱️'} ${countdown.text}`;

            if (countdown.expired) {
                element.classList.add('expired');
            }
        });
    }, 1000);
}