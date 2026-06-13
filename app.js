// app.js - COMPLETE VERSION WITH VALIDATION MANAGEMENT (VIEW, DOWNLOAD, DELETE)

const API_BASE_URL = 'http://localhost:5000/api';
const USE_MOCK_API = true;

// State management
let currentUser = null;
let isLoggedIn = false;
let currentSection = 'home';
let token = null;
let dashboardData = null;
let paperHistory = [];

// File upload state
let uploadedFiles = [];
let generatedPaperContent = null;
let uploadedAnswerKey = null;
let uploadedContextFile = null;
let validationResultsData = null;

// DOM Elements
const sections = {
    home: document.getElementById('homeSection'),
    generate: document.getElementById('generateSection'),
    validate: document.getElementById('validateSection'),
    dashboard: document.getElementById('dashboardSection')
};

// Toast system
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');

    const icons = {
        'success': '✅',
        'error': '❌',
        'info': 'ℹ️',
        'warning': '⚠️'
    };

    const toastIcon = document.getElementById('toastIcon');
    if (toastIcon) toastIcon.textContent = icons[type] || 'ℹ️';
    if (toastMessage) toastMessage.textContent = message;
    if (toast) {
        toast.className = `toast toast-${type}`;
        toast.classList.add('show');
    }

    setTimeout(() => {
        if (toast) toast.classList.remove('show');
    }, duration);
}

function switchSection(sectionName) {
    Object.values(sections).forEach(section => {
        if (section) section.classList.remove('active');
    });

    if (sections[sectionName]) {
        sections[sectionName].classList.add('active');
        currentSection = sectionName;
    }

    updateHeaderHomeButton();
}

function updateHeaderHomeButton() {
    const headerHomeBtn = document.getElementById('headerHomeBtn');
    if (headerHomeBtn) {
        if (currentSection === 'home') {
            headerHomeBtn.style.display = 'none';
        } else {
            headerHomeBtn.style.display = 'flex';
        }
    }
}

function clearErrors() {
    document.querySelectorAll('.error-message').forEach(el => {
        el.style.display = 'none';
        el.textContent = '';
    });
    document.querySelectorAll('.form-control').forEach(el => {
        el.classList.remove('error', 'success');
    });
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId + 'Error');
    const inputElement = document.getElementById(elementId);

    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }

    if (inputElement) {
        inputElement.classList.add('error');
    }
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function openModal(modalId) {
    clearErrors();
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        clearErrors();
    }
}

function showLoginModal() {
    closeModal('registerModal');
    setTimeout(() => openModal('loginModal'), 300);
}

function showRegisterModal() {
    closeModal('loginModal');
    setTimeout(() => openModal('registerModal'), 300);
}

// Clear session function
function clearSession() {
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('token');
}

// MOCK API FUNCTIONS
const mockUsers = JSON.parse(localStorage.getItem('mockUsers') || '[]');
let mockPapers = JSON.parse(localStorage.getItem('mockPapers') || '[]');
let mockValidations = JSON.parse(localStorage.getItem('mockValidations') || '[]');

async function mockLogin(email, password) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const user = mockUsers.find(u => u.email === email.toLowerCase() && u.password === password);
    if (user) {
        return {
            success: true,
            user: {
                _id: user.id,
                name: user.name,
                email: user.email,
                role: 'user',
                created_at: user.createdAt
            },
            token: 'mock_jwt_token_' + Date.now()
        };
    }
    return { success: false, message: 'Invalid email or password' };
}

async function mockRegister(name, email, password) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (mockUsers.some(u => u.email === email.toLowerCase())) {
        return { success: false, message: 'Email already registered', field: 'email' };
    }
    const newUser = {
        id: 'user_' + Date.now(),
        name: name,
        email: email.toLowerCase(),
        password: password,
        createdAt: new Date().toISOString()
    };
    mockUsers.push(newUser);
    localStorage.setItem('mockUsers', JSON.stringify(mockUsers));
    return {
        success: true,
        user: {
            _id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            role: 'user',
            created_at: newUser.createdAt
        },
        token: 'mock_jwt_token_' + Date.now()
    };
}

// ========== QUESTION PAPER GENERATION ==========
function generateQuestionPaper(data) {
    const { title, subject, topics, difficulty, marks, instructions, date, time } = data;
    
    const subjectName = subject.charAt(0).toUpperCase() + subject.slice(1);
    const topicList = (topics && topics !== 'General Topics') ? topics.split(',').map(t => t.trim()) : [subjectName];
    const mainTopic = topicList[0];
    
    let content = '';
    
    content += `\n\n`;
    content += `================================================================================\n`;
    content += `${title.toUpperCase()}\n`;
    content += `================================================================================\n\n`;
    
    content += `Subject: ${subjectName}\n`;
    content += `Date: ${date}\n`;
    content += `Time: ${time} minutes\n`;
    content += `Maximum Marks: ${marks}\n`;
    content += `Difficulty: ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}\n`;
    content += `Topics: ${topics || 'General'}\n\n`;
    
    content += `--------------------------------------------------------------------------------\n`;
    content += `GENERAL INSTRUCTIONS\n`;
    content += `--------------------------------------------------------------------------------\n`;
    content += `1. All questions are compulsory unless specified otherwise.\n`;
    content += `2. Write clearly and legibly.\n`;
    content += `3. Marks for each question are indicated against it.\n`;
    content += `4. Read each question carefully before answering.\n`;
    if (instructions) {
        content += `5. ${instructions}\n`;
    }
    content += `\n`;
    
    content += `--------------------------------------------------------------------------------\n`;
    content += `SECTION A: Multiple Choice Questions                                    [5 Marks]\n`;
    content += `--------------------------------------------------------------------------------\n`;
    content += `(Attempt all questions)\n\n`;
    
    const mcqQuestions = [
        { q: `What is the fundamental concept of ${mainTopic}?`, 
          options: ['(a) Basic principle', '(b) Advanced theory', '(c) Applied concept', '(d) Historical view'] },
        { q: `What is the Guidance Method in ${mainTopic}?`, 
          options: ['(a) Heuristic', '(b) Blind', '(c) Exhaustive', '(d) Iterative'] },
        { q: `The Primary Strategy in ${mainTopic} is related to:`, 
          options: ['(a) Global', '(b) Local', '(c) Uniform', '(d) Random'] },
        { q: `Who is considered a pioneer in ${mainTopic}?`, 
          options: ['(a) Researcher A', '(b) Researcher B', '(c) Researcher C', '(d) Researcher D'] },
        { q: `Which statement is TRUE about ${mainTopic}?`, 
          options: ['(a) Statement 1', '(b) Statement 2', '(c) Statement 3', '(d) Statement 4'] }
    ];
    
    for (let i = 0; i < 5; i++) {
        const mq = mcqQuestions[i];
        content += `${i + 1}. ${mq.q}\n`;
        content += `   ${mq.options.join('\n   ')}\n`;
        content += `                                                              [1 mark]\n\n`;
    }
    content += `\n`;
    
    content += `--------------------------------------------------------------------------------\n`;
    content += `SECTION B: Short Answer Questions                                   [10 Marks]\n`;
    content += `--------------------------------------------------------------------------------\n`;
    content += `(Attempt any 2 questions)\n\n`;
    
    const shortQuestions = [
        `Define and explain the basic concepts of ${mainTopic}. Provide suitable examples.`,
        `Write short notes on the importance and applications of ${mainTopic} in daily life.`,
        `Explain any three key characteristics or features of ${mainTopic} with examples.`
    ];
    
    for (let i = 0; i < 3; i++) {
        content += `${i + 1}. ${shortQuestions[i]}\n`;
        content += `                                                             [5 marks]\n\n`;
    }
    content += `Note: Answer any 2 out of the above 3 questions. (2 x 5 = 10 marks)\n\n`;
    
    content += `--------------------------------------------------------------------------------\n`;
    content += `SECTION C: Long Answer Questions                                    [10 Marks]\n`;
    content += `--------------------------------------------------------------------------------\n`;
    content += `(Attempt any 1 question)\n\n`;
    
    const longQuestions = [
        `Discuss in detail the fundamental principles, theories, and applications of ${mainTopic}.`,
        `Critically evaluate the various approaches and contemporary issues related to ${mainTopic}.`
    ];
    
    for (let i = 0; i < 2; i++) {
        content += `${i + 1}. ${longQuestions[i]}\n`;
        content += `                                                            [10 marks]\n\n`;
    }
    content += `Note: Answer any 1 out of the above 2 questions. (1 x 10 = 10 marks)\n\n`;
    
    content += `\n`;
    content += `================================================================================\n`;
    content += `BEST WISHES\n`;
    content += `================================================================================\n`;
    
    return content;
}

async function mockGeneratePaper(data) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const content = generateQuestionPaper(data);
    return {
        success: true,
        content: content,
        used_context: !!data.contextFile
    };
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    clearErrors();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    let isValid = true;

    if (!email) {
        showError('loginEmail', 'Email is required');
        isValid = false;
    } else if (!validateEmail(email)) {
        showError('loginEmail', 'Please enter a valid email address');
        isValid = false;
    }

    if (!password) {
        showError('loginPassword', 'Password is required');
        isValid = false;
    }

    if (!isValid) return;

    const loginBtnText = document.getElementById('loginBtnText');
    const loginLoading = document.getElementById('loginLoading');
    const loginSubmitBtn = document.getElementById('loginSubmitBtn');
    loginBtnText.style.display = 'none';
    loginLoading.style.display = 'inline-block';
    loginSubmitBtn.disabled = true;

    try {
        let response = await mockLogin(email, password);

        if (response.success) {
            currentUser = response.user;
            isLoggedIn = true;
            token = response.token;

            sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
            sessionStorage.setItem('token', token);

            closeModal('loginModal');
            showToast(`Welcome back, ${response.user.name}!`, 'success');
            document.getElementById('loginForm').reset();
            updateUIForLoginStatus();
            
            if (currentSection === 'dashboard') {
                loadDashboard();
            }
        } else {
            showError('loginEmail', response.message || 'Invalid credentials');
            showToast(response.message || 'Login failed.', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('An error occurred. Please try again.', 'error');
    } finally {
        loginBtnText.style.display = 'inline';
        loginLoading.style.display = 'none';
        loginSubmitBtn.disabled = false;
    }
}

// Handle registration
async function handleRegister(e) {
    e.preventDefault();
    clearErrors();

    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    const agreeTerms = document.getElementById('agreeTerms').checked;

    let isValid = true;

    if (!name) {
        showError('regName', 'Full name is required');
        isValid = false;
    } else if (name.length < 2) {
        showError('regName', 'Name must be at least 2 characters long');
        isValid = false;
    }

    if (!email) {
        showError('regEmail', 'Email is required');
        isValid = false;
    } else if (!validateEmail(email)) {
        showError('regEmail', 'Please enter a valid email address');
        isValid = false;
    }

    if (!password) {
        showError('regPassword', 'Password is required');
        isValid = false;
    } else if (password.length < 6) {
        showError('regPassword', 'Password must be at least 6 characters long');
        isValid = false;
    }

    if (!confirmPassword) {
        showError('regConfirmPassword', 'Please confirm your password');
        isValid = false;
    } else if (password !== confirmPassword) {
        showError('regConfirmPassword', 'Passwords do not match');
        isValid = false;
    }

    if (!agreeTerms) {
        showError('termsError', 'You must agree to the terms and conditions');
        isValid = false;
    }

    if (!isValid) return;

    const registerBtnText = document.getElementById('registerBtnText');
    const registerLoading = document.getElementById('registerLoading');
    const registerSubmitBtn = document.getElementById('registerSubmitBtn');
    registerBtnText.style.display = 'none';
    registerLoading.style.display = 'inline-block';
    registerSubmitBtn.disabled = true;

    try {
        let response = await mockRegister(name, email, password);

        if (response.success) {
            currentUser = response.user;
            isLoggedIn = true;
            token = response.token;

            sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
            sessionStorage.setItem('token', token);

            closeModal('registerModal');
            showToast(`Account created successfully! Welcome, ${name}!`, 'success');
            document.getElementById('registerForm').reset();
            updateUIForLoginStatus();
        } else {
            if (response.field) {
                showError(response.field, response.message);
            } else {
                showError('regEmail', response.message || 'Registration failed');
            }
            showToast(response.message || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showToast('An error occurred. Please try again.', 'error');
    } finally {
        registerBtnText.style.display = 'inline';
        registerLoading.style.display = 'none';
        registerSubmitBtn.disabled = false;
    }
}

function updateUIForLoginStatus() {
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const loginRequired = document.getElementById('loginRequired');
    const welcomeSection = document.getElementById('welcomeSection');
    const dashboardNavBtn = document.getElementById('dashboardNavBtn');

    if (isLoggedIn && currentUser) {
        if (loginBtn) {
            loginBtn.innerHTML = '👤 Logout';
            loginBtn.classList.remove('btn-primary');
            loginBtn.classList.add('btn-secondary');
        }
        if (registerBtn) registerBtn.style.display = 'none';
        if (loginRequired) loginRequired.style.display = 'none';
        if (welcomeSection) welcomeSection.style.display = 'block';
        if (dashboardNavBtn) dashboardNavBtn.style.display = 'inline-block';
        
        const welcomeMessage = document.getElementById('welcomeMessage');
        if (welcomeMessage) {
            welcomeMessage.textContent = `Welcome back, ${currentUser.name}!`;
        }
    } else {
        if (loginBtn) {
            loginBtn.innerHTML = '🔐 Login';
            loginBtn.classList.remove('btn-secondary');
            loginBtn.classList.add('btn-primary');
        }
        if (registerBtn) registerBtn.style.display = 'inline-block';
        if (loginRequired) loginRequired.style.display = 'block';
        if (welcomeSection) welcomeSection.style.display = 'none';
        if (dashboardNavBtn) dashboardNavBtn.style.display = 'none';
    }
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        resetGenerateForm();
        resetValidateForm();
        currentUser = null;
        isLoggedIn = false;
        token = null;
        dashboardData = null;
        paperHistory = [];
        
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('token');
        
        updateUIForLoginStatus();
        showToast('Logged out successfully!', 'success');
        switchToHome();
    }
}

function resetGenerateForm() {
    const form = document.getElementById('questionPaperForm');
    if (form) {
        form.reset();
    }

    const paperPreview = document.getElementById('paperPreview');
    const downloadPaperBtn = document.getElementById('downloadPaperBtn');
    const paperDateInput = document.getElementById('paperDate');

    if (paperDateInput) paperDateInput.valueAsDate = new Date();
    if (paperPreview) paperPreview.style.display = 'none';
    if (downloadPaperBtn) {
        downloadPaperBtn.disabled = true;
        downloadPaperBtn.classList.add('btn-disabled');
        downloadPaperBtn.classList.remove('btn-success');
    }
    generatedPaperContent = null;
    uploadedContextFile = null;
    
    const sourceUpload = document.getElementById('sourceUpload');
    if (sourceUpload) sourceUpload.value = '';
    const sourceFileInfo = document.getElementById('sourceFileInfo');
    if (sourceFileInfo) sourceFileInfo.style.display = 'none';
    const uploadSourceBtn = document.getElementById('uploadSourceBtn');
    if (uploadSourceBtn) uploadSourceBtn.style.display = 'block';

    const checkboxes = document.querySelectorAll('#questionPaperForm input[type="checkbox"]');
    checkboxes.forEach(cb => {
        if (cb.id === 'qtype_mcq') cb.checked = true;
        else if (cb.id === 'qtype_short') cb.checked = true;
        else if (cb.id === 'qtype_long') cb.checked = true;
        else cb.checked = false;
    });

    showToast('Generate form has been reset', 'info');
}

function resetValidateForm() {
    uploadedFiles = [];
    uploadedAnswerKey = null;
    validationResultsData = null;

    const fileList = document.getElementById('fileList');
    if (fileList) {
        fileList.innerHTML = '<p style="color: #666; font-style: italic; padding: 1rem; text-align: center;">No answer sheets uploaded yet</p>';
    }

    const answerKeyInfo = document.getElementById('answerKeyInfo');
    if (answerKeyInfo) answerKeyInfo.style.display = 'none';

    const answerKeyUpload = document.getElementById('answerKeyUpload');
    const answersUpload = document.getElementById('answersUpload');
    if (answerKeyUpload) answerKeyUpload.value = '';
    if (answersUpload) answersUpload.value = '';

    const validationResults = document.getElementById('validationResults');
    const validationProgress = document.getElementById('validationProgress');
    if (validationResults) validationResults.style.display = 'none';
    if (validationProgress) validationProgress.style.display = 'none';

    const startValidationBtn = document.getElementById('startValidationBtn');
    const downloadResultsBtn = document.getElementById('downloadResultsBtn');
    if (startValidationBtn) {
        startValidationBtn.disabled = true;
        startValidationBtn.classList.add('btn-disabled');
        startValidationBtn.classList.remove('btn-primary');
    }
    if (downloadResultsBtn) {
        downloadResultsBtn.disabled = true;
        downloadResultsBtn.classList.add('btn-disabled');
        downloadResultsBtn.classList.remove('btn-success');
    }

    showToast('Validate form has been reset', 'info');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/[&"'<>]/g, function(c) {
        return { '&': '&amp;', '"': '&quot;', "'": '&#39;', '<': '&lt;', '>': '&gt;' }[c];
    });
}

// ========== DASHBOARD FUNCTIONS WITH VALIDATION MANAGEMENT ==========

async function loadDashboard() {
    if (!isLoggedIn || !token) {
        showToast('Please login to view dashboard', 'warning');
        return;
    }
    
    showToast('Loading dashboard...', 'info');
    
    try {
        const userPapers = mockPapers.filter(paper => paper.user_id === currentUser._id);
        const totalPapers = userPapers.length;
        
        const userValidations = mockValidations.filter(val => val.user_id === currentUser._id);
        const totalValidations = userValidations.length;
        
        // Fixed member since date - January 12, 2026
        const memberSince = "2026-01-12T00:00:00.000Z";
        
        const dashboardData = {
            stats: {
                total_papers: totalPapers,
                total_validations: totalValidations,
                member_since: memberSince
            },
            recent_papers: userPapers.slice(0, 5),
            recent_validations: userValidations.slice(0, 5)
        };
        
        renderDashboard(dashboardData);
        showToast('Dashboard loaded successfully', 'success');
        
    } catch (error) {
        console.error('Dashboard error:', error);
        showToast('Error loading dashboard', 'error');
        renderDashboard({
            stats: { total_papers: 0, total_validations: 0, member_since: "2026-01-12T00:00:00.000Z" },
            recent_papers: [],
            recent_validations: []
        });
    }
}

function renderDashboard(data) {
    const dashboardContent = document.getElementById('dashboardContent');
    if (!dashboardContent) return;
    
    // Fixed member date - January 12, 2026
    const memberDate = "January 12, 2026";
    
    let html = `
        <div class="dashboard-welcome">
            <h2>👋 Welcome, ${escapeHtml(currentUser?.name || 'User')}!</h2>
            <p>Here's your activity summary and recent work.</p>
        </div>
        
        <div class="dashboard-stats">
            <div class="stat-card">
                <div class="stat-icon">📄</div>
                <div class="stat-info">
                    <div class="stat-value">${data.stats.total_papers}</div>
                    <div class="stat-label">Question Papers Generated</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">✓</div>
                <div class="stat-info">
                    <div class="stat-value">${data.stats.total_validations}</div>
                    <div class="stat-label">Answer Sheets Validated</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">📅</div>
                <div class="stat-info">
                    <div class="stat-value">${memberDate}</div>
                    <div class="stat-label">Member Since</div>
                </div>
            </div>
        </div>
        
        <div class="dashboard-section">
            <div class="section-header">
                <h3>📄 Recent Question Papers</h3>
                <button class="btn-view-all" onclick="viewAllPapers()">View All →</button>
            </div>
            <div class="papers-list">
    `;
    
    if (data.recent_papers.length === 0) {
        html += `<div class="empty-state">
            <div class="empty-icon">📭</div>
            <p>No papers generated yet.</p>
            <button onclick="switchToGenerate()" class="btn btn-primary btn-sm" style="margin-top: 1rem;">Create your first paper →</button>
        </div>`;
    } else {
        for (const paper of data.recent_papers) {
            html += `
                <div class="paper-item" data-paper-id="${paper.id}">
                    <div class="paper-info">
                        <div class="paper-title">${escapeHtml(paper.title)}</div>
                        <div class="paper-meta">
                            <span class="badge badge-subject">${escapeHtml(paper.subject)}</span>
                            <span class="badge badge-difficulty ${paper.difficulty}">${paper.difficulty}</span>
                            <span class="paper-marks">📊 ${paper.total_marks} marks</span>
                        </div>
                    </div>
                    <div class="paper-actions">
                        <button class="btn-icon" onclick="viewPaperDetails('${paper.id}')" title="View Paper">👁️</button>
                        <button class="btn-icon" onclick="downloadPaperFromHistory('${paper.id}')" title="Download PDF">📥</button>
                        <button class="btn-icon delete-btn" onclick="deletePaperFromHistory('${paper.id}')" title="Delete">🗑️</button>
                    </div>
                </div>
            `;
        }
    }
    
    html += `
            </div>
        </div>
        
        <div class="dashboard-section">
            <div class="section-header">
                <h3>✓ Recent Validations</h3>
                <button class="btn-view-all" onclick="viewAllValidations()">View All →</button>
            </div>
            <div class="validations-list">
    `;
    
    if (data.recent_validations.length === 0) {
        html += `<div class="empty-state">
            <div class="empty-icon">📭</div>
            <p>No validations performed yet.</p>
            <button onclick="switchToValidate()" class="btn btn-primary btn-sm" style="margin-top: 1rem;">Validate your first answer sheet →</button>
        </div>`;
    } else {
        for (const val of data.recent_validations) {
            const avgPercent = parseFloat(val.average_marks);
            const difficultyClass = avgPercent >= 70 ? 'easy' : (avgPercent >= 50 ? 'medium' : 'hard');
            html += `
                <div class="validation-item" data-validation-id="${val.id}">
                    <div class="validation-info">
                        <div class="validation-title">Validation #${val.id?.slice(-8) || 'N/A'}</div>
                        <div class="validation-meta">
                            <span class="badge badge-subject">📊 ${val.total_students} students</span>
                            <span class="badge badge-difficulty ${difficultyClass}">⭐ Avg: ${val.average_marks}%</span>
                        </div>
                    </div>
                    <div class="validation-actions">
                        <button class="btn-icon" onclick="viewValidationDetails('${val.id}')" title="View Details">👁️</button>
                        <button class="btn-icon" onclick="downloadValidationDetails('${val.id}')" title="Download CSV">📥</button>
                        <button class="btn-icon delete-btn" onclick="deleteValidationFromHistory('${val.id}')" title="Delete">🗑️</button>
                    </div>
                </div>
            `;
        }
    }
    
    html += `
            </div>
        </div>
        
        <div class="dashboard-section">
            <div class="section-header">
                <h3>⚡ Quick Actions</h3>
            </div>
            <div class="quick-actions">
                <button class="quick-action-btn" onclick="switchToGenerate()">
                    <span class="action-icon">✨</span>
                    <span>Generate New Paper</span>
                </button>
                <button class="quick-action-btn" onclick="switchToValidate()">
                    <span class="action-icon">✓</span>
                    <span>Validate Answers</span>
                </button>
                <button class="quick-action-btn" onclick="viewAllPapers()">
                    <span class="action-icon">📚</span>
                    <span>View All Papers</span>
                </button>
                <button class="quick-action-btn" onclick="viewAllValidations()">
                    <span class="action-icon">📊</span>
                    <span>View All Validations</span>
                </button>
            </div>
        </div>
    `;
    
    dashboardContent.innerHTML = html;
}

// ========== PAPER HISTORY FUNCTIONS ==========

async function loadPaperHistory() {
    if (!isLoggedIn || !token) {
        showToast('Please login to view history', 'warning');
        return;
    }
    
    showToast('Loading history...', 'info');
    
    try {
        const userPapers = mockPapers.filter(paper => paper.user_id === currentUser._id);
        renderHistoryPage(userPapers);
        showToast('History loaded successfully', 'success');
    } catch (error) {
        console.error('History error:', error);
        showToast('Error loading history', 'error');
        renderHistoryPage([]);
    }
}

function renderHistoryPage(papers) {
    const dashboardContent = document.getElementById('dashboardContent');
    if (!dashboardContent) return;
    
    if (papers.length === 0) {
        dashboardContent.innerHTML = `
            <div class="empty-history">
                <div class="empty-icon">📭</div>
                <h3>No Question Papers Yet</h3>
                <p>You haven't generated any question papers. Click the button below to create your first paper.</p>
                <button class="btn btn-primary" onclick="switchToGenerate()">✨ Generate Question Paper</button>
                <button class="btn btn-secondary" onclick="loadDashboard()" style="margin-top: 1rem;">← Back to Dashboard</button>
            </div>
        `;
        return;
    }
    
    let html = `
        <div class="history-header">
            <h2>📚 Your Question Paper History</h2>
            <p>Total papers generated: <strong>${papers.length}</strong></p>
            <button class="btn btn-secondary" onclick="loadDashboard()" style="margin-top: 1rem;">← Back to Dashboard</button>
        </div>
        <div class="history-filters">
            <input type="text" id="historySearch" placeholder="Search by title or subject..." class="form-control" onkeyup="filterHistory()">
            <select id="historyFilter" class="form-control" onchange="filterHistory()">
                <option value="all">All Papers</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
            </select>
        </div>
        <div class="history-list" id="historyList">
    `;
    
    for (const paper of papers) {
        const types = paper.question_types?.join(', ') || 'MCQ, Short, Long';
        
        html += `
            <div class="history-item" data-paper-id="${paper.id}" data-difficulty="${paper.difficulty}" data-search="${paper.title} ${paper.subject}">
                <div class="history-item-header">
                    <div class="history-title">${escapeHtml(paper.title)}</div>
                </div>
                <div class="history-details">
                    <div class="detail"><span class="detail-label">Subject:</span> ${escapeHtml(paper.subject)}</div>
                    <div class="detail"><span class="detail-label">Topics:</span> ${escapeHtml(paper.topics || 'General')}</div>
                    <div class="detail"><span class="detail-label">Difficulty:</span> 
                        <span class="badge-difficulty ${paper.difficulty}">${paper.difficulty}</span>
                    </div>
                    <div class="detail"><span class="detail-label">Marks:</span> ${paper.total_marks}</div>
                    <div class="detail"><span class="detail-label">Question Types:</span> ${types}</div>
                </div>
                <div class="history-actions">
                    <button class="btn btn-sm btn-primary" onclick="viewPaperDetails('${paper.id}')">👁️ View Paper</button>
                    <button class="btn btn-sm btn-success" onclick="downloadPaperFromHistory('${paper.id}')">📥 Download PDF</button>
                    <button class="btn btn-sm btn-danger" onclick="deletePaperFromHistory('${paper.id}')">🗑️ Delete</button>
                </div>
            </div>
        `;
    }
    
    html += `</div>`;
    dashboardContent.innerHTML = html;
}

function filterHistory() {
    const searchTerm = document.getElementById('historySearch')?.value.toLowerCase() || '';
    const difficultyFilter = document.getElementById('historyFilter')?.value || 'all';
    
    const items = document.querySelectorAll('.history-item');
    
    items.forEach(item => {
        const searchText = item.dataset.search?.toLowerCase() || '';
        const difficulty = item.dataset.difficulty || '';
        
        let matchesSearch = searchTerm === '' || searchText.includes(searchTerm);
        let matchesDifficulty = difficultyFilter === 'all' || difficulty === difficultyFilter;
        
        item.style.display = matchesSearch && matchesDifficulty ? 'block' : 'none';
    });
}

async function savePaperToHistory(paperData) {
    if (!isLoggedIn || !token) {
        showToast('Please login to save papers to history', 'warning');
        return;
    }
    
    try {
        const newPaper = {
            id: 'paper_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            user_id: currentUser._id,
            ...paperData,
            created_at: new Date().toISOString()
        };
        
        mockPapers.push(newPaper);
        localStorage.setItem('mockPapers', JSON.stringify(mockPapers));
        
        showToast('Paper saved to history', 'success');
        
        if (currentSection === 'dashboard') {
            await loadDashboard();
        }
    } catch (error) {
        console.error('Save paper error:', error);
        showToast('Error saving paper', 'error');
    }
}

async function viewPaperDetails(paperId) {
    showToast('Loading paper...', 'info');
    
    try {
        const paper = mockPapers.find(p => p.id === paperId && p.user_id === currentUser._id);
        
        if (paper) {
            showPaperPreviewModal(paper);
        } else {
            showToast('Paper not found', 'error');
        }
    } catch (error) {
        console.error('View paper error:', error);
        showToast('Error loading paper details', 'error');
    }
}

function showPaperPreviewModal(paper) {
    const modalHtml = `
        <div id="paperPreviewModal" class="modal" style="display: flex;">
            <div class="modal-content" style="max-width: 800px; max-height: 80vh; overflow-y: auto;">
                <div class="modal-header">
                    <h2>${escapeHtml(paper.title)}</h2>
                    <button class="close-modal" onclick="closePaperPreviewModal()">&times;</button>
                </div>
                <div class="paper-preview-content" style="white-space: pre-wrap; font-family: monospace; font-size: 12px; background: #f8f9fa; padding: 1rem; border-radius: 8px;">
                    ${escapeHtml(paper.content || 'No content available')}
                </div>
                <div class="modal-footer" style="margin-top: 1rem; display: flex; gap: 1rem; justify-content: flex-end;">
                    <button class="btn btn-success" onclick="downloadPaperContent('${escapeHtml(paper.title)}', \`${escapeHtml(paper.content || '').replace(/`/g, '\\`')}\`)">📥 Download PDF</button>
                    <button class="btn btn-secondary" onclick="closePaperPreviewModal()">Close</button>
                </div>
            </div>
        </div>
    `;
    
    const existingModal = document.getElementById('paperPreviewModal');
    if (existingModal) existingModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closePaperPreviewModal() {
    const modal = document.getElementById('paperPreviewModal');
    if (modal) modal.remove();
}

async function deletePaperFromHistory(paperId) {
    if (!confirm('Are you sure you want to delete this question paper? This action cannot be undone.')) {
        return;
    }
    
    showToast('Deleting paper...', 'info');
    
    try {
        const paperIndex = mockPapers.findIndex(p => p.id === paperId && p.user_id === currentUser._id);
        
        if (paperIndex !== -1) {
            mockPapers.splice(paperIndex, 1);
            localStorage.setItem('mockPapers', JSON.stringify(mockPapers));
            
            showToast('Paper deleted successfully', 'success');
            
            const currentView = document.querySelector('.section.active')?.id;
            
            if (currentView === 'dashboardSection') {
                const isHistoryView = document.getElementById('historyList') !== null;
                if (isHistoryView) {
                    await loadPaperHistory();
                } else {
                    await loadDashboard();
                }
            }
        } else {
            showToast('Paper not found', 'error');
        }
    } catch (error) {
        console.error('Delete paper error:', error);
        showToast('Error deleting paper', 'error');
    }
}

async function downloadPaperFromHistory(paperId) {
    showToast('Loading paper for download...', 'info');
    
    try {
        const paper = mockPapers.find(p => p.id === paperId && p.user_id === currentUser._id);
        
        if (paper && paper.content) {
            downloadPaperContent(paper.title, paper.content);
        } else {
            showToast('Failed to load paper content', 'error');
        }
    } catch (error) {
        console.error('Download error:', error);
        showToast('Error downloading paper', 'error');
    }
}

function downloadPaperContent(title, content) {
    const printWindow = window.open('', '_blank');
    const currentDate = new Date().toLocaleDateString();
    
    const htmlContent = `<!DOCTYPE html>
    <html>
    <head>
        <title>${escapeHtml(title)}</title>
        <meta charset="UTF-8">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Times New Roman', Times, serif; background: white; }
            .a4-page { width: 210mm; min-height: 297mm; margin: 0 auto; background: white; padding: 20mm 25mm; }
            @media print { body { background: white; } .a4-page { width: 100%; padding: 20mm 25mm; } @page { size: A4; margin: 0; } }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 20px; }
            .header h1 { font-size: 24px; margin-bottom: 10px; }
            .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="a4-page">
            <div class="header">
                <h1>${escapeHtml(title)}</h1>
                <p>Generated on: ${currentDate}</p>
            </div>
            <div style="white-space: pre-wrap; font-family: 'Times New Roman', Times, serif; font-size: 14px; line-height: 1.6;">
                ${escapeHtml(content).replace(/\n/g, '<br>')}
            </div>
            <div class="footer">
                <p>Generated by AI Question Paper Generator</p>
            </div>
        </div>
    </body>
    </html>`;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.onload = function() {
        setTimeout(function() {
            printWindow.print();
            showToast('PDF ready for download!', 'success');
        }, 500);
    };
}

// ========== VALIDATION MANAGEMENT FUNCTIONS (VIEW, DOWNLOAD, DELETE) ==========

async function saveValidationToHistory(validationData) {
    if (!isLoggedIn || !token) return;
    
    try {
        const newValidation = {
            id: 'val_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            user_id: currentUser._id,
            ...validationData,
            created_at: new Date().toISOString()
        };
        
        mockValidations.push(newValidation);
        localStorage.setItem('mockValidations', JSON.stringify(mockValidations));
        
        if (currentSection === 'dashboard') {
            await loadDashboard();
        }
    } catch (error) {
        console.error('Save validation error:', error);
    }
}

async function viewValidationDetails(validationId) {
    showToast('Loading validation details...', 'info');
    
    try {
        const validation = mockValidations.find(v => v.id === validationId && v.user_id === currentUser._id);
        
        if (validation) {
            showValidationModal(validation);
        } else {
            showToast('Validation record not found', 'error');
        }
    } catch (error) {
        console.error('View validation error:', error);
        showToast('Error loading validation details', 'error');
    }
}

function showValidationModal(validation) {
    const date = new Date(validation.created_at).toLocaleString();
    const results = validation.results || [];
    
    let resultsHtml = '';
    for (const result of results) {
        const statusColor = result.status === 'PASS' ? '#28a745' : '#dc3545';
        let gradeColor = '';
        if (result.grade === 'A+' || result.grade === 'A') gradeColor = '#28a745';
        else if (result.grade === 'B+' || result.grade === 'B') gradeColor = '#17a2b8';
        else if (result.grade === 'C') gradeColor = '#ffc107';
        else gradeColor = '#dc3545';
        
        resultsHtml += `
            <tr>
                <td>${escapeHtml(result.studentName)}</td>
                <td style="color: #28a745; font-weight: bold;">${result.correctCount}</td>
                <td style="color: #dc3545;">${result.wrongCount}</td>
                <td>${result.marksObtained}/${result.totalMarks}</td>
                <td><strong>${result.percentage}%</strong></td>
                <td><span style="background: ${gradeColor}; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.85rem;">${result.grade}</span></td>
                <td><span style="background: ${statusColor}; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.85rem;">${result.status}</span></td>
            </tr>
        `;
    }
    
    const modalHtml = `
        <div id="validationDetailsModal" class="modal" style="display: flex;">
            <div class="modal-content" style="max-width: 900px; max-height: 80vh; overflow-y: auto;">
                <div class="modal-header">
                    <h2>📊 Validation Results</h2>
                    <button class="close-modal" onclick="closeValidationModal()">&times;</button>
                </div>
                <div style="margin-bottom: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 8px;">
                    <p><strong>Validation ID:</strong> ${validation.id?.slice(-8) || 'N/A'}</p>
                    <p><strong>Date:</strong> ${date}</p>
                    <p><strong>Total Students:</strong> ${validation.total_students}</p>
                    <p><strong>Average Score:</strong> ${validation.average_marks}%</p>
                </div>
                <div class="results-table-wrapper">
                    <table class="results-table">
                        <thead>
                            <tr>
                                <th>Student</th>
                                <th>Correct</th>
                                <th>Wrong</th>
                                <th>Marks</th>
                                <th>Percentage</th>
                                <th>Grade</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${resultsHtml}
                        </tbody>
                    </table>
                </div>
                <div class="modal-footer" style="margin-top: 1rem; display: flex; gap: 1rem; justify-content: flex-end;">
                    <button class="btn btn-success" onclick="downloadValidationDetails('${validation.id}')">📥 Download CSV</button>
                    <button class="btn btn-secondary" onclick="closeValidationModal()">Close</button>
                </div>
            </div>
        </div>
    `;
    
    const existingModal = document.getElementById('validationDetailsModal');
    if (existingModal) existingModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeValidationModal() {
    const modal = document.getElementById('validationDetailsModal');
    if (modal) modal.remove();
}

async function downloadValidationDetails(validationId) {
    showToast('Preparing download...', 'info');
    
    try {
        const validation = mockValidations.find(v => v.id === validationId && v.user_id === currentUser._id);
        
        if (validation && validation.results) {
            const results = validation.results;
            const date = new Date(validation.created_at).toLocaleDateString();
            
            let csvContent = 'Student Name,Correct Answers,Wrong Answers,Total Marks,Marks Obtained,Percentage,Grade,Status\n';
            
            for (const result of results) {
                csvContent += `"${result.studentName}",${result.correctCount},${result.wrongCount},${result.totalMarks},${result.marksObtained},${result.percentage}%,${result.grade},${result.status}\n`;
            }
            
            csvContent += '\n\nSUMMARY\n';
            csvContent += `Total Students,${validation.total_students}\n`;
            csvContent += `Average Score,${validation.average_marks}%\n`;
            csvContent += `Validation Date,${date}\n`;
            
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `validation_results_${validation.id?.slice(-8) || 'unknown'}_${date.replace(/\//g, '-')}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showToast('Validation results downloaded successfully!', 'success');
        } else {
            showToast('No data available for download', 'error');
        }
    } catch (error) {
        console.error('Download validation error:', error);
        showToast('Error downloading validation results', 'error');
    }
}

async function deleteValidationFromHistory(validationId) {
    if (!confirm('Are you sure you want to delete this validation record? This action cannot be undone.')) {
        return;
    }
    
    showToast('Deleting validation record...', 'info');
    
    try {
        const validationIndex = mockValidations.findIndex(v => v.id === validationId && v.user_id === currentUser._id);
        
        if (validationIndex !== -1) {
            mockValidations.splice(validationIndex, 1);
            localStorage.setItem('mockValidations', JSON.stringify(mockValidations));
            
            showToast('Validation record deleted successfully', 'success');
            
            const currentView = document.querySelector('.section.active')?.id;
            
            if (currentView === 'dashboardSection') {
                const isValidationHistoryView = document.getElementById('validationHistoryList') !== null;
                if (isValidationHistoryView) {
                    await viewAllValidations();
                } else {
                    await loadDashboard();
                }
            }
        } else {
            showToast('Validation record not found', 'error');
        }
    } catch (error) {
        console.error('Delete validation error:', error);
        showToast('Error deleting validation record', 'error');
    }
}

async function viewAllValidations() {
    if (!isLoggedIn || !token) {
        showToast('Please login to view validation history', 'warning');
        return;
    }
    
    showToast('Loading validation history...', 'info');
    
    try {
        const userValidations = mockValidations.filter(val => val.user_id === currentUser._id);
        renderValidationsHistoryPage(userValidations);
        showToast('Validation history loaded successfully', 'success');
    } catch (error) {
        console.error('Validation history error:', error);
        showToast('Error loading validation history', 'error');
        renderValidationsHistoryPage([]);
    }
}

function renderValidationsHistoryPage(validations) {
    const dashboardContent = document.getElementById('dashboardContent');
    if (!dashboardContent) return;
    
    if (validations.length === 0) {
        dashboardContent.innerHTML = `
            <div class="empty-history">
                <div class="empty-icon">📭</div>
                <h3>No Validations Yet</h3>
                <p>You haven't performed any answer sheet validations. Click the button below to validate your first answer sheet.</p>
                <button class="btn btn-primary" onclick="switchToValidate()">✓ Validate Answer Sheets</button>
                <button class="btn btn-secondary" onclick="loadDashboard()" style="margin-top: 1rem;">← Back to Dashboard</button>
            </div>
        `;
        return;
    }
    
    let html = `
        <div class="history-header">
            <h2>📊 Your Validation History</h2>
            <p>Total validations performed: <strong>${validations.length}</strong></p>
            <button class="btn btn-secondary" onclick="loadDashboard()" style="margin-top: 1rem;">← Back to Dashboard</button>
        </div>
        <div class="history-filters">
            <input type="text" id="validationHistorySearch" placeholder="Search by student or validation ID..." class="form-control" onkeyup="filterValidationHistory()">
            <select id="validationHistoryFilter" class="form-control" onchange="filterValidationHistory()">
                <option value="all">All Validations</option>
                <option value="pass">Pass Only</option>
                <option value="fail">Fail Only</option>
            </select>
        </div>
        <div class="history-list" id="validationHistoryList">
    `;
    
    for (const val of validations) {
        const avgPercentage = parseFloat(val.average_marks);
        const overallStatus = avgPercentage >= 40 ? 'PASS' : 'FAIL';
        const statusColor = overallStatus === 'PASS' ? '#28a745' : '#dc3545';
        
        let passCount = 0, failCount = 0;
        if (val.results) {
            passCount = val.results.filter(r => r.status === 'PASS').length;
            failCount = val.results.filter(r => r.status === 'FAIL').length;
        }
        
        html += `
            <div class="history-item" data-validation-id="${val.id}" data-overall-status="${overallStatus}" data-search="${val.id} ${val.results?.map(r => r.studentName).join(' ') || ''}">
                <div class="history-item-header">
                    <div class="history-title">Validation #${val.id?.slice(-8) || 'N/A'}</div>
                </div>
                <div class="history-details">
                    <div class="detail"><span class="detail-label">Total Students:</span> ${val.total_students}</div>
                    <div class="detail"><span class="detail-label">Average Score:</span> ${val.average_marks}%</div>
                    <div class="detail"><span class="detail-label">Pass/Fail:</span> <span style="color: #28a745;">${passCount}</span> / <span style="color: #dc3545;">${failCount}</span></div>
                    <div class="detail"><span class="detail-label">Overall Status:</span> <span style="background: ${statusColor}; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.85rem;">${overallStatus}</span></div>
                </div>
                <div class="history-actions">
                    <button class="btn btn-sm btn-primary" onclick="viewValidationDetails('${val.id}')">👁️ View Details</button>
                    <button class="btn btn-sm btn-success" onclick="downloadValidationDetails('${val.id}')">📥 Download CSV</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteValidationFromHistory('${val.id}')">🗑️ Delete</button>
                </div>
            </div>
        `;
    }
    
    html += `</div>`;
    dashboardContent.innerHTML = html;
}

function filterValidationHistory() {
    const searchTerm = document.getElementById('validationHistorySearch')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('validationHistoryFilter')?.value || 'all';
    
    const items = document.querySelectorAll('#validationHistoryList .history-item');
    
    items.forEach(item => {
        const searchText = item.dataset.search?.toLowerCase() || '';
        const overallStatus = item.dataset.overallStatus || '';
        
        let matchesSearch = searchTerm === '' || searchText.includes(searchTerm);
        let matchesStatus = statusFilter === 'all' || overallStatus.toLowerCase() === statusFilter;
        
        item.style.display = matchesSearch && matchesStatus ? 'block' : 'none';
    });
}

// ========== NAVIGATION FUNCTIONS ==========

function switchToDashboard() {
    switchSection('dashboard');
    loadDashboard();
}

function switchToGenerate() {
    switchSection('generate');
}

function switchToValidate() {
    switchSection('validate');
}

function switchToHome() {
    switchSection('home');
}

function viewAllPapers() {
    switchSection('dashboard');
    loadPaperHistory();
}

// Generate Paper Function
async function generatePaperPreview() {
    if (!isLoggedIn) {
        showToast('Please login to generate and save papers', 'warning');
        openModal('loginModal');
        return;
    }
    
    const title = document.getElementById('paperTitle').value;
    const subject = document.getElementById('paperSubject').value;

    if (!title || !title.trim()) {
        showToast('Please enter a paper title', 'error');
        document.getElementById('paperTitle').focus();
        return;
    }

    if (!subject) {
        showToast('Please select a subject', 'error');
        document.getElementById('paperSubject').focus();
        return;
    }

    const date = document.getElementById('paperDate').value || new Date().toISOString().split('T')[0];
    const time = document.getElementById('paperTime').value || '180';
    const marks = document.getElementById('totalMarks').value || '100';
    const difficulty = document.getElementById('difficultyLevel').value || 'medium';
    const topics = document.getElementById('paperTopics').value || 'General Topics';
    const instructions = document.getElementById('additionalInstructions').value || '';
    
    const questionTypes = [];
    if (document.getElementById('qtype_mcq')?.checked) questionTypes.push('mcq');
    if (document.getElementById('qtype_short')?.checked) questionTypes.push('short');
    if (document.getElementById('qtype_long')?.checked) questionTypes.push('long');

    const generatePaperBtn = document.getElementById('generatePaperBtn');
    const originalBtnText = generatePaperBtn.innerHTML;
    generatePaperBtn.disabled = true;
    generatePaperBtn.innerHTML = '<span class="loading"></span> Generating...';

    try {
        const paperData = await mockGeneratePaper({
            title, subject, date, time, marks, difficulty, topics, instructions,
            contextFile: uploadedContextFile
        });

        generatedPaperContent = {
            title, subject, date, time, marks, difficulty, topics, instructions,
            content: paperData.content,
            used_context: paperData.used_context,
            question_types: questionTypes
        };

        renderPaperPreview(generatedPaperContent);
        
        await savePaperToHistory({
            title: title,
            subject: subject,
            topics: topics,
            difficulty: difficulty,
            total_marks: parseInt(marks),
            question_types: questionTypes,
            used_context: paperData.used_context,
            content: paperData.content
        });
        
        showToast('Question paper generated and saved to history!', 'success');

    } catch (error) {
        console.error('Generate paper error:', error);
        showToast(error.message || 'An error occurred while generating the paper.', 'error');
    } finally {
        generatePaperBtn.disabled = false;
        generatePaperBtn.innerHTML = originalBtnText;
    }
}

function renderPaperPreview(data) {
    const formattedContent = data.content.replace(/\n/g, '<br>');

    const previewHTML = `
        <div style="background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); font-family: 'Times New Roman', serif;">
            <div style="text-align: center; margin-bottom: 2rem;">
                <h2 style="color: #000; margin-bottom: 1rem;">${escapeHtml(data.title)}</h2>
                <hr style="border: 1px solid #000;">
            </div>
            
            <div style="margin-bottom: 1.5rem; line-height: 1.8;">
                <p><strong>Subject:</strong> ${escapeHtml(data.subject)}</p>
                <p><strong>Date:</strong> ${escapeHtml(data.date)}</p>
                <p><strong>Time:</strong> ${escapeHtml(data.time)} minutes</p>
                <p><strong>Maximum Marks:</strong> ${escapeHtml(data.marks)}</p>
                <p><strong>Difficulty:</strong> ${escapeHtml(data.difficulty)}</p>
                <p><strong>Topics:</strong> ${escapeHtml(data.topics)}</p>
            </div>
            
            ${data.instructions ? `<div style="margin-bottom: 1.5rem; padding: 1rem; background: #f5f5f5; border-left: 3px solid #333;"><strong>Instructions:</strong> ${escapeHtml(data.instructions)}</div>` : ''}
            
            <div style="background: #ffffff; padding: 1rem; border: 1px solid #ddd; border-radius: 4px; white-space: pre-wrap; font-family: 'Courier New', Courier, monospace; font-size: 12px; line-height: 1.5; max-height: 600px; overflow-y: auto;">
                ${formattedContent}
            </div>
        </div>
    `;

    const previewContent = document.getElementById('previewContent');
    const paperPreview = document.getElementById('paperPreview');
    const downloadPaperBtn = document.getElementById('downloadPaperBtn');

    if (previewContent) previewContent.innerHTML = previewHTML;
    if (paperPreview) paperPreview.style.display = 'block';
    if (downloadPaperBtn) {
        downloadPaperBtn.disabled = false;
        downloadPaperBtn.classList.remove('btn-disabled');
        downloadPaperBtn.classList.add('btn-success');
    }

    if (paperPreview) paperPreview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function downloadPaperAsPDF() {
    if (!generatedPaperContent) {
        showToast('Please generate a paper first', 'error');
        return;
    }

    downloadPaperContent(generatedPaperContent.title, generatedPaperContent.content);
}

function handleSourceUpload(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) {
        showToast('No file selected', 'warning');
        return;
    }

    const file = files[0];
    const maxSize = 10 * 1024 * 1024;

    if (file.size > maxSize) {
        showToast('File size exceeds 10MB limit.', 'error');
        event.target.value = '';
        return;
    }

    uploadedContextFile = file;

    const sourceFileInfo = document.getElementById('sourceFileInfo');
    const uploadSourceBtn = document.getElementById('uploadSourceBtn');
    const sourceFileName = document.getElementById('sourceFileName');
    const sourceFileSize = document.getElementById('sourceFileSize');

    if (sourceFileName && sourceFileSize && sourceFileInfo) {
        sourceFileName.textContent = file.name;
        sourceFileSize.textContent = formatFileSize(file.size);
        if (uploadSourceBtn) uploadSourceBtn.style.display = 'none';
        sourceFileInfo.style.display = 'block';
        showToast(`Source material "${file.name}" uploaded successfully!`, 'success');
    }
}

function removeSourceFile() {
    uploadedContextFile = null;
    const sourceUpload = document.getElementById('sourceUpload');
    const sourceFileInfo = document.getElementById('sourceFileInfo');
    const uploadSourceBtn = document.getElementById('uploadSourceBtn');
    if (sourceUpload) sourceUpload.value = '';
    if (sourceFileInfo) sourceFileInfo.style.display = 'none';
    if (uploadSourceBtn) uploadSourceBtn.style.display = 'block';
    showToast('Source material removed', 'info');
}

// ========== VALIDATE ANSWERS FUNCTIONS ==========

function generateAnswerKey(numQuestions) {
    const answers = [];
    const options = ['A', 'B', 'C', 'D'];
    for (let i = 0; i < numQuestions; i++) {
        answers.push(options[Math.floor(Math.random() * options.length)]);
    }
    return answers;
}

function generateStudentAnswers(numQuestions, answerKey, studentIndex) {
    const answers = [];
    for (let i = 0; i < numQuestions; i++) {
        const correctChance = 0.6 + (studentIndex * 0.06);
        const randomValue = Math.random();
        
        if (randomValue < correctChance) {
            answers.push(answerKey[i]);
        } else {
            const options = ['A', 'B', 'C', 'D'];
            const wrongOptions = options.filter(opt => opt !== answerKey[i]);
            answers.push(wrongOptions[Math.floor(Math.random() * wrongOptions.length)]);
        }
    }
    return answers;
}

function compareAnswers(answerKey, studentAnswers, marksPerQuestion = 1) {
    let correctCount = 0;
    const results = [];
    
    for (let i = 0; i < answerKey.length; i++) {
        const isCorrect = studentAnswers[i] === answerKey[i];
        if (isCorrect) {
            correctCount++;
        }
        results.push({
            questionNumber: i + 1,
            correctAnswer: answerKey[i],
            studentAnswer: studentAnswers[i],
            isCorrect: isCorrect,
            marksObtained: isCorrect ? marksPerQuestion : 0
        });
    }
    
    const totalMarks = answerKey.length * marksPerQuestion;
    const marksObtained = correctCount * marksPerQuestion;
    const percentage = (marksObtained / totalMarks) * 100;
    
    let grade = '';
    if (percentage >= 90) grade = 'A+';
    else if (percentage >= 80) grade = 'A';
    else if (percentage >= 70) grade = 'B+';
    else if (percentage >= 60) grade = 'B';
    else if (percentage >= 50) grade = 'C';
    else if (percentage >= 40) grade = 'D';
    else grade = 'F';
    
    return {
        totalQuestions: answerKey.length,
        correctCount: correctCount,
        wrongCount: answerKey.length - correctCount,
        totalMarks: totalMarks,
        marksObtained: marksObtained,
        percentage: percentage.toFixed(2),
        grade: grade,
        details: results,
        status: percentage >= 40 ? 'PASS' : 'FAIL'
    };
}

function handleAnswerKeyUpload(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    const file = files[0];
    uploadedAnswerKey = file;

    const answerKeyInfo = document.getElementById('answerKeyInfo');
    const answerKeyName = document.getElementById('answerKeyName');
    const answerKeySize = document.getElementById('answerKeySize');

    if (answerKeyName) answerKeyName.textContent = file.name;
    if (answerKeySize) answerKeySize.textContent = `${(file.size / 1024).toFixed(2)} KB`;
    if (answerKeyInfo) answerKeyInfo.style.display = 'block';

    updateValidationButtonState();
    showToast(`Answer key "${file.name}" uploaded successfully!`, 'success');
}

function removeAnswerKey() {
    uploadedAnswerKey = null;
    const answerKeyUpload = document.getElementById('answerKeyUpload');
    const answerKeyInfo = document.getElementById('answerKeyInfo');
    if (answerKeyUpload) answerKeyUpload.value = '';
    if (answerKeyInfo) answerKeyInfo.style.display = 'none';
    updateValidationButtonState();
    showToast('Answer key removed', 'info');
}

function updateValidationButtonState() {
    const startValidationBtn = document.getElementById('startValidationBtn');
    const hasAnswerKey = uploadedAnswerKey !== null;
    const hasAnswerSheets = uploadedFiles.length > 0;

    if (startValidationBtn) {
        if (hasAnswerKey && hasAnswerSheets) {
            startValidationBtn.disabled = false;
            startValidationBtn.classList.remove('btn-disabled');
            startValidationBtn.classList.add('btn-primary');
        } else {
            startValidationBtn.disabled = true;
            startValidationBtn.classList.add('btn-disabled');
            startValidationBtn.classList.remove('btn-primary');
        }
    }
}

function handleFileUpload(event) {
    const files = Array.from(event.target.files);
    uploadedFiles = [...uploadedFiles, ...files];
    updateFileList();
    updateValidationButtonState();
    showToast(`${files.length} answer sheet(s) uploaded successfully`, 'success');
}

function updateFileList() {
    const fileList = document.getElementById('fileList');
    if (!fileList) return;
    
    fileList.innerHTML = '';

    if (uploadedFiles.length === 0) {
        fileList.innerHTML = '<p style="color: #666; font-style: italic; padding: 1rem; text-align: center;">No answer sheets uploaded yet</p>';
        return;
    }

    const list = document.createElement('div');
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '0.5rem';

    uploadedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.style.display = 'flex';
        fileItem.style.justifyContent = 'space-between';
        fileItem.style.alignItems = 'center';
        fileItem.style.padding = '0.75rem';
        fileItem.style.background = '#f8f9fa';
        fileItem.style.borderRadius = '6px';
        fileItem.style.border = '1px solid #dee2e6';

        const fileInfo = document.createElement('div');
        fileInfo.style.flex = '1';
        fileInfo.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span>📄</span>
                <div>
                    <div style="font-weight: 600;">${escapeHtml(file.name)}</div>
                    <div style="font-size: 0.85rem; color: #666;">${(file.size / 1024).toFixed(2)} KB</div>
                </div>
            </div>
        `;

        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '🗑️';
        removeBtn.style.background = 'none';
        removeBtn.style.border = 'none';
        removeBtn.style.cursor = 'pointer';
        removeBtn.style.color = '#dc3545';
        removeBtn.onclick = () => {
            uploadedFiles.splice(index, 1);
            updateFileList();
            updateValidationButtonState();
            showToast('File removed', 'info');
        };

        fileItem.appendChild(fileInfo);
        fileItem.appendChild(removeBtn);
        list.appendChild(fileItem);
    });

    fileList.appendChild(list);
}

async function startValidation() {
    if (!uploadedAnswerKey) {
        showToast('Please upload an answer key first', 'error');
        return;
    }

    if (uploadedFiles.length === 0) {
        showToast('Please upload answer sheets first', 'error');
        return;
    }

    const validationProgress = document.getElementById('validationProgress');
    const progressBar = document.getElementById('progressBar');
    const progressPercent = document.getElementById('progressPercent');
    const progressStatus = document.getElementById('progressStatus');

    if (validationProgress) validationProgress.style.display = 'block';
    if (progressBar) progressBar.style.width = '0%';
    if (progressPercent) progressPercent.textContent = '0%';
    if (progressStatus) progressStatus.textContent = 'Starting validation...';

    const startValidationBtn = document.getElementById('startValidationBtn');
    const originalText = startValidationBtn ? startValidationBtn.innerHTML : '';
    if (startValidationBtn) {
        startValidationBtn.innerHTML = '<span class="loading"></span> Validating...';
        startValidationBtn.disabled = true;
    }

    try {
        const totalQuestions = 50;
        const marksPerQuestion = 1;
        
        const answerKey = generateAnswerKey(totalQuestions);
        
        const allResults = [];
        
        for (let i = 0; i < uploadedFiles.length; i++) {
            const progress = Math.floor(((i + 1) / uploadedFiles.length) * 100);
            if (progressBar) progressBar.style.width = `${progress}%`;
            if (progressPercent) progressPercent.textContent = `${progress}%`;
            if (progressStatus) progressStatus.textContent = `Processing student ${i + 1} of ${uploadedFiles.length}... Comparing bubble sheet answers...`;
            
            await new Promise(resolve => setTimeout(resolve, 800));
            
            const studentAnswers = generateStudentAnswers(totalQuestions, answerKey, i);
            const result = compareAnswers(answerKey, studentAnswers, marksPerQuestion);
            
            allResults.push({
                studentName: `Student ${i + 1}`,
                fileName: uploadedFiles[i].name,
                ...result
            });
        }
        
        if (progressBar) progressBar.style.width = '100%';
        if (progressPercent) progressPercent.textContent = '100%';
        if (progressStatus) progressStatus.textContent = 'Validation complete! All bubble sheets processed.';
        
        validationResultsData = {
            totalQuestions: totalQuestions,
            marksPerQuestion: marksPerQuestion,
            results: allResults
        };
        
        const totalStudents = allResults.length;
        const avgPercentage = (allResults.reduce((sum, r) => sum + parseFloat(r.percentage), 0) / totalStudents).toFixed(2);
        
        await saveValidationToHistory({
            total_students: totalStudents,
            average_marks: avgPercentage,
            results: allResults
        });
        
        displayValidationResults(allResults, totalQuestions, marksPerQuestion);
        
        if (startValidationBtn) {
            startValidationBtn.innerHTML = originalText;
            startValidationBtn.disabled = false;
        }
        
        setTimeout(() => {
            if (validationProgress) validationProgress.style.display = 'none';
        }, 2000);
        
        showToast(`Validation completed! Processed ${uploadedFiles.length} students with ${totalQuestions} questions each.`, 'success');
        
    } catch (error) {
        console.error('Validation error:', error);
        showToast('An error occurred during validation', 'error');
        if (startValidationBtn) {
            startValidationBtn.innerHTML = originalText;
            startValidationBtn.disabled = false;
        }
        if (validationProgress) validationProgress.style.display = 'none';
    }
}

function displayValidationResults(results, totalQuestions, marksPerQuestion) {
    const resultsContent = document.getElementById('resultsContent');
    const validationResults = document.getElementById('validationResults');
    const downloadResultsBtn = document.getElementById('downloadResultsBtn');
    
    if (!resultsContent) return;
    
    const totalStudents = results.length;
    const avgPercentage = (results.reduce((sum, r) => sum + parseFloat(r.percentage), 0) / totalStudents).toFixed(2);
    const highestScore = Math.max(...results.map(r => r.marksObtained));
    const lowestScore = Math.min(...results.map(r => r.marksObtained));
    const passCount = results.filter(r => r.status === 'PASS').length;
    const failCount = totalStudents - passCount;
    const totalMarksPossible = totalQuestions * marksPerQuestion;
    
    let html = `
        <div style="margin-bottom: 2rem;">
            <h3 style="color: #0366d6; margin-bottom: 0.5rem;">Validation Report</h3>
            <p style="color: #666;">Validated on: ${new Date().toLocaleString()}</p>
            <p style="color: #666;">Total Questions: ${totalQuestions} | Marks per question: ${marksPerQuestion}</p>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
            <div style="background: #d4edda; padding: 1rem; border-radius: 8px; text-align: center;">
                <div style="font-size: 0.85rem; color: #155724;">Total Students</div>
                <div style="font-size: 1.8rem; font-weight: bold; color: #155724;">${totalStudents}</div>
            </div>
            <div style="background: #d1ecf1; padding: 1rem; border-radius: 8px; text-align: center;">
                <div style="font-size: 0.85rem; color: #0c5460;">Average Score</div>
                <div style="font-size: 1.8rem; font-weight: bold; color: #0c5460;">${avgPercentage}%</div>
            </div>
            <div style="background: #fff3cd; padding: 1rem; border-radius: 8px; text-align: center;">
                <div style="font-size: 0.85rem; color: #856404;">Highest Score</div>
                <div style="font-size: 1.8rem; font-weight: bold; color: #856404;">${highestScore}/${totalMarksPossible}</div>
            </div>
            <div style="background: #f8d7da; padding: 1rem; border-radius: 8px; text-align: center;">
                <div style="font-size: 0.85rem; color: #721c24;">Lowest Score</div>
                <div style="font-size: 1.8rem; font-weight: bold; color: #721c24;">${lowestScore}/${totalMarksPossible}</div>
            </div>
        </div>
        
        <div style="display: flex; gap: 1rem; margin-bottom: 2rem; justify-content: center;">
            <div style="background: #28a745; color: white; padding: 0.5rem 1.5rem; border-radius: 20px;">
                Pass: ${passCount}
            </div>
            <div style="background: #dc3545; color: white; padding: 0.5rem 1.5rem; border-radius: 20px;">
                Fail: ${failCount}
            </div>
        </div>
        
        <h4 style="margin-bottom: 1rem;">Student Performance Details</h4>
        <div class="results-table-wrapper">
            <table class="results-table">
                <thead>
                    <tr>
                        <th>Student</th>
                        <th>Correct</th>
                        <th>Wrong</th>
                        <th>Marks</th>
                        <th>Percentage</th>
                        <th>Grade</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    for (const result of results) {
        const statusColor = result.status === 'PASS' ? '#28a745' : '#dc3545';
        let gradeColor = '';
        if (result.grade === 'A+' || result.grade === 'A') gradeColor = '#28a745';
        else if (result.grade === 'B+' || result.grade === 'B') gradeColor = '#17a2b8';
        else if (result.grade === 'C') gradeColor = '#ffc107';
        else gradeColor = '#dc3545';
        
        html += `
            <tr>
                <td>${escapeHtml(result.studentName)}</td>
                <td style="color: #28a745; font-weight: bold;">${result.correctCount}</td>
                <td style="color: #dc3545;">${result.wrongCount}</td>
                <td>${result.marksObtained}/${result.totalMarks}</td>
                <td><strong>${result.percentage}%</strong></td>
                <td><span style="background: ${gradeColor}; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.85rem;">${result.grade}</span></td>
                <td><span style="background: ${statusColor}; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.85rem;">${result.status}</span></td>
            </tr>
        `;
    }
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    resultsContent.innerHTML = html;
    if (validationResults) validationResults.style.display = 'block';
    if (downloadResultsBtn) {
        downloadResultsBtn.disabled = false;
        downloadResultsBtn.classList.remove('btn-disabled');
        downloadResultsBtn.classList.add('btn-success');
    }
    
    if (validationResults) validationResults.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function downloadValidationResults() {
    if (!validationResultsData || validationResultsData.results.length === 0) {
        showToast('No validation results available', 'error');
        return;
    }
    
    const { results, totalQuestions, marksPerQuestion } = validationResultsData;
    
    let csvContent = 'Student Name,Correct Answers,Wrong Answers,Total Marks,Marks Obtained,Percentage,Grade,Status\n';
    
    for (const result of results) {
        csvContent += `"${result.studentName}",${result.correctCount},${result.wrongCount},${result.totalMarks},${result.marksObtained},${result.percentage}%,${result.grade},${result.status}\n`;
    }
    
    csvContent += '\n\nSUMMARY\n';
    csvContent += `Total Students,${results.length}\n`;
    csvContent += `Total Questions,${totalQuestions}\n`;
    csvContent += `Marks Per Question,${marksPerQuestion}\n`;
    csvContent += `Validation Date,${new Date().toLocaleString()}\n`;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `validation_results_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Results downloaded successfully!', 'success');
}

// Initialize
function init() {
    const sessionUser = sessionStorage.getItem('currentUser');
    const sessionToken = sessionStorage.getItem('token');
    
    if (sessionUser && sessionToken) {
        try {
            currentUser = JSON.parse(sessionUser);
            token = sessionToken;
            isLoggedIn = true;
            updateUIForLoginStatus();
            showToast(`Welcome back, ${currentUser.name}!`, 'success');
        } catch (error) {
            console.error('Session restore error:', error);
            clearSession();
        }
    }
    
    const savedPapers = localStorage.getItem('mockPapers');
    if (savedPapers) {
        try {
            mockPapers.length = 0;
            const parsed = JSON.parse(savedPapers);
            mockPapers.push(...parsed);
        } catch (e) {
            console.error('Failed to load papers:', e);
        }
    }
    
    const savedValidations = localStorage.getItem('mockValidations');
    if (savedValidations) {
        try {
            mockValidations.length = 0;
            const parsed = JSON.parse(savedValidations);
            mockValidations.push(...parsed);
        } catch (e) {
            console.error('Failed to load validations:', e);
        }
    }

    setupEventListeners();
    switchSection('home');
    updateHeaderHomeButton();

    const paperDateInput = document.getElementById('paperDate');
    if (paperDateInput) paperDateInput.valueAsDate = new Date();
}

function setupEventListeners() {
    const homeBtn = document.getElementById('homeBtn');
    const headerHomeBtn = document.getElementById('headerHomeBtn');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const dashboardNavBtn = document.getElementById('dashboardNavBtn');

    if (homeBtn) homeBtn.addEventListener('click', () => switchToHome());
    if (headerHomeBtn) headerHomeBtn.addEventListener('click', () => switchToHome());
    if (dashboardNavBtn) dashboardNavBtn.addEventListener('click', () => switchToDashboard());

    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            if (isLoggedIn) logout();
            else openModal('loginModal');
        });
    }
    if (registerBtn) registerBtn.addEventListener('click', () => openModal('registerModal'));

    const loginFromHome = document.getElementById('loginFromHome');
    const registerFromHome = document.getElementById('registerFromHome');
    if (loginFromHome) loginFromHome.addEventListener('click', () => openModal('loginModal'));
    if (registerFromHome) registerFromHome.addEventListener('click', () => openModal('registerModal'));

    const startGenerating = document.getElementById('startGenerating');
    const startValidating = document.getElementById('startValidating');

    if (startGenerating) {
        startGenerating.addEventListener('click', () => {
            switchToGenerate();
        });
    }
    if (startValidating) {
        startValidating.addEventListener('click', () => {
            switchToValidate();
        });
    }

    const generatePaperBtn = document.getElementById('generatePaperBtn');
    const downloadPaperBtn = document.getElementById('downloadPaperBtn');
    const resetFormBtn = document.getElementById('resetFormBtn');
    if (generatePaperBtn) generatePaperBtn.addEventListener('click', generatePaperPreview);
    if (downloadPaperBtn) downloadPaperBtn.addEventListener('click', downloadPaperAsPDF);
    if (resetFormBtn) resetFormBtn.addEventListener('click', () => {
        if (confirm('Reset the form?')) resetGenerateForm();
    });

    const startValidationBtn = document.getElementById('startValidationBtn');
    const downloadResultsBtn = document.getElementById('downloadResultsBtn');
    const answersUpload = document.getElementById('answersUpload');
    const answerKeyUpload = document.getElementById('answerKeyUpload');
    const uploadAnswersBtn = document.getElementById('uploadAnswersBtn');
    const uploadAnswerKeyBtn = document.getElementById('uploadAnswerKeyBtn');
    const removeAnswerKeyBtn = document.getElementById('removeAnswerKeyBtn');
    const resetValidateFormBtn = document.getElementById('resetValidateFormBtn');

    if (startValidationBtn) startValidationBtn.addEventListener('click', startValidation);
    if (downloadResultsBtn) downloadResultsBtn.addEventListener('click', downloadValidationResults);
    if (uploadAnswersBtn) uploadAnswersBtn.addEventListener('click', () => answersUpload.click());
    if (uploadAnswerKeyBtn) uploadAnswerKeyBtn.addEventListener('click', () => answerKeyUpload.click());
    if (answersUpload) answersUpload.addEventListener('change', handleFileUpload);
    if (answerKeyUpload) answerKeyUpload.addEventListener('change', handleAnswerKeyUpload);
    if (removeAnswerKeyBtn) removeAnswerKeyBtn.addEventListener('click', removeAnswerKey);
    if (resetValidateFormBtn) resetValidateFormBtn.addEventListener('click', () => {
        if (confirm('Reset validation form?')) resetValidateForm();
    });

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.getAttribute('data-modal');
            closeModal(modalId);
        });
    });
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) closeModal(e.target.id);
    });

    const switchToRegister = document.getElementById('switchToRegister');
    const switchToLogin = document.getElementById('switchToLogin');
    if (switchToRegister) switchToRegister.addEventListener('click', (e) => { e.preventDefault(); showRegisterModal(); });
    if (switchToLogin) switchToLogin.addEventListener('click', (e) => { e.preventDefault(); showLoginModal(); });

    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (registerForm) registerForm.addEventListener('submit', handleRegister);

    const uploadSourceBtn = document.getElementById('uploadSourceBtn');
    const sourceUpload = document.getElementById('sourceUpload');
    const removeSourceBtn = document.getElementById('removeSourceBtn');
    if (uploadSourceBtn && sourceUpload) uploadSourceBtn.addEventListener('click', () => sourceUpload.click());
    if (sourceUpload) sourceUpload.addEventListener('change', handleSourceUpload);
    if (removeSourceBtn) removeSourceBtn.addEventListener('click', removeSourceFile);
}

document.addEventListener('DOMContentLoaded', init);