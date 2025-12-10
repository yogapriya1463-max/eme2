// app.js
const API_BASE_URL = 'http://localhost:5000/api';

// State management
let currentUser = null;
let isLoggedIn = false;
let currentSection = 'home';
let token = null;

// DOM Elements
const sections = {
    home: document.getElementById('homeSection'),
    generate: document.getElementById('generateSection'),
    validate: document.getElementById('validateSection')
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
    
    document.getElementById('toastIcon').textContent = icons[type] || 'ℹ️';
    toastMessage.textContent = message;
    toast.className = `toast toast-${type}`;
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

// Switch section
function switchSection(sectionName) {
    Object.values(sections).forEach(section => {
        section.classList.remove('active');
    });
    
    if (sections[sectionName]) {
        sections[sectionName].classList.add('active');
        currentSection = sectionName;
    }
    
    updateHeaderHomeButton();
}

// Update header Home button visibility
function updateHeaderHomeButton() {
    const headerHomeBtn = document.getElementById('headerHomeBtn');
    if (currentSection === 'home') {
        headerHomeBtn.style.display = 'none';
    } else {
        headerHomeBtn.style.display = 'flex';
    }
}

// Clear error messages
function clearErrors() {
    document.querySelectorAll('.error-message').forEach(el => {
        el.style.display = 'none';
        el.textContent = '';
    });
    document.querySelectorAll('.form-control').forEach(el => {
        el.classList.remove('error', 'success');
    });
}

// Show error message
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

// Validate email
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Open modal function
function openModal(modalId) {
    clearErrors();
    document.getElementById(modalId).style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// Close modal function
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    document.body.style.overflow = 'auto';
    clearErrors();
}

// Switch between forms
function switchToLogin() {
    closeModal('registerModal');
    closeModal('forgotPasswordModal');
    setTimeout(() => openModal('loginModal'), 300);
}

function switchToRegister() {
    closeModal('loginModal');
    closeModal('forgotPasswordModal');
    setTimeout(() => openModal('registerModal'), 300);
}

function switchToForgotPassword() {
    closeModal('loginModal');
    closeModal('registerModal');
    setTimeout(() => openModal('forgotPasswordModal'), 300);
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    clearErrors();
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    
    // Validate inputs
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
    
    // Show loading
    const loginBtnText = document.getElementById('loginBtnText');
    const loginLoading = document.getElementById('loginLoading');
    const loginSubmitBtn = document.getElementById('loginSubmitBtn');
    loginBtnText.style.display = 'none';
    loginLoading.style.display = 'inline-block';
    loginSubmitBtn.disabled = true;
    
    try {
        // Call backend API
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Login successful
            currentUser = data.user;
            isLoggedIn = true;
            token = data.token;
            
            // Save to localStorage if remember me is checked
            if (rememberMe) {
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                localStorage.setItem('token', token);
            }
            
            // Close modal
            closeModal('loginModal');
            
            // Show success message
            showToast(`Welcome back, ${data.user.name}!`, 'success');
            
            // Reset form
            document.getElementById('loginForm').reset();
            
            // Update UI
            updateUIForLoginStatus();
            
            // Return to home page
            switchSection('home');
        } else {
            // Login failed
            showError('loginEmail', data.message || 'Invalid credentials');
            showError('loginPassword', data.message || 'Invalid credentials');
            showToast(data.message || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Network error. Please try again.', 'error');
    } finally {
        // Hide loading
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
    
    // Validate inputs
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
    
    // Show loading
    const registerBtnText = document.getElementById('registerBtnText');
    const registerLoading = document.getElementById('registerLoading');
    const registerSubmitBtn = document.getElementById('registerSubmitBtn');
    registerBtnText.style.display = 'none';
    registerLoading.style.display = 'inline-block';
    registerSubmitBtn.disabled = true;
    
    try {
        // Call backend API
        const response = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                name, 
                email, 
                password,
                confirmPassword 
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Registration successful
            currentUser = data.user;
            isLoggedIn = true;
            token = data.token;
            
            // Auto-login the new user
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            localStorage.setItem('token', token);
            
            // Close modal
            closeModal('registerModal');
            
            // Show success message
            showToast(`Account created successfully! Welcome, ${name}!`, 'success');
            
            // Reset form
            document.getElementById('registerForm').reset();
            document.getElementById('passwordStrength').className = 'strength-bar';
            
            // Update UI
            updateUIForLoginStatus();
            
            // Return to home page
            switchSection('home');
        } else {
            // Registration failed
            if (data.field) {
                showError(data.field, data.message);
            } else {
                showError('regEmail', data.message || 'Registration failed');
            }
            showToast(data.message || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showToast('Network error. Please try again.', 'error');
    } finally {
        // Hide loading
        registerBtnText.style.display = 'inline';
        registerLoading.style.display = 'none';
        registerSubmitBtn.disabled = false;
    }
}

// Handle forgot password
async function handleForgotPassword(e) {
    e.preventDefault();
    clearErrors();
    
    const email = document.getElementById('forgotEmail').value.trim();
    
    // Validate email
    if (!email) {
        showError('forgotEmail', 'Email is required');
        return;
    }
    
    if (!validateEmail(email)) {
        showError('forgotEmail', 'Please enter a valid email address');
        return;
    }
    
    // Show loading
    const forgotBtnText = document.getElementById('forgotBtnText');
    const forgotLoading = document.getElementById('forgotLoading');
    const forgotSubmitBtn = document.getElementById('forgotSubmitBtn');
    forgotBtnText.style.display = 'none';
    forgotLoading.style.display = 'inline-block';
    forgotSubmitBtn.disabled = true;
    
    try {
        // Call backend API
        const response = await fetch(`${API_BASE_URL}/forgot-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Show success message
            showToast('If an account exists with this email, you will receive a password reset link shortly.', 'success');
            
            // Reset form
            document.getElementById('forgotPasswordForm').reset();
            
            // Close modal after delay
            setTimeout(() => {
                closeModal('forgotPasswordModal');
                switchToLogin();
            }, 2000);
        } else {
            showError('forgotEmail', data.message || 'Request failed');
            showToast(data.message || 'Request failed', 'error');
        }
    } catch (error) {
        console.error('Forgot password error:', error);
        showToast('Network error. Please try again.', 'error');
    } finally {
        // Hide loading
        forgotBtnText.style.display = 'inline';
        forgotLoading.style.display = 'none';
        forgotSubmitBtn.disabled = false;
    }
}

// Update UI based on login status
function updateUIForLoginStatus() {
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const loginRequired = document.getElementById('loginRequired');
    const welcomeSection = document.getElementById('welcomeSection');
    
    if (isLoggedIn && currentUser) {
        // User is logged in
        loginBtn.innerHTML = '👤 Logout';
        loginBtn.classList.remove('btn-primary');
        loginBtn.classList.add('btn-secondary');
        registerBtn.style.display = 'none';
        
        // Update home page content
        if (loginRequired) loginRequired.style.display = 'none';
        if (welcomeSection) welcomeSection.style.display = 'block';
    } else {
        // User is not logged in
        loginBtn.innerHTML = '🔐 Login';
        loginBtn.classList.remove('btn-secondary');
        loginBtn.classList.add('btn-primary');
        registerBtn.style.display = 'inline-block';
        
        // Update home page content
        if (loginRequired) loginRequired.style.display = 'block';
        if (welcomeSection) welcomeSection.style.display = 'none';
    }
}

// Logout function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        currentUser = null;
        isLoggedIn = false;
        token = null;
        localStorage.removeItem('currentUser');
        localStorage.removeItem('token');
        
        // Update UI
        updateUIForLoginStatus();
        
        // Show success message
        showToast('Logged out successfully!', 'success');
        
        // Return to home page
        switchSection('home');
        
        // Update header Home button
        updateHeaderHomeButton();
    }
}

// Generate Paper Functions
function generatePaperPreview() {
    const title = document.getElementById('paperTitle').value || 'Sample Question Paper';
    const subject = document.getElementById('paperSubject').value || 'General';
    const date = document.getElementById('paperDate').value || new Date().toISOString().split('T')[0];
    const time = document.getElementById('paperTime').value || '180';
    const marks = document.getElementById('totalMarks').value || '100';
    const difficulty = document.getElementById('difficultyLevel').value || 'medium';
    const topics = document.getElementById('paperTopics').value || 'General Topics';
    
    // Get selected question types
    const questionTypes = [];
    document.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
        questionTypes.push(cb.nextElementSibling.textContent);
    });

    const previewHTML = `
        <h5 style="color: #0366d6; margin-bottom: 1rem;">${title}</h5>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
            <div>
                <strong>Subject:</strong> ${subject}
            </div>
            <div>
                <strong>Date:</strong> ${date}
            </div>
            <div>
                <strong>Duration:</strong> ${time} minutes
            </div>
            <div>
                <strong>Total Marks:</strong> ${marks}
            </div>
            <div>
                <strong>Difficulty:</strong> ${difficulty}
            </div>
        </div>
        <div style="margin-bottom: 1rem;">
            <strong>Topics Covered:</strong> ${topics}
        </div>
        <div style="margin-bottom: 1.5rem;">
            <strong>Question Types:</strong> ${questionTypes.join(', ')}
        </div>
        <div style="background: #f8f9fa; padding: 1rem; border-radius: 6px; border-left: 4px solid #28a745;">
            <strong>Sample Questions:</strong>
            <ul style="margin-top: 0.5rem; padding-left: 1.5rem;">
                <li>What is the capital of France? (One Word)</li>
                <li>Explain the theory of relativity. (Essay)</li>
                <li>Solve: 2x + 5 = 15 (Short Answer)</li>
                <li>Which planet is known as the Red Planet? (MCQ)</li>
            </ul>
        </div>
        <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #dee2e6; font-size: 0.9rem; color: #666;">
            <em>This is a preview of the generated question paper. The final paper will contain ${marks} marks worth of questions.</em>
        </div>
    `;

    const previewContent = document.getElementById('previewContent');
    const paperPreview = document.getElementById('paperPreview');
    const downloadPaperBtn = document.getElementById('downloadPaperBtn');
    
    previewContent.innerHTML = previewHTML;
    paperPreview.style.display = 'block';
    downloadPaperBtn.disabled = false;
    
    // Scroll to preview
    paperPreview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    showToast('Question paper generated successfully!', 'success');
}

function downloadGeneratedPaper() {
    showToast('Downloading question paper as PDF...', 'info');
    
    // Simulate download delay
    setTimeout(() => {
        showToast('Question paper downloaded successfully!', 'success');
    }, 1500);
}

function resetQuestionForm() {
    document.getElementById('questionPaperForm').reset();
    const paperPreview = document.getElementById('paperPreview');
    const downloadPaperBtn = document.getElementById('downloadPaperBtn');
    paperPreview.style.display = 'none';
    downloadPaperBtn.disabled = true;
    showToast('Form has been reset', 'info');
}

// Validate Answers Functions
let uploadedFiles = [];

function handleFileUpload(event) {
    const files = Array.from(event.target.files);
    uploadedFiles = [...uploadedFiles, ...files];
    
    updateFileList();
    
    if (uploadedFiles.length > 0) {
        const startValidationBtn = document.getElementById('startValidationBtn');
        startValidationBtn.disabled = false;
        showToast(`${files.length} file(s) uploaded successfully`, 'success');
    }
}

function updateFileList() {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '';
    
    if (uploadedFiles.length === 0) {
        fileList.innerHTML = '<p style="color: #666; font-style: italic;">No files uploaded yet</p>';
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
        fileInfo.innerHTML = `
            <div style="font-weight: 600;">${file.name}</div>
            <div style="font-size: 0.85rem; color: #666;">${(file.size / 1024).toFixed(2)} KB</div>
        `;
        
        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '🗑️';
        removeBtn.style.background = 'none';
        removeBtn.style.border = 'none';
        removeBtn.style.cursor = 'pointer';
        removeBtn.style.fontSize = '1rem';
        removeBtn.style.color = '#dc3545';
        removeBtn.style.padding = '0.5rem';
        removeBtn.style.borderRadius = '4px';
        removeBtn.style.transition = 'background 0.3s';
        
        removeBtn.onmouseover = () => {
            removeBtn.style.background = '#f8d7da';
        };
        removeBtn.onmouseout = () => {
            removeBtn.style.background = 'none';
        };
        
        removeBtn.onclick = () => {
            uploadedFiles.splice(index, 1);
            updateFileList();
            showToast('File removed', 'info');
        };
        
        fileItem.appendChild(fileInfo);
        fileItem.appendChild(removeBtn);
        list.appendChild(fileItem);
    });
    
    fileList.appendChild(list);
}

function startValidation() {
    if (uploadedFiles.length === 0) {
        showToast('Please upload answer sheets first', 'error');
        return;
    }
    
    showToast('Validating answer sheets...', 'info');
    
    // Simulate validation delay
    setTimeout(() => {
        const resultsHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
                <div style="background: #d4edda; padding: 1rem; border-radius: 6px; border-left: 4px solid #28a745;">
                    <div style="font-size: 0.9rem; color: #666;">Total Papers</div>
                    <div style="font-size: 1.5rem; font-weight: bold; color: #155724;">${uploadedFiles.length}</div>
                </div>
                <div style="background: #d1ecf1; padding: 1rem; border-radius: 6px; border-left: 4px solid #17a2b8;">
                    <div style="font-size: 0.9rem; color: #666;">Average Score</div>
                    <div style="font-size: 1.5rem; font-weight: bold; color: #0c5460;">78.5%</div>
                </div>
                <div style="background: #fff3cd; padding: 1rem; border-radius: 6px; border-left: 4px solid #ffc107;">
                    <div style="font-size: 0.9rem; color: #666;">Highest Score</div>
                    <div style="font-size: 1.5rem; font-weight: bold; color: #856404;">92%</div>
                </div>
                <div style="background: #f8d7da; padding: 1rem; border-radius: 6px; border-left: 4px solid #dc3545;">
                    <div style="font-size: 0.9rem; color: #666;">Lowest Score</div>
                    <div style="font-size: 1.5rem; font-weight: bold; color: #721c24;">65%</div>
                </div>
            </div>
            <div style="margin-top: 1.5rem;">
                <strong>Validation Summary:</strong>
                <ul style="margin-top: 0.5rem; padding-left: 1.5rem;">
                    <li>All answer sheets have been processed successfully</li>
                    <li>AI detected handwriting with 95% accuracy</li>
                    <li>Answers were graded based on the question paper</li>
                    <li>Detailed reports are available for each student</li>
                </ul>
            </div>
            <div style="margin-top: 1.5rem; padding: 1rem; background: #e9ecef; border-radius: 6px;">
                <strong>Next Steps:</strong>
                <p style="margin-top: 0.5rem; margin-bottom: 0;">Download the complete results report for detailed analysis of each student's performance.</p>
            </div>
        `;
        
        const resultsContent = document.getElementById('resultsContent');
        const validationResults = document.getElementById('validationResults');
        const downloadResultsBtn = document.getElementById('downloadResultsBtn');
        
        resultsContent.innerHTML = resultsHTML;
        validationResults.style.display = 'block';
        downloadResultsBtn.disabled = false;
        
        showToast('Validation completed successfully!', 'success');
    }, 2000);
}

function downloadValidationResults() {
    showToast('Downloading validation results...', 'info');
    
    // Simulate download delay
    setTimeout(() => {
        showToast('Results downloaded successfully!', 'success');
    }, 1500);
}

function clearAllFiles() {
    uploadedFiles = [];
    updateFileList();
    const validationResults = document.getElementById('validationResults');
    const downloadResultsBtn = document.getElementById('downloadResultsBtn');
    const startValidationBtn = document.getElementById('startValidationBtn');
    validationResults.style.display = 'none';
    downloadResultsBtn.disabled = true;
    startValidationBtn.disabled = true;
    showToast('All files cleared', 'info');
}

// Initialize
function init() {
    // Check if user is already logged in
    const savedUser = localStorage.getItem('currentUser');
    const savedToken = localStorage.getItem('token');
    
    if (savedUser && savedToken) {
        try {
            currentUser = JSON.parse(savedUser);
            token = savedToken;
            isLoggedIn = true;
            updateUIForLoginStatus();
        } catch (error) {
            console.error('Error parsing saved user:', error);
            localStorage.removeItem('currentUser');
            localStorage.removeItem('token');
        }
    }

    // Setup event listeners
    setupEventListeners();
    
    // Always start on home page
    switchSection('home');
    
    // Update header Home button
    updateHeaderHomeButton();
    
    // Set default date to today
    const paperDateInput = document.getElementById('paperDate');
    if (paperDateInput) {
        paperDateInput.valueAsDate = new Date();
    }
}

function setupEventListeners() {
    // Navigation buttons
    const homeBtn = document.getElementById('homeBtn');
    const headerHomeBtn = document.getElementById('headerHomeBtn');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    
    homeBtn.addEventListener('click', () => switchSection('home'));
    headerHomeBtn.addEventListener('click', () => switchSection('home'));
    
    // Modal open/close buttons
    loginBtn.addEventListener('click', () => {
        if (isLoggedIn) {
            logout();
        } else {
            openModal('loginModal');
        }
    });
    
    registerBtn.addEventListener('click', () => openModal('registerModal'));
    
    // Home page buttons
    const loginFromHome = document.getElementById('loginFromHome');
    const registerFromHome = document.getElementById('registerFromHome');
    
    if (loginFromHome) {
        loginFromHome.addEventListener('click', () => openModal('loginModal'));
    }
    
    if (registerFromHome) {
        registerFromHome.addEventListener('click', () => openModal('registerModal'));
    }
    
    // Welcome section buttons
    const startGenerating = document.getElementById('startGenerating');
    const startValidating = document.getElementById('startValidating');
    
    if (startGenerating) {
        startGenerating.addEventListener('click', () => {
            if (isLoggedIn) {
                switchSection('generate');
            } else {
                showToast('Please login first', 'error');
                openModal('loginModal');
            }
        });
    }
    
    if (startValidating) {
        startValidating.addEventListener('click', () => {
            if (isLoggedIn) {
                switchSection('validate');
            } else {
                showToast('Please login first', 'error');
                openModal('loginModal');
            }
        });
    }
    
    // Generate section navigation buttons
    const homeFromGenerate = document.getElementById('homeFromGenerate');
    const validateFromGenerate = document.getElementById('validateFromGenerate');
    const bottomHomeFromGenerate = document.getElementById('bottomHomeFromGenerate');
    const bottomValidateFromGenerate = document.getElementById('bottomValidateFromGenerate');
    
    if (homeFromGenerate) homeFromGenerate.addEventListener('click', () => switchSection('home'));
    if (validateFromGenerate) validateFromGenerate.addEventListener('click', () => switchSection('validate'));
    if (bottomHomeFromGenerate) bottomHomeFromGenerate.addEventListener('click', () => switchSection('home'));
    if (bottomValidateFromGenerate) bottomValidateFromGenerate.addEventListener('click', () => switchSection('validate'));
    
    // Validate section navigation buttons
    const homeFromValidate = document.getElementById('homeFromValidate');
    const generateFromValidate = document.getElementById('generateFromValidate');
    const bottomHomeFromValidate = document.getElementById('bottomHomeFromValidate');
    const bottomGenerateFromValidate = document.getElementById('bottomGenerateFromValidate');
    
    if (homeFromValidate) homeFromValidate.addEventListener('click', () => switchSection('home'));
    if (generateFromValidate) generateFromValidate.addEventListener('click', () => switchSection('generate'));
    if (bottomHomeFromValidate) bottomHomeFromValidate.addEventListener('click', () => switchSection('home'));
    if (bottomGenerateFromValidate) bottomGenerateFromValidate.addEventListener('click', () => switchSection('generate'));

    // Generate Paper functionality
    const generatePaperBtn = document.getElementById('generatePaperBtn');
    const downloadPaperBtn = document.getElementById('downloadPaperBtn');
    const resetFormBtn = document.getElementById('resetFormBtn');
    const templateUpload = document.getElementById('templateUpload');
    const uploadTemplateBtn = document.getElementById('uploadTemplateBtn');
    
    if (generatePaperBtn) generatePaperBtn.addEventListener('click', generatePaperPreview);
    if (downloadPaperBtn) downloadPaperBtn.addEventListener('click', downloadGeneratedPaper);
    if (resetFormBtn) resetFormBtn.addEventListener('click', resetQuestionForm);
    if (uploadTemplateBtn) uploadTemplateBtn.addEventListener('click', () => templateUpload.click());
    if (templateUpload) templateUpload.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            showToast('Template uploaded successfully!', 'success');
        }
    });

    // Validate Answers functionality
    const startValidationBtn = document.getElementById('startValidationBtn');
    const downloadResultsBtn = document.getElementById('downloadResultsBtn');
    const clearFilesBtn = document.getElementById('clearFilesBtn');
    const answersUpload = document.getElementById('answersUpload');
    const uploadAnswersBtn = document.getElementById('uploadAnswersBtn');
    
    if (startValidationBtn) startValidationBtn.addEventListener('click', startValidation);
    if (downloadResultsBtn) downloadResultsBtn.addEventListener('click', downloadValidationResults);
    if (clearFilesBtn) clearFilesBtn.addEventListener('click', clearAllFiles);
    if (uploadAnswersBtn) uploadAnswersBtn.addEventListener('click', () => answersUpload.click());
    if (answersUpload) answersUpload.addEventListener('change', handleFileUpload);

    // Close modal buttons
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.getAttribute('data-modal');
            closeModal(modalId);
        });
    });

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModal(e.target.id);
        }
    });

    // Switch between forms
    const switchToRegister = document.getElementById('switchToRegister');
    const switchToLogin = document.getElementById('switchToLogin');
    const switchToLoginFromForgot = document.getElementById('switchToLoginFromForgot');
    const forgotPassword = document.getElementById('forgotPassword');
    
    if (switchToRegister) switchToRegister.addEventListener('click', switchToRegister);
    if (switchToLogin) switchToLogin.addEventListener('click', switchToLogin);
    if (switchToLoginFromForgot) switchToLoginFromForgot.addEventListener('click', switchToLogin);
    if (forgotPassword) forgotPassword.addEventListener('click', switchToForgotPassword);

    // Form submissions
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (registerForm) registerForm.addEventListener('submit', handleRegister);
    if (forgotPasswordForm) forgotPasswordForm.addEventListener('submit', handleForgotPassword);
}

// Initialize the application
document.addEventListener('DOMContentLoaded', init);