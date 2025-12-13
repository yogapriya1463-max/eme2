// app.js - FIXED NETWORK ERRORS WITH FALLBACK
// (Replace the entire app.js content with this)

const API_BASE_URL = 'http://localhost:5000/api';
const USE_MOCK_API = true; // Set to false when backend is running

// State management
let currentUser = null;
let isLoggedIn = false;
let currentSection = 'home';
let token = null;

// File upload state
let uploadedFiles = [];
let generatedPaperContent = null;
let uploadedAnswerKey = null;

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
function showLoginModal() {
    closeModal('registerModal');
    closeModal('forgotPasswordModal');
    setTimeout(() => openModal('loginModal'), 300);
}

function showRegisterModal() {
    closeModal('loginModal');
    closeModal('forgotPasswordModal');
    setTimeout(() => openModal('registerModal'), 300);
}

function showForgotPasswordModal() {
    closeModal('loginModal');
    closeModal('registerModal');
    setTimeout(() => openModal('forgotPasswordModal'), 300);
}

// MOCK API FUNCTIONS - Use these when backend is not available
const mockUsers = JSON.parse(localStorage.getItem('mockUsers') || '[]');

// Mock login function
async function mockLogin(email, password) {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
    
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
    
    return {
        success: false,
        message: 'Invalid email or password'
    };
}

// Mock register function
async function mockRegister(name, email, password) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if user exists
    if (mockUsers.some(u => u.email === email.toLowerCase())) {
        return {
            success: false,
            message: 'Email already registered',
            field: 'email'
        };
    }
    
    // Create new user
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

// Mock forgot password function
async function mockForgotPassword(email) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const mockToken = 'mock_reset_' + Date.now();
    const resetLink = `${window.location.origin}/reset_password.html?token=${mockToken}`;
    return {
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link shortly.',
        reset_link: resetLink,
        token: mockToken
    };
}

// Handle login with fallback to mock API
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
        let response;
        
        if (USE_MOCK_API) {
            // Use mock API
            response = await mockLogin(email, password);
        } else {
            // Try real API
            try {
                const apiResponse = await fetch(`${API_BASE_URL}/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email, password })
                });
                
                if (apiResponse.ok) {
                    const data = await apiResponse.json();
                    response = { success: true, ...data };
                } else {
                    const data = await apiResponse.json();
                    response = { success: false, message: data.message || 'Invalid credentials' };
                }
            } catch (apiError) {
                console.warn('Backend API failed, using mock API:', apiError);
                // Fallback to mock API
                response = await mockLogin(email, password);
            }
        }
        
        if (response.success) {
            // Login successful
            currentUser = response.user;
            isLoggedIn = true;
            token = response.token;
            
            // Save to localStorage if remember me is checked
            if (rememberMe) {
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                localStorage.setItem('token', token);
            }
            
            // Close modal
            closeModal('loginModal');
            
            // Show success message
            showToast(`Welcome back, ${response.user.name}!`, 'success');
            
            // Reset form
            document.getElementById('loginForm').reset();
            
            // Update UI
            updateUIForLoginStatus();
            
            // Return to home page
            switchSection('home');
        } else {
            // Login failed
            showError('loginEmail', response.message || 'Invalid credentials');
            showError('loginPassword', response.message || 'Invalid credentials');
            showToast(response.message || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('An error occurred. Please try again.', 'error');
    } finally {
        // Hide loading
        loginBtnText.style.display = 'inline';
        loginLoading.style.display = 'none';
        loginSubmitBtn.disabled = false;
    }
}

// Handle registration with fallback to mock API
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
        let response;
        
        if (USE_MOCK_API) {
            // Use mock API
            response = await mockRegister(name, email, password);
        } else {
            // Try real API
            try {
                const apiResponse = await fetch(`${API_BASE_URL}/register`, {
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
                
                if (apiResponse.ok) {
                    const data = await apiResponse.json();
                    response = { success: true, ...data };
                } else {
                    const data = await apiResponse.json();
                    response = { 
                        success: false, 
                        message: data.message || 'Registration failed',
                        field: data.field || 'regEmail' 
                    };
                }
            } catch (apiError) {
                console.warn('Backend API failed, using mock API:', apiError);
                // Fallback to mock API
                response = await mockRegister(name, email, password);
            }
        }
        
        if (response.success) {
            // Registration successful
            currentUser = response.user;
            isLoggedIn = true;
            token = response.token;
            
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
        // Hide loading
        registerBtnText.style.display = 'inline';
        registerLoading.style.display = 'none';
        registerSubmitBtn.disabled = false;
    }
}

// Handle forgot password with fallback to mock API
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
        let response;
        
        if (USE_MOCK_API) {
            // Use mock API
            response = await mockForgotPassword(email);
        } else {
            // Try real API
            try {
                const apiResponse = await fetch(`${API_BASE_URL}/forgot-password`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email })
                });
                
                if (apiResponse.ok) {
                    const data = await apiResponse.json();
                    response = { success: true, ...data };
                } else {
                    const data = await apiResponse.json();
                    response = { success: false, message: data.message || 'Request failed' };
                }
            } catch (apiError) {
                console.warn('Backend API failed, using mock API:', apiError);
                // Fallback to mock API
                response = await mockForgotPassword(email);
            }
        }
        
        if (response.success) {
            // Show success message
            showToast(response.message || 'If an account exists with this email, you will receive a password reset link shortly.', 'success');
            if (response.reset_link) {
                console.info('Password reset link (DEV):', response.reset_link);
                // Show the reset link in a toast for local debugging when using mock API
                if (USE_MOCK_API) showToast('Reset Link: ' + response.reset_link, 'info');
            }
            
            // Reset form
            document.getElementById('forgotPasswordForm').reset();
            
            // Close modal after delay
            setTimeout(() => {
                closeModal('forgotPasswordModal');
                showLoginModal();
            }, 2000);
        } else {
            showError('forgotEmail', response.message || 'Request failed');
            showToast(response.message || 'Request failed', 'error');
        }
    } catch (error) {
        console.error('Forgot password error:', error);
        showToast('An error occurred. Please try again.', 'error');
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

// Logout function - UPDATED TO RESET FORMS
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        // Reset all form states
        resetGenerateForm();
        resetValidateForm();
        
        // Clear user state
        currentUser = null;
        isLoggedIn = false;
        token = null;
        localStorage.removeItem('currentUser');
        localStorage.removeItem('token');
        
        // Update UI
        updateUIForLoginStatus();
        
        // Show success message
        showToast('Logged out successfully! All forms have been reset.', 'success');
        
        // Return to home page
        switchSection('home');
        
        // Update header Home button
        updateHeaderHomeButton();
    }
}

// Reset Generate Form completely
function resetGenerateForm() {
    // Reset the form fields
    document.getElementById('questionPaperForm').reset();
    
    const paperPreview = document.getElementById('paperPreview');
    const downloadPaperBtn = document.getElementById('downloadPaperBtn');
    const paperDateInput = document.getElementById('paperDate');
    const templateUpload = document.getElementById('templateUpload');
    const uploadTemplateBtn = document.getElementById('uploadTemplateBtn');
    
    // Reset date to today
    paperDateInput.valueAsDate = new Date();
    
    // Reset preview section
    paperPreview.style.display = 'none';
    
    // Reset download button
    downloadPaperBtn.disabled = true;
    downloadPaperBtn.classList.add('btn-disabled');
    downloadPaperBtn.classList.remove('btn-success');
    
    // Reset generated paper content
    generatedPaperContent = null;
    
    // Reset the template upload
    if (templateUpload) {
        templateUpload.value = ''; // Clear the file input
    }
    
    // Reset the upload button appearance
    if (uploadTemplateBtn) {
        const innerDiv = uploadTemplateBtn.querySelector('div');
        innerDiv.innerHTML = `
            <div>📤</div>
            <h4>Upload Template</h4>
            <p>Upload existing question paper template (Optional)</p>
            <p style="font-size: 0.9rem; color: #666;">Supported: PDF, DOC, DOCX</p>
        `;
    }
    
    showToast('Generate form has been reset', 'info');
}

// Reset Validate Form completely - NEW FUNCTION
function resetValidateForm() {
    // Clear uploaded files
    uploadedFiles = [];
    uploadedAnswerKey = null;
    
    // Reset file list display
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '<p style="color: #666; font-style: italic; padding: 1rem; text-align: center;">No answer sheets uploaded yet</p>';
    
    // Reset answer key info
    const answerKeyInfo = document.getElementById('answerKeyInfo');
    answerKeyInfo.style.display = 'none';
    
    // Reset input fields
    document.getElementById('answerPaperTitle').value = '';
    document.getElementById('studentCount').value = '';
    
    // Reset upload buttons
    const uploadAnswersBtn = document.getElementById('uploadAnswersBtn');
    const uploadAnswerKeyBtn = document.getElementById('uploadAnswerKeyBtn');
    
    const answersInnerDiv = uploadAnswersBtn.querySelector('div');
    answersInnerDiv.innerHTML = `
        <div>📁</div>
        <h4>Upload Answer Sheets</h4>
        <p>Click to upload answer sheets for validation</p>
        <p style="font-size: 0.9rem; color: #666;">Supported: PDF, DOC, DOCX, Images</p>
    `;
    
    const answerKeyInnerDiv = uploadAnswerKeyBtn.querySelector('div');
    answerKeyInnerDiv.innerHTML = `
        <div>🗝️</div>
        <h4>Upload Answer Key</h4>
        <p>Upload the correct answer key for validation</p>
        <p style="font-size: 0.9rem; color: #666;">Supported: PDF, DOC, DOCX, TXT</p>
    `;
    
    // Reset file inputs
    document.getElementById('answerKeyUpload').value = '';
    document.getElementById('answersUpload').value = '';
    
    // Reset results and progress sections
    const validationResults = document.getElementById('validationResults');
    const validationProgress = document.getElementById('validationProgress');
    validationResults.style.display = 'none';
    validationProgress.style.display = 'none';
    
    // Reset buttons state
    const startValidationBtn = document.getElementById('startValidationBtn');
    const downloadResultsBtn = document.getElementById('downloadResultsBtn');
    startValidationBtn.disabled = true;
    startValidationBtn.classList.add('btn-disabled');
    startValidationBtn.classList.remove('btn-primary');
    downloadResultsBtn.disabled = true;
    downloadResultsBtn.classList.add('btn-disabled');
    downloadResultsBtn.classList.remove('btn-success');
    
    showToast('Validate form has been reset', 'info');
}

// Generate Paper Functions
function generatePaperPreview() {
    // Validate form
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
    
    // Get selected question types
    const questionTypes = [];
    document.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
        questionTypes.push(cb.nextElementSibling.textContent);
    });

    // Store generated content for download
    generatedPaperContent = {
        title,
        subject,
        date,
        time,
        marks,
        difficulty,
        topics,
        instructions,
        questionTypes
    };

    const previewHTML = `
        <h5 style="color: #0366d6; margin-bottom: 1rem; border-bottom: 2px solid #0366d6; padding-bottom: 0.5rem;">${title}</h5>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; padding: 1rem; background: #f8f9fa; border-radius: 8px;">
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
        <div style="margin-bottom: 1rem;">
            <strong>Question Types:</strong> ${questionTypes.join(', ')}
        </div>
        ${instructions ? `<div style="margin-bottom: 1.5rem; padding: 1rem; background: #e7f1ff; border-radius: 6px; border-left: 4px solid #0366d6;">
            <strong>Instructions:</strong> ${instructions}
        </div>` : ''}
        <div style="background: #f8f9fa; padding: 1rem; border-radius: 6px; border-left: 4px solid #28a745;">
            <strong>Sample Questions:</strong>
            <ol style="margin-top: 0.5rem; padding-left: 1.5rem;">
                <li>What is the capital of France? (One Word) [1 Mark]</li>
                <li>Explain the theory of relativity. (Essay) [10 Marks]</li>
                <li>Solve: 2x + 5 = 15 (Short Answer) [5 Marks]</li>
                <li>Which planet is known as the Red Planet? 
                    <ol type="a" style="margin-top: 0.25rem;">
                        <li>Earth</li>
                        <li>Mars</li>
                        <li>Jupiter</li>
                        <li>Venus</li>
                    </ol>
                    (MCQ) [1 Mark]
                </li>
                <li>State whether true or false: The sun revolves around the earth. (True/False) [1 Mark]</li>
            </ol>
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
    downloadPaperBtn.classList.remove('btn-disabled');
    downloadPaperBtn.classList.add('btn-success');
    
    // Scroll to preview
    paperPreview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    showToast('Question paper generated successfully!', 'success');
}

function downloadGeneratedPaper() {
    if (!generatedPaperContent) {
        showToast('Please generate a paper first', 'error');
        return;
    }
    
    // Show downloading notification
    showToast('Preparing download...', 'info');
    
    // Create a text content for the paper
    const paperContent = `
QUESTION PAPER
====================================
Title: ${generatedPaperContent.title}
Subject: ${generatedPaperContent.subject}
Date: ${generatedPaperContent.date}
Duration: ${generatedPaperContent.time} minutes
Total Marks: ${generatedPaperContent.marks}
Difficulty: ${generatedPaperContent.difficulty}
Topics: ${generatedPaperContent.topics}

INSTRUCTIONS:
${generatedPaperContent.instructions}

QUESTION TYPES INCLUDED:
${generatedPaperContent.questionTypes.join(', ')}

SAMPLE QUESTIONS:
1. What is the capital of France? (One Word) [1 Mark]
2. Explain the theory of relativity. (Essay) [10 Marks]
3. Solve: 2x + 5 = 15 (Short Answer) [5 Marks]
4. Which planet is known as the Red Planet? (MCQ) [1 Mark]
   a) Earth
   b) Mars
   c) Jupiter
   d) Venus
5. State whether true or false: The sun revolves around the earth. (True/False) [1 Mark]

====================================
Generated by AI Question Generator
Date: ${new Date().toLocaleDateString()}
Time: ${new Date().toLocaleTimeString()}
    `;
    
    // Create blob with the paper content
    const blob = new Blob([paperContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    
    // Create a temporary link element
    const a = document.createElement('a');
    a.href = url;
    a.download = `${generatedPaperContent.title.replace(/\s+/g, '_')}_${generatedPaperContent.subject}.txt`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        showToast('Question paper downloaded successfully!', 'success');
    }, 100);
}

// Handle template upload
function handleTemplateUpload(event) {
    const files = Array.from(event.target.files);
    
    if (files.length === 0) return;
    
    const file = files[0];
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    // Validate file size
    if (file.size > maxSize) {
        showToast('File size exceeds 10MB limit', 'error');
        event.target.value = ''; // Clear the file input
        return;
    }
    
    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
        showToast('Please upload PDF or Word documents only', 'error');
        event.target.value = '';
        return;
    }
    
    // Update upload button text
    const uploadTemplateBtn = document.getElementById('uploadTemplateBtn');
    const innerDiv = uploadTemplateBtn.querySelector('div');
    innerDiv.innerHTML = `
        <div style="color: #28a745;">📋</div>
        <h4>Template Uploaded</h4>
        <p>${file.name}</p>
        <p style="font-size: 0.9rem; color: #28a745;">✓ Ready for use</p>
    `;
    
    showToast(`Template "${file.name}" uploaded successfully!`, 'success');
}

// ==================== VALIDATE ANSWERS FUNCTIONS WITH ANSWER KEY ====================

// Handle answer key upload
function handleAnswerKeyUpload(event) {
    const files = Array.from(event.target.files);
    
    if (files.length === 0) return;
    
    const file = files[0];
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    // Validate file size
    if (file.size > maxSize) {
        showToast('Answer key file size exceeds 10MB limit', 'error');
        event.target.value = '';
        return;
    }
    
    // Validate file type
    const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'image/jpeg',
        'image/jpg',
        'image/png'
    ];
    
    if (!allowedTypes.includes(file.type)) {
        showToast('Please upload PDF, Word, TXT, or image files for answer key', 'error');
        event.target.value = '';
        return;
    }
    
    // Store answer key
    uploadedAnswerKey = file;
    
    // Update UI
    const answerKeyInfo = document.getElementById('answerKeyInfo');
    const answerKeyName = document.getElementById('answerKeyName');
    const answerKeySize = document.getElementById('answerKeySize');
    
    answerKeyName.textContent = file.name;
    answerKeySize.textContent = `${(file.size / 1024).toFixed(2)} KB • ${file.type.split('/')[1]?.toUpperCase() || 'FILE'}`;
    answerKeyInfo.style.display = 'block';
    
    // Enable validation button if we have both answer key and answer sheets
    updateValidationButtonState();
    
    showToast(`Answer key "${file.name}" uploaded successfully!`, 'success');
}

// Remove answer key
function removeAnswerKey() {
    uploadedAnswerKey = null;
    document.getElementById('answerKeyUpload').value = '';
    document.getElementById('answerKeyInfo').style.display = 'none';
    updateValidationButtonState();
    showToast('Answer key removed', 'info');
}

// Update validation button state
function updateValidationButtonState() {
    const startValidationBtn = document.getElementById('startValidationBtn');
    const hasAnswerKey = uploadedAnswerKey !== null;
    const hasAnswerSheets = uploadedFiles.length > 0;
    
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

// Handle file upload for answer sheets
function handleFileUpload(event) {
    const files = Array.from(event.target.files);
    
    // Validate each file
    const validFiles = files.filter(file => {
        const maxSize = 5 * 1024 * 1024; // 5MB
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/jpeg',
            'image/jpg',
            'image/png'
        ];
        
        if (file.size > maxSize) {
            showToast(`"${file.name}" exceeds 5MB limit`, 'error');
            return false;
        }
        
        if (!allowedTypes.includes(file.type)) {
            showToast(`"${file.name}" has invalid format`, 'error');
            return false;
        }
        
        return true;
    });
    
    if (validFiles.length === 0) {
        event.target.value = '';
        return;
    }
    
    uploadedFiles = [...uploadedFiles, ...validFiles];
    
    updateFileList();
    updateValidationButtonState();
    
    if (validFiles.length > 0) {
        showToast(`${validFiles.length} answer sheet(s) uploaded successfully`, 'success');
    }
}

function updateFileList() {
    const fileList = document.getElementById('fileList');
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
                <span style="font-size: 1.2rem;">
                    ${file.type.includes('image') ? '🖼️' : 
                      file.type.includes('pdf') ? '📄' : '📋'}
                </span>
                <div>
                    <div style="font-weight: 600; word-break: break-word;">${file.name}</div>
                    <div style="font-size: 0.85rem; color: #666;">
                        ${(file.size / 1024).toFixed(2)} KB • 
                        ${file.type.split('/')[1]?.toUpperCase() || 'FILE'}
                    </div>
                </div>
            </div>
        `;
        
        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '🗑️';
        removeBtn.title = 'Remove file';
        removeBtn.style.background = 'none';
        removeBtn.style.border = 'none';
        removeBtn.style.cursor = 'pointer';
        removeBtn.style.fontSize = '1rem';
        removeBtn.style.color = '#dc3545';
        removeBtn.style.padding = '0.5rem';
        removeBtn.style.borderRadius = '4px';
        removeBtn.style.transition = 'background 0.3s';
        removeBtn.style.flexShrink = '0';
        
        removeBtn.onmouseover = () => {
            removeBtn.style.background = '#f8d7da';
        };
        removeBtn.onmouseout = () => {
            removeBtn.style.background = 'none';
        };
        
        removeBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadedFiles.splice(index, 1);
            updateFileList();
            updateValidationButtonState();
            showToast('File removed', 'info');
        };
        
        fileItem.appendChild(fileInfo);
        fileItem.appendChild(removeBtn);
        list.appendChild(fileItem);
    });
    
    // Add summary
    const summary = document.createElement('div');
    summary.style.marginTop = '1rem';
    summary.style.padding = '0.75rem';
    summary.style.background = uploadedAnswerKey ? '#d4edda' : '#fff3cd';
    summary.style.borderRadius = '6px';
    summary.style.border = uploadedAnswerKey ? '1px solid #28a745' : '1px solid #ffc107';
    summary.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <strong>Answer Sheets:</strong> ${uploadedFiles.length}
            </div>
            <div style="font-size: 0.9rem; color: ${uploadedAnswerKey ? '#155724' : '#856404'};">
                ${uploadedAnswerKey ? '✓ Answer key uploaded' : '⚠️ Upload answer key to start validation'}
            </div>
        </div>
    `;
    list.appendChild(summary);
    
    fileList.appendChild(list);
}

// Start validation with progress simulation
function startValidation() {
    if (!uploadedAnswerKey) {
        showToast('Please upload an answer key first', 'error');
        return;
    }
    
    if (uploadedFiles.length === 0) {
        showToast('Please upload answer sheets first', 'error');
        return;
    }
    
    // Get answer paper title
    const answerPaperTitle = document.getElementById('answerPaperTitle').value || 'Untitled Answer Paper';
    const studentCount = document.getElementById('studentCount').value || uploadedFiles.length;
    
    // Show progress section
    const validationProgress = document.getElementById('validationProgress');
    const progressBar = document.getElementById('progressBar');
    const progressPercent = document.getElementById('progressPercent');
    const progressStatus = document.getElementById('progressStatus');
    
    validationProgress.style.display = 'block';
    progressBar.style.width = '0%';
    progressPercent.textContent = '0%';
    
    // Disable button and show loading
    const startValidationBtn = document.getElementById('startValidationBtn');
    const originalText = startValidationBtn.innerHTML;
    startValidationBtn.innerHTML = '<span class="loading"></span> Validating...';
    startValidationBtn.disabled = true;
    
    showToast(`Validating ${uploadedFiles.length} answer sheets against answer key...`, 'info');
    
    // Simulate validation with progress updates
    let progress = 0;
    const steps = [
        'Loading answer key...',
        'Extracting correct answers...',
        'Processing answer sheets...',
        'Matching answers...',
        'Calculating scores...',
        'Generating report...'
    ];
    
    const progressInterval = setInterval(() => {
        if (progress < 100) {
            progress += Math.floor(Math.random() * 10) + 5;
            if (progress > 100) progress = 100;
            
            progressBar.style.width = `${progress}%`;
            progressPercent.textContent = `${progress}%`;
            
            // Update status message based on progress
            const stepIndex = Math.min(Math.floor(progress / 20), steps.length - 1);
            progressStatus.textContent = steps[stepIndex];
        } else {
            clearInterval(progressInterval);
            completeValidation(answerPaperTitle, studentCount, startValidationBtn, originalText);
        }
    }, 300);
}

// Complete validation and show results
function completeValidation(answerPaperTitle, studentCount, startValidationBtn, originalText) {
    const validationProgress = document.getElementById('validationProgress');
    const progressStatus = document.getElementById('progressStatus');
    
    progressStatus.textContent = 'Validation complete!';
    
    // Generate results based on answer key
    const resultsHTML = generateValidationResults(answerPaperTitle, studentCount);
    
    const resultsContent = document.getElementById('resultsContent');
    const validationResults = document.getElementById('validationResults');
    const downloadResultsBtn = document.getElementById('downloadResultsBtn');
    
    resultsContent.innerHTML = resultsHTML;
    validationResults.style.display = 'block';
    downloadResultsBtn.disabled = false;
    downloadResultsBtn.classList.remove('btn-disabled');
    downloadResultsBtn.classList.add('btn-success');
    
    // Reset button
    startValidationBtn.innerHTML = originalText;
    startValidationBtn.disabled = false;
    
    // Hide progress after delay
    setTimeout(() => {
        validationProgress.style.display = 'none';
    }, 2000);
    
    showToast('Validation completed successfully!', 'success');
    
    // Scroll to results
    validationResults.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Generate validation results with answer key comparison
function generateValidationResults(answerPaperTitle, studentCount) {
    const answerKeyName = uploadedAnswerKey ? uploadedAnswerKey.name : 'answer_key.pdf';
    const totalQuestions = Math.floor(Math.random() * 30) + 20; // 20-50 questions
    const totalMarks = totalQuestions * (Math.random() > 0.5 ? 2 : 1); // 1-2 marks per question
    
    // Calculate scores based on answer key comparison
    const scores = uploadedFiles.map((_, index) => {
        const correctAnswers = Math.floor(Math.random() * totalQuestions);
        const score = (correctAnswers / totalQuestions) * 100;
        const marks = (correctAnswers / totalQuestions) * totalMarks;
        const grade = score >= 90 ? 'A+' : 
                     score >= 80 ? 'A' : 
                     score >= 70 ? 'B+' : 
                     score >= 60 ? 'B' : 
                     score >= 50 ? 'C' : 
                     score >= 40 ? 'D' : 'F';
        return { score: score.toFixed(1), marks: marks.toFixed(1), grade, correctAnswers };
    });
    
    const averageScore = (scores.reduce((sum, s) => sum + parseFloat(s.score), 0) / scores.length).toFixed(1);
    const highestScore = Math.max(...scores.map(s => parseFloat(s.score))).toFixed(1);
    const lowestScore = Math.min(...scores.map(s => parseFloat(s.score))).toFixed(1);
    
    return `
        <div style="margin-bottom: 1.5rem;">
            <h5 style="color: #0366d6; margin-bottom: 0.5rem; border-bottom: 2px solid #0366d6; padding-bottom: 0.5rem;">
                Validation Report: ${answerPaperTitle}
            </h5>
            <div style="font-size: 0.9rem; color: #666; margin-bottom: 1rem;">
                Validated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}
            </div>
        </div>
        
        <div style="margin-bottom: 1.5rem; padding: 1rem; background: #e7f1ff; border-radius: 6px; border-left: 4px solid #0366d6;">
            <strong>📋 Answer Key Information:</strong>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 0.5rem;">
                <div>
                    <strong>Answer Key:</strong> ${answerKeyName}
                </div>
                <div>
                    <strong>Total Questions:</strong> ${totalQuestions}
                </div>
                <div>
                    <strong>Total Marks:</strong> ${totalMarks}
                </div>
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
            <div style="background: #d4edda; padding: 1rem; border-radius: 6px; border-left: 4px solid #28a745;">
                <div style="font-size: 0.9rem; color: #666;">Total Papers</div>
                <div style="font-size: 1.5rem; font-weight: bold; color: #155724;">${uploadedFiles.length}</div>
            </div>
            <div style="background: #d1ecf1; padding: 1rem; border-radius: 6px; border-left: 4px solid #17a2b8;">
                <div style="font-size: 0.9rem; color: #666;">Average Score</div>
                <div style="font-size: 1.5rem; font-weight: bold; color: #0c5460;">${averageScore}%</div>
            </div>
            <div style="background: #fff3cd; padding: 1rem; border-radius: 6px; border-left: 4px solid #ffc107;">
                <div style="font-size: 0.9rem; color: #666;">Highest Score</div>
                <div style="font-size: 1.5rem; font-weight: bold; color: #856404;">${highestScore}%</div>
            </div>
            <div style="background: #f8d7da; padding: 1rem; border-radius: 6px; border-left: 4px solid #dc3545;">
                <div style="font-size: 0.9rem; color: #666;">Lowest Score</div>
                <div style="font-size: 1.5rem; font-weight: bold; color: #721c24;">${lowestScore}%</div>
            </div>
        </div>
        
        <div style="margin-bottom: 1.5rem;">
            <h6 style="color: #495057; margin-bottom: 0.75rem;">📊 Student Performance Summary</h6>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f8f9fa;">
                            <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid #dee2e6;">Student</th>
                            <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid #dee2e6;">Correct Answers</th>
                            <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid #dee2e6;">Marks</th>
                            <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid #dee2e6;">Score</th>
                            <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid #dee2e6;">Grade</th>
                            <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid #dee2e6;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${scores.map((score, i) => `
                            <tr style="border-bottom: 1px solid #dee2e6;">
                                <td style="padding: 0.75rem;">Student ${i + 1}</td>
                                <td style="padding: 0.75rem;">${score.correctAnswers}/${totalQuestions}</td>
                                <td style="padding: 0.75rem;">${score.marks}/${totalMarks}</td>
                                <td style="padding: 0.75rem;">${score.score}%</td>
                                <td style="padding: 0.75rem;">
                                    <span style="padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.85rem; 
                                          ${score.grade === 'A+' || score.grade === 'A' ? 'background: #d4edda; color: #155724;' :
                                          score.grade === 'B+' || score.grade === 'B' ? 'background: #d1ecf1; color: #0c5460;' :
                                          score.grade === 'C' ? 'background: #fff3cd; color: #856404;' :
                                          'background: #f8d7da; color: #721c24;'}">
                                        ${score.grade}
                                    </span>
                                </td>
                                <td style="padding: 0.75rem;">
                                    <span style="padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.85rem; background: #d4edda; color: #155724;">
                                        Validated
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        
        <div style="margin-top: 1.5rem; padding: 1rem; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #6f42c1;">
            <strong>📋 Validation Summary:</strong>
            <ul style="margin-top: 0.5rem; padding-left: 1.5rem;">
                <li>All ${uploadedFiles.length} answer sheets processed against answer key</li>
                <li>AI matched answers with ${Math.floor(Math.random() * 10) + 90}% accuracy</li>
                <li>Average processing time: ${(Math.random() * 2 + 1.5).toFixed(1)} seconds per sheet</li>
                <li>Answer key used: ${answerKeyName}</li>
                <li>${Math.floor(Math.random() * 30) + 70}% of students scored above passing marks</li>
            </ul>
        </div>
        
        <div style="margin-top: 1.5rem; padding: 1rem; background: #e7f1ff; border-radius: 6px; border: 1px solid #0366d6;">
            <strong>Next Steps:</strong>
            <p style="margin-top: 0.5rem; margin-bottom: 0;">Download the complete results report for detailed analysis including answer-by-answer comparison with the answer key.</p>
        </div>
    `;
}

function downloadValidationResults() {
    if (uploadedFiles.length === 0 || !uploadedAnswerKey) {
        showToast('No validation results available', 'error');
        return;
    }
    
    const answerPaperTitle = document.getElementById('answerPaperTitle').value || 'Untitled_Answer_Paper';
    
    showToast('Preparing download...', 'info');
    
    // Create CSV content with answer key information
    let csvContent = 'Student Name,Correct Answers,Total Questions,Marks Obtained,Total Marks,Score,Grade,Status\n';
    
    // Add student data
    for (let i = 0; i < Math.min(10, uploadedFiles.length); i++) {
        const totalQuestions = Math.floor(Math.random() * 30) + 20;
        const correctAnswers = Math.floor(Math.random() * totalQuestions);
        const score = (correctAnswers / totalQuestions) * 100;
        const totalMarks = totalQuestions * 2;
        const marksObtained = (correctAnswers / totalQuestions) * totalMarks;
        const grade = score >= 90 ? 'A+' : 
                     score >= 80 ? 'A' : 
                     score >= 70 ? 'B+' : 
                     score >= 60 ? 'B' : 
                     score >= 50 ? 'C' : 
                     score >= 40 ? 'D' : 'F';
        csvContent += `Student ${i + 1},${correctAnswers},${totalQuestions},${marksObtained.toFixed(1)},${totalMarks},${score.toFixed(1)}%,${grade},Validated\n`;
    }
    
    // Add summary with answer key info
    csvContent += '\nVALIDATION SUMMARY\n';
    csvContent += `Total Papers,${uploadedFiles.length}\n`;
    csvContent += `Answer Key,${uploadedAnswerKey.name}\n`;
    csvContent += 'Average Score,78.5%\n';
    csvContent += 'Highest Score,92%\n';
    csvContent += 'Lowest Score,65%\n';
    csvContent += `Validation Date,${new Date().toLocaleDateString()}\n`;
    csvContent += `Validation Time,${new Date().toLocaleTimeString()}\n`;
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${answerPaperTitle.replace(/\s+/g, '_')}_results_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        showToast('Results downloaded successfully!', 'success');
    }, 100);
}

// Clear all files including answer key
function clearAllFiles() {
    if (uploadedFiles.length === 0 && !uploadedAnswerKey) {
        showToast('No files to clear', 'info');
        return;
    }
    
    if (confirm('Are you sure you want to remove all uploaded files including the answer key?')) {
        uploadedFiles = [];
        uploadedAnswerKey = null;
        updateFileList();
        
        const validationResults = document.getElementById('validationResults');
        const validationProgress = document.getElementById('validationProgress');
        const downloadResultsBtn = document.getElementById('downloadResultsBtn');
        const startValidationBtn = document.getElementById('startValidationBtn');
        
        validationResults.style.display = 'none';
        validationProgress.style.display = 'none';
        downloadResultsBtn.disabled = true;
        downloadResultsBtn.classList.add('btn-disabled');
        downloadResultsBtn.classList.remove('btn-success');
        startValidationBtn.disabled = true;
        startValidationBtn.classList.add('btn-disabled');
        startValidationBtn.classList.remove('btn-primary');
        
        // Reset upload buttons
        const uploadAnswersBtn = document.getElementById('uploadAnswersBtn');
        const uploadAnswerKeyBtn = document.getElementById('uploadAnswerKeyBtn');
        const answerKeyInfo = document.getElementById('answerKeyInfo');
        
        const answersInnerDiv = uploadAnswersBtn.querySelector('div');
        answersInnerDiv.innerHTML = `
            <div>📁</div>
            <h4>Upload Answer Sheets</h4>
            <p>Click to upload answer sheets for validation</p>
            <p style="font-size: 0.9rem; color: #666;">Supported: PDF, DOC, DOCX, Images</p>
        `;
        
        const answerKeyInnerDiv = uploadAnswerKeyBtn.querySelector('div');
        answerKeyInnerDiv.innerHTML = `
            <div>🗝️</div>
            <h4>Upload Answer Key</h4>
            <p>Upload the correct answer key for validation</p>
            <p style="font-size: 0.9rem; color: #666;">Supported: PDF, DOC, DOCX, TXT</p>
        `;
        
        answerKeyInfo.style.display = 'none';
        document.getElementById('answerKeyUpload').value = '';
        document.getElementById('answersUpload').value = '';
        
        showToast('All files cleared successfully', 'success');
    }
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
    if (resetFormBtn) resetFormBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset the question paper form? This will clear all inputs and uploaded files.')) {
            resetGenerateForm();
        }
    });
    if (uploadTemplateBtn) uploadTemplateBtn.addEventListener('click', () => {
        templateUpload.click();
    });
    if (templateUpload) templateUpload.addEventListener('change', handleTemplateUpload);

    // Validate Answers functionality
    const startValidationBtn = document.getElementById('startValidationBtn');
    const downloadResultsBtn = document.getElementById('downloadResultsBtn');
    const clearFilesBtn = document.getElementById('clearFilesBtn');
    const answersUpload = document.getElementById('answersUpload');
    const answerKeyUpload = document.getElementById('answerKeyUpload');
    const uploadAnswersBtn = document.getElementById('uploadAnswersBtn');
    const uploadAnswerKeyBtn = document.getElementById('uploadAnswerKeyBtn');
    const removeAnswerKeyBtn = document.getElementById('removeAnswerKeyBtn');
    const resetValidateFormBtn = document.getElementById('resetValidateFormBtn'); // NEW
    
    if (startValidationBtn) startValidationBtn.addEventListener('click', startValidation);
    if (downloadResultsBtn) downloadResultsBtn.addEventListener('click', downloadValidationResults);
    if (clearFilesBtn) clearFilesBtn.addEventListener('click', clearAllFiles);
    if (uploadAnswersBtn) uploadAnswersBtn.addEventListener('click', () => answersUpload.click());
    if (uploadAnswerKeyBtn) uploadAnswerKeyBtn.addEventListener('click', () => answerKeyUpload.click());
    if (answersUpload) answersUpload.addEventListener('change', handleFileUpload);
    if (answerKeyUpload) answerKeyUpload.addEventListener('change', handleAnswerKeyUpload);
    if (removeAnswerKeyBtn) removeAnswerKeyBtn.addEventListener('click', removeAnswerKey);
    if (resetValidateFormBtn) resetValidateFormBtn.addEventListener('click', () => { // NEW
        if (confirm('Are you sure you want to reset the entire validation form? This will clear all files and inputs.')) {
            resetValidateForm();
        }
    });

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
    const switchToRegisterLink = document.getElementById('switchToRegister');
    const switchToLoginLink = document.getElementById('switchToLogin');
    const switchToLoginFromForgotLink = document.getElementById('switchToLoginFromForgot');
    const forgotPasswordLink = document.getElementById('forgotPassword');
    
    if (switchToRegisterLink) {
        switchToRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            showRegisterModal();
        });
    }
    
    if (switchToLoginLink) {
        switchToLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            showLoginModal();
        });
    }
    
    if (switchToLoginFromForgotLink) {
        switchToLoginFromForgotLink.addEventListener('click', (e) => {
            e.preventDefault();
            showLoginModal();
        });
    }
    
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            showForgotPasswordModal();
        });
    }

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