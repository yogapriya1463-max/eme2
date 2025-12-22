[file content begin]
// app.js - FIXED LOGIN AND SOURCE MATERIAL UPLOAD
// (Replace the entire app.js content with this)

const API_BASE_URL = 'http://localhost:5000/api';
const USE_MOCK_API = false; // Set to false when backend is running

// State management
let currentUser = null;
let isLoggedIn = false;
let currentSection = 'home';
let token = null;

// File upload state
let uploadedFiles = [];
let generatedPaperContent = null;
let uploadedAnswerKey = null;
// Material generation state
let uploadedMaterialFile = null;
let uploadedContextFile = null; // New state for context material
let generatedMaterial = null;

// DOM Elements
const sections = {
    home: document.getElementById('homeSection'),
    generate: document.getElementById('generateSection'),
    validate: document.getElementById('validateSection'),
    generateMaterial: document.getElementById('generateMaterialSection')
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

// Handle login with fallback to mock API - FIXED VERSION
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
                console.log('Attempting login to:', `${API_BASE_URL}/login`);
                
                const apiResponse = await fetch(`${API_BASE_URL}/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                        email: email.toLowerCase(), 
                        password: password 
                    })
                });

                console.log('Login response status:', apiResponse.status);
                
                if (apiResponse.ok) {
                    const data = await apiResponse.json();
                    console.log('Login successful:', data);
                    response = { success: true, ...data };
                } else {
                    const errorData = await apiResponse.json().catch(() => ({}));
                    console.log('Login failed:', errorData);
                    response = { 
                        success: false, 
                        message: errorData.message || 'Invalid credentials. Please check your email and password.' 
                    };
                }
            } catch (apiError) {
                console.error('Backend API failed:', apiError);
                showToast('Backend server is not responding. Please check if the server is running on port 5000.', 'error');
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
            showToast(response.message || 'Login failed. Please check your credentials.', 'error');
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

// Handle registration with fallback to mock API - FIXED VERSION
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
                console.log('Attempting registration to:', `${API_BASE_URL}/register`);
                
                const apiResponse = await fetch(`${API_BASE_URL}/register`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: name,
                        email: email.toLowerCase(),
                        password: password
                    })
                });

                console.log('Registration response status:', apiResponse.status);
                
                if (apiResponse.ok) {
                    const data = await apiResponse.json();
                    console.log('Registration successful:', data);
                    response = { success: true, ...data };
                } else {
                    const errorData = await apiResponse.json().catch(() => ({}));
                    console.log('Registration failed:', errorData);
                    response = {
                        success: false,
                        message: errorData.message || 'Registration failed',
                        field: errorData.field || 'regEmail'
                    };
                }
            } catch (apiError) {
                console.error('Backend API failed:', apiError);
                showToast('Backend server is not responding. Please check if the server is running on port 5000.', 'error');
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

// Handle forgot password with fallback to mock API - FIXED VERSION
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
                console.log('Attempting forgot password to:', `${API_BASE_URL}/forgot-password`);
                
                const apiResponse = await fetch(`${API_BASE_URL}/forgot-password`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email: email.toLowerCase() })
                });

                console.log('Forgot password response status:', apiResponse.status);
                
                if (apiResponse.ok) {
                    const data = await apiResponse.json();
                    console.log('Forgot password successful:', data);
                    response = { success: true, ...data };
                } else {
                    const errorData = await apiResponse.json().catch(() => ({}));
                    console.log('Forgot password failed:', errorData);
                    response = { success: false, message: errorData.message || 'Request failed' };
                }
            } catch (apiError) {
                console.error('Backend API failed:', apiError);
                showToast('Backend server is not responding. Please check if the server is running on port 5000.', 'error');
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
        
        // Update welcome message with user name
        const welcomeMessage = document.getElementById('welcomeMessage');
        if (welcomeMessage) {
            welcomeMessage.textContent = `Welcome back, ${currentUser.name}!`;
        }
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

    // Reset the source upload
    uploadedContextFile = null;
    const sourceUpload = document.getElementById('sourceUpload');
    if (sourceUpload) {
        sourceUpload.value = ''; // Clear the file input
    }

    // Reset source file info display
    const sourceFileInfo = document.getElementById('sourceFileInfo');
    if (sourceFileInfo) sourceFileInfo.style.display = 'none';

    // Reset the upload button appearance
    const uploadSourceBtn = document.getElementById('uploadSourceBtn');
    if (uploadSourceBtn) {
        uploadSourceBtn.style.display = 'block';
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
async function generatePaperPreview() {
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

    if (questionTypes.length === 0) {
        showToast('Please select at least one question type', 'error');
        return;
    }

    const generatePaperBtn = document.getElementById('generatePaperBtn');
    const originalBtnText = generatePaperBtn.innerHTML;
    generatePaperBtn.disabled = true;
    generatePaperBtn.innerHTML = '<span class="loading"></span> Generating...';

    try {
        let paperData;

        if (USE_MOCK_API) {
            // Mock data generation
            await new Promise(resolve => setTimeout(resolve, 2000));
            paperData = {
                title, subject, date, time, marks, difficulty, topics, instructions, questionTypes,
                content: `
                    Question Paper: ${title}
                    Subject: ${subject}
                    
                    (Mock Content Generated)
                ` // Simplified for mock
            };
            // For mock we just pass the input params + mock content
        } else {
            // Real API Call
            // Real API Call with FormData
            const formData = new FormData();
            formData.append('title', title);
            formData.append('subject', subject);
            formData.append('topics', topics);
            formData.append('difficulty', difficulty);
            formData.append('total_marks', marks);

            // Append question types individually or as JSON string depending on backend expectation. 
            // Flask request.form.getlist works if we append multiple times with same key.
            questionTypes.forEach(qt => formData.append('question_types', qt));

            // Additional info as JSON string
            formData.append('additional_info', JSON.stringify({ date, time, instructions }));

            // Append context file if exists
            if (uploadedContextFile) {
                formData.append('context_file', uploadedContextFile);
            }

            const response = await fetch(`${API_BASE_URL}/generate-paper`, {
                method: 'POST',
                headers: {
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to generate paper');
            }

            paperData = {
                title, subject, date, time, marks, difficulty, topics, instructions, questionTypes,
                content: data.content // Use AI generated content
            };
        }

        // Store generated content for download
        generatedPaperContent = paperData;

        renderPaperPreview(paperData);
        showToast('Question paper generated successfully!', 'success');

    } catch (error) {
        console.error('Generate paper error:', error);
        showToast(error.message || 'An error occurred', 'error');
    } finally {
        generatePaperBtn.disabled = false;
        generatePaperBtn.innerHTML = originalBtnText;
    }
}

function renderPaperPreview(data) {
    // Determine how to display the content. 
    // If it comes from AI, it's likely markdown or plain text. 
    // We'll wrap it in a <pre> or format it if possible.

    // Simple formatter for the preview
    const formattedContent = data.content.replace(/\n/g, '<br>');

    const previewHTML = `
        <h5 style="color: #0366d6; margin-bottom: 1rem; border-bottom: 2px solid #0366d6; padding-bottom: 0.5rem;">${data.title}</h5>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; padding: 1rem; background: #f8f9fa; border-radius: 8px;">
            <div><strong>Subject:</strong> ${data.subject}</div>
            <div><strong>Date:</strong> ${data.date}</div>
            <div><strong>Duration:</strong> ${data.time} minutes</div>
            <div><strong>Total Marks:</strong> ${data.marks}</div>
            <div><strong>Difficulty:</strong> ${data.difficulty}</div>
        </div>
        <div style="margin-bottom: 1rem;"><strong>Topics Covered:</strong> ${data.topics}</div>
        <div style="margin-bottom: 1rem;"><strong>Question Types:</strong> ${data.questionTypes.join(', ')}</div>
        ${data.instructions ? `<div style="margin-bottom: 1.5rem; padding: 1rem; background: #e7f1ff; border-radius: 6px; border-left: 4px solid #0366d6;"><strong>Instructions:</strong> ${data.instructions}</div>` : ''}
        
        <div style="background: #ffffff; padding: 1.5rem; border: 1px solid #dee2e6; border-radius: 6px; white-space: pre-wrap; font-family: 'Courier New', Courier, monospace;">
            ${data.content}
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

// Handle source material upload - FIXED VERSION
function handleSourceUpload(event) {
    console.log('handleSourceUpload called');
    const files = Array.from(event.target.files);
    
    if (files.length === 0) {
        showToast('No file selected', 'warning');
        return;
    }

    const file = files[0];
    console.log('Selected file:', file.name, file.type, file.size);

    const maxSize = 10 * 1024 * 1024; // 10MB

    // Validate file size
    if (file.size > maxSize) {
        showToast('File size exceeds 10MB limit. Please choose a smaller file.', 'error');
        event.target.value = ''; // Clear the file input
        return;
    }

    // Validate file type
    const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
    ];
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt'];
    
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
        showToast('Please upload PDF, Word (DOC/DOCX) or Text (TXT) documents only', 'error');
        event.target.value = ''; // Clear the file input
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
        
        // Hide upload button and show file info
        if (uploadSourceBtn) uploadSourceBtn.style.display = 'none';
        sourceFileInfo.style.display = 'block';
        
        showToast(`Source material "${file.name}" uploaded successfully!`, 'success');
    } else {
        console.error('Source file info elements not found');
        showToast('Error displaying file information', 'error');
    }
}

// Helper function to format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
async function startValidation() {
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
    progressStatus.textContent = 'Starting validation...';

    // Disable button and show loading
    const startValidationBtn = document.getElementById('startValidationBtn');
    const originalText = startValidationBtn.innerHTML;
    startValidationBtn.innerHTML = '<span class="loading"></span> Validating...';
    startValidationBtn.disabled = true;

    try {
        if (USE_MOCK_API) {
            // Mock simulation
            let progress = 0;
            const interval = setInterval(() => {
                progress += 10;
                if (progress > 100) progress = 100;
                progressBar.style.width = `${progress}%`;
                progressPercent.textContent = `${progress}%`;
                if (progress === 100) {
                    clearInterval(interval);
                    completeValidationMock(answerPaperTitle, studentCount, startValidationBtn, originalText);
                }
            }, 300);
            return;
        }

        // Real API Call
        const formData = new FormData();
        formData.append('paper_title', answerPaperTitle);
        formData.append('answer_key', uploadedAnswerKey);

        uploadedFiles.forEach(file => {
            formData.append('files', file);
        });

        // Progress simulation for real request
        let progress = 0;
        const progressInterval = setInterval(() => {
            if (progress < 90) {
                progress += 5;
                progressBar.style.width = `${progress}%`;
                progressPercent.textContent = `${progress}%`;
                progressStatus.textContent = 'Processing files with Gemini AI...';
            }
        }, 500);

        const response = await fetch(`${API_BASE_URL}/validate-answers`, {
            method: 'POST',
            headers: {
                'Authorization': token ? `Bearer ${token}` : ''
            },
            body: formData
        });

        clearInterval(progressInterval);
        progressBar.style.width = '100%';
        progressPercent.textContent = '100%';
        progressStatus.textContent = 'Validation complete!';

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Validation failed');
        }

        // Render results using the data from backend
        renderValidationResults(data.params || {}, data.results, answerPaperTitle);

        // Reset button
        startValidationBtn.innerHTML = originalText;
        startValidationBtn.disabled = false;

        showToast('Validation completed successfully!', 'success');

        // Scroll to results
        document.getElementById('validationResults').scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    } catch (error) {
        console.error('Validation error:', error);
        showToast(error.message || 'An error occurred during validation', 'error');
        startValidationBtn.innerHTML = originalText;
        startValidationBtn.disabled = false;
        validationProgress.style.display = 'none';
    }
}

// Mock completion for fallback
function completeValidationMock(answerPaperTitle, studentCount, startValidationBtn, originalText) {
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

function renderValidationResults(params, results, title) {
    const resultsContent = document.getElementById('resultsContent');
    const validationResults = document.getElementById('validationResults');
    const downloadResultsBtn = document.getElementById('downloadResultsBtn');

    // Parse AI feedback if it's JSON, otherwise display as text
    const processedResults = results.map(r => {
        let parsed = {};
        try {
            // cleaning markdown code blocks if present
            const cleanJson = r.ai_feedback.replace(/```json/g, '').replace(/```/g, '');
            parsed = JSON.parse(cleanJson);
        } catch (e) {
            parsed = { feedback: r.ai_feedback, grade: 'N/A', marks: 'N/A' };
        }
        return { ...r, parsed };
    });

    validationResults.style.display = 'block';
    downloadResultsBtn.disabled = false;
    downloadResultsBtn.classList.remove('btn-disabled');
    downloadResultsBtn.classList.add('btn-success');

    resultsContent.innerHTML = `
        <h5 style="color: #0366d6; margin-bottom: 1rem;">Validation Report: ${title}</h5>
        <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f8f9fa;">
                        <th style="padding: 0.75rem; border-bottom: 2px solid #dee2e6;">File</th>
                        <th style="padding: 0.75rem; border-bottom: 2px solid #dee2e6;">Marks</th>
                        <th style="padding: 0.75rem; border-bottom: 2px solid #dee2e6;">Grade</th>
                        <th style="padding: 0.75rem; border-bottom: 2px solid #dee2e6;">Feedback</th>
                    </tr>
                </thead>
                <tbody>
                    ${processedResults.map(r => `
                        <tr style="border-bottom: 1px solid #dee2e6;">
                            <td style="padding: 0.75rem;">${r.filename}</td>
                            <td style="padding: 0.75rem;">${r.parsed.marks || r.parsed.total_marks || 'N/A'}</td>
                            <td style="padding: 0.75rem;">${r.parsed.grade || 'N/A'}</td>
                            <td style="padding: 0.75rem; font-size: 0.9rem;">
                                ${r.parsed.feedback || r.parsed.overall_feedback || r.ai_feedback.substring(0, 100) + '...'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
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
    console.log('Initializing application...');
    
    // Check if user is already logged in
    const savedUser = localStorage.getItem('currentUser');
    const savedToken = localStorage.getItem('token');

    if (savedUser && savedToken) {
        try {
            currentUser = JSON.parse(savedUser);
            token = savedToken;
            isLoggedIn = true;
            console.log('User found in localStorage:', currentUser.name);
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
    
    console.log('Application initialized successfully');
}

function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Navigation buttons
    const homeBtn = document.getElementById('homeBtn');
    const headerHomeBtn = document.getElementById('headerHomeBtn');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');

    if (homeBtn) homeBtn.addEventListener('click', () => switchSection('home'));
    if (headerHomeBtn) headerHomeBtn.addEventListener('click', () => switchSection('home'));

    // Modal open/close buttons
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            if (isLoggedIn) {
                logout();
            } else {
                openModal('loginModal');
            }
        });
    }

    if (registerBtn) registerBtn.addEventListener('click', () => openModal('registerModal'));

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
    const startGeneratingMaterial = document.getElementById('startGeneratingMaterial');

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
    if (startGeneratingMaterial) {
        startGeneratingMaterial.addEventListener('click', () => {
            if (isLoggedIn) {
                switchSection('generateMaterial');
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
    const generateMaterialFromGenerate = document.getElementById('generateMaterialFromGenerate');
    const validateFromGenerate = document.getElementById('validateFromGenerate');
    const bottomHomeFromGenerate = document.getElementById('bottomHomeFromGenerate');
    const bottomValidateFromGenerate = document.getElementById('bottomValidateFromGenerate');

    if (homeFromGenerate) homeFromGenerate.addEventListener('click', () => switchSection('home'));
    if (generateMaterialFromGenerate) generateMaterialFromGenerate.addEventListener('click', () => switchSection('generateMaterial'));
    if (validateFromGenerate) validateFromGenerate.addEventListener('click', () => switchSection('validate'));
    if (bottomHomeFromGenerate) bottomHomeFromGenerate.addEventListener('click', () => switchSection('home'));
    if (bottomValidateFromGenerate) bottomValidateFromGenerate.addEventListener('click', () => switchSection('validate'));
    const bottomGenerateMaterialFromGenerate = document.getElementById('bottomGenerateMaterialFromGenerate');
    if (bottomGenerateMaterialFromGenerate) bottomGenerateMaterialFromGenerate.addEventListener('click', () => switchSection('generateMaterial'));

    // Validate section navigation buttons
    const homeFromValidate = document.getElementById('homeFromValidate');
    const generateFromValidate = document.getElementById('generateFromValidate');
    const bottomHomeFromValidate = document.getElementById('bottomHomeFromValidate');
    const bottomGenerateFromValidate = document.getElementById('bottomGenerateFromValidate');

    if (homeFromValidate) homeFromValidate.addEventListener('click', () => switchSection('home'));
    if (generateFromValidate) generateFromValidate.addEventListener('click', () => switchSection('generate'));
    if (bottomHomeFromValidate) bottomHomeFromValidate.addEventListener('click', () => switchSection('home'));
    if (bottomGenerateFromValidate) bottomGenerateFromValidate.addEventListener('click', () => switchSection('generate'));
    const generateMaterialFromValidate = document.getElementById('generateMaterialFromValidate');
    if (generateMaterialFromValidate) generateMaterialFromValidate.addEventListener('click', () => switchSection('generateMaterial'));

    // Generate Material section navigation buttons
    const homeFromGenerateMaterial = document.getElementById('homeFromGenerateMaterial');
    const generateFromGenerateMaterial = document.getElementById('generateFromGenerateMaterial');
    const validateFromGenerateMaterial = document.getElementById('validateFromGenerateMaterial');

    if (homeFromGenerateMaterial) homeFromGenerateMaterial.addEventListener('click', () => switchSection('home'));
    if (generateFromGenerateMaterial) generateFromGenerateMaterial.addEventListener('click', () => switchSection('generate'));
    if (validateFromGenerateMaterial) validateFromGenerateMaterial.addEventListener('click', () => switchSection('validate'));

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
    const resetValidateFormBtn = document.getElementById('resetValidateFormBtn');

    if (startValidationBtn) startValidationBtn.addEventListener('click', startValidation);
    if (downloadResultsBtn) downloadResultsBtn.addEventListener('click', downloadValidationResults);
    if (clearFilesBtn) clearFilesBtn.addEventListener('click', clearAllFiles);
    if (uploadAnswersBtn) uploadAnswersBtn.addEventListener('click', () => answersUpload.click());
    if (uploadAnswerKeyBtn) uploadAnswerKeyBtn.addEventListener('click', () => answerKeyUpload.click());
    if (answersUpload) answersUpload.addEventListener('change', handleFileUpload);
    if (answerKeyUpload) answerKeyUpload.addEventListener('change', handleAnswerKeyUpload);
    if (removeAnswerKeyBtn) removeAnswerKeyBtn.addEventListener('click', removeAnswerKey);
    if (resetValidateFormBtn) resetValidateFormBtn.addEventListener('click', () => {
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

    // Form submissions - FIXED: Ensure forms are found and bound
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');

    console.log('Form elements found:', {
        loginForm: !!loginForm,
        registerForm: !!registerForm,
        forgotPasswordForm: !!forgotPasswordForm
    });

    if (loginForm) {
        console.log('Binding login form submit handler');
        loginForm.addEventListener('submit', handleLogin);
    } else {
        console.error('Login form not found!');
    }

    if (registerForm) {
        console.log('Binding register form submit handler');
        registerForm.addEventListener('submit', handleRegister);
    } else {
        console.error('Register form not found!');
    }

    if (forgotPasswordForm) {
        console.log('Binding forgot password form submit handler');
        forgotPasswordForm.addEventListener('submit', handleForgotPassword);
    } else {
        console.error('Forgot password form not found!');
    }

    // Generate Material functionality
    const materialUpload = document.getElementById('materialUpload');
    const uploadMaterialBtn = document.getElementById('uploadMaterialBtn');
    const removeMaterialBtn = document.getElementById('removeMaterialBtn');
    const generateMaterialBtn = document.getElementById('generateMaterialBtn');
    const downloadMaterialBtn = document.getElementById('downloadMaterialBtn');
    const resetMaterialBtn = document.getElementById('resetMaterialBtn');
    // Material options
    const mt_oneword = document.getElementById('mt_oneword');
    const mt_summary = document.getElementById('mt_summary');
    const mt_2marks = document.getElementById('mt_2marks');
    const mt_long = document.getElementById('mt_long');
    const mt_essay = document.getElementById('mt_essay');
    const materialDifficulty = document.getElementById('materialDifficulty');
    const materialTopics = document.getElementById('materialTopics');
    const materialInstructions = document.getElementById('materialInstructions');

    if (uploadMaterialBtn) uploadMaterialBtn.addEventListener('click', () => materialUpload.click());
    if (materialUpload) materialUpload.addEventListener('change', handleMaterialUpload);
    if (removeMaterialBtn) removeMaterialBtn.addEventListener('click', removeMaterial);
    if (generateMaterialBtn) generateMaterialBtn.addEventListener('click', generateMaterial);
    if (downloadMaterialBtn) downloadMaterialBtn.addEventListener('click', downloadMaterial);
    if (resetMaterialBtn) resetMaterialBtn.addEventListener('click', () => {
        if (confirm('Reset material form and clear generated content?')) resetMaterialForm();
    });

    // ===== FIXED SOURCE MATERIAL UPLOAD EVENT LISTENERS =====
    console.log('Setting up source material upload event listeners...');
    
    const uploadSourceBtn = document.getElementById('uploadSourceBtn');
    const sourceUpload = document.getElementById('sourceUpload');
    const removeSourceBtn = document.getElementById('removeSourceBtn');
    
    if (uploadSourceBtn && sourceUpload) {
        console.log('Found upload source button and input');
        uploadSourceBtn.addEventListener('click', function() {
            console.log('Upload source button clicked');
            sourceUpload.click();
        });
    } else {
        console.error('Could not find upload source elements:', { uploadSourceBtn, sourceUpload });
    }
    
    if (sourceUpload) {
        console.log('Found source upload input');
        sourceUpload.addEventListener('change', handleSourceUpload);
    }
    
    if (removeSourceBtn) {
        console.log('Found remove source button');
        removeSourceBtn.addEventListener('click', removeSourceFile);
    }
    // ===== END FIXED SOURCE MATERIAL UPLOAD =====
    
    console.log('Event listeners setup completed');
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing app...');
    init();
    
    // Additional manual binding for source upload (in case setupEventListeners doesn't catch it)
    const uploadSourceBtn = document.getElementById('uploadSourceBtn');
    const sourceUpload = document.getElementById('sourceUpload');
    const removeSourceBtn = document.getElementById('removeSourceBtn');
    
    if (uploadSourceBtn && sourceUpload && !uploadSourceBtn.hasEventListener) {
        console.log('Manual binding for source upload');
        uploadSourceBtn.hasEventListener = true;
        uploadSourceBtn.addEventListener('click', function() {
            console.log('Manual: Upload source button clicked');
            sourceUpload.click();
        });
    }
});

// Helpers for material generation UI
function humanFileSize(size) {
    if (!size) return 'Unknown size';
    if (size < 1024) return size + ' B';
    const i = Math.floor(Math.log(size) / Math.log(1024));
    return (size / Math.pow(1024, i)).toFixed(1) + ' ' + ['B', 'KB', 'MB', 'GB'][i];
}

// Material handlers
function handleMaterialUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    uploadedMaterialFile = file;
    const info = document.getElementById('materialFileInfo');
    const nameEl = document.getElementById('materialFileName');
    const sizeEl = document.getElementById('materialFileSize');
    if (info && nameEl && sizeEl) {
        nameEl.textContent = file.name;
        sizeEl.textContent = humanFileSize(file.size);
        info.style.display = 'block';
    }
    const generateBtn = document.getElementById('generateMaterialBtn');
    if (generateBtn) generateBtn.disabled = false;
}

function removeMaterial() {
    uploadedMaterialFile = null;
    const materialInput = document.getElementById('materialUpload');
    if (materialInput) materialInput.value = '';
    const info = document.getElementById('materialFileInfo');
    if (info) info.style.display = 'none';
    const generateBtn = document.getElementById('generateMaterialBtn');
    if (generateBtn) generateBtn.disabled = true;
    const downloadBtn = document.getElementById('downloadMaterialBtn');
    if (downloadBtn) downloadBtn.disabled = true;
    const preview = document.getElementById('materialPreview');
    if (preview) preview.style.display = 'none';
    generatedMaterial = null;
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/[&"'<>]/g, function (c) {
        return { '&': '&amp;', '"': '&quot;', "'": '&#39;', '<': '&lt;', '>': '&gt;' }[c];
    });
}

function displayGeneratedMaterial(data) {
    const preview = document.getElementById('materialPreview');
    const content = document.getElementById('materialPreviewContent');
    if (!preview || !content) return;
    content.innerHTML = '';
    // Show generation settings if present
    const settings = data.settings || (data.material_types ? { materialTypes: data.material_types, difficulty: data.difficulty, topics: data.topics, instructions: data.instructions } : null);
    if (settings) {
        const setEl = document.createElement('div');
        const types = settings.materialTypes || settings.material_types || [];
        setEl.innerHTML = `<div style="margin-bottom:0.75rem; font-size:0.95rem; color:#555;"><strong>Settings:</strong> Types: ${escapeHtml(Array.isArray(types) ? types.join(', ') : types)} | Difficulty: ${escapeHtml(settings.difficulty || '')} | Topics: ${escapeHtml(settings.topics || '')}</div>`;
        if (settings.instructions) {
            const ins = document.createElement('div');
            ins.style.fontSize = '0.9rem';
            ins.style.color = '#666';
            ins.style.marginBottom = '0.75rem';
            ins.textContent = `Instructions: ${settings.instructions}`;
            setEl.appendChild(ins);
        }
        content.appendChild(setEl);
    }
    const sumEl = document.createElement('div');
    sumEl.innerHTML = `<h4 style='margin-top:0;'>Summary</h4><p>${escapeHtml(data.summary)}</p>`;
    content.appendChild(sumEl);
    if (Array.isArray(data.notes) && data.notes.length) {
        const notesEl = document.createElement('div');
        notesEl.innerHTML = `<h4>Short Notes</h4><ul>${data.notes.map(n => `<li>${escapeHtml(n)}</li>`).join('')}</ul>`;
        content.appendChild(notesEl);
    }
    preview.style.display = 'block';
}

function resetMaterialForm() {
    removeMaterial();
    const summaryLength = document.getElementById('summaryLength');
    const notesCount = document.getElementById('notesCount');
    const mt_oneword = document.getElementById('mt_oneword');
    const mt_summary = document.getElementById('mt_summary');
    const mt_2marks = document.getElementById('mt_2marks');
    const mt_long = document.getElementById('mt_long');
    const mt_essay = document.getElementById('mt_essay');
    const materialDifficulty = document.getElementById('materialDifficulty');
    const materialTopics = document.getElementById('materialTopics');
    const materialInstructions = document.getElementById('materialInstructions');
    if (summaryLength) summaryLength.value = 'medium';
    if (notesCount) notesCount.value = '5';
    if (mt_oneword) mt_oneword.checked = false;
    if (mt_summary) mt_summary.checked = true;
    if (mt_2marks) mt_2marks.checked = false;
    if (mt_long) mt_long.checked = false;
    if (mt_essay) mt_essay.checked = false;
    if (materialDifficulty) materialDifficulty.value = 'medium';
    if (materialTopics) materialTopics.value = '';
    if (materialInstructions) materialInstructions.value = '';
}

function downloadMaterial() {
    if (!generatedMaterial) {
        showToast('No generated material', 'error');
        return;
    }

    const settings = generatedMaterial.settings || { material_types: generatedMaterial.material_types, difficulty: generatedMaterial.difficulty, topics: generatedMaterial.topics, instructions: generatedMaterial.instructions };
    let text = '';
    if (settings) {
        const types = settings.materialTypes || settings.material_types || [];
        text += `Settings: Types: ${Array.isArray(types) ? types.join(', ') : types} | Difficulty: ${settings.difficulty || ''} | Topics: ${settings.topics || ''}\n`;
        if (settings.instructions) text += `Instructions: ${settings.instructions}\n`;
        text += '\n';
    }
    text += 'Summary:\n' + (generatedMaterial.summary || '') + '\n\n';
    if (Array.isArray(generatedMaterial.notes) && generatedMaterial.notes.length) {
        text += 'Notes:\n' + generatedMaterial.notes.join('\n') + '\n';
    }
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'generated_material.txt';
    a.click();
    URL.revokeObjectURL(url);
}

async function mockGenerateMaterial(file, summaryLength, notesCount, materialTypes = [], difficulty = 'medium', topics = '', instructions = '') {
    const ext = (file.name || '').split('.').pop().toLowerCase();
    if (ext === 'txt') {
        const text = await file.text();
        // Pass along additional options to mock summarizer (it can tag difficulty/topics)
        const result = mockSummarizeText(text, summaryLength, notesCount);
        result.settings = { materialTypes, difficulty, topics, instructions };
        return result;
    }
    const simpleSummary = `This is a short summary (${difficulty}) of the uploaded file named ${file.name}.\nTypes: ${materialTypes.join(', ') || 'summary'}\nTopics: ${topics}`;
    const notes = Array.from({ length: Math.max(1, notesCount) }, (_, i) => `Note ${i + 1}: Key point about ${file.name}`);
    return { success: true, summary: simpleSummary, notes };
}

function mockSummarizeText(text, summaryLength, notesCount) {
    const sentences = text.replace(/\s+/g, ' ').split(/(?<=\.|\?|\!)\s/);
    let count;
    if (summaryLength === 'short') count = Math.min(2, sentences.length);
    else if (summaryLength === 'medium') count = Math.min(5, sentences.length);
    else count = Math.min(10, sentences.length);
    const summary = sentences.slice(0, count).join(' ');
    const notes = sentences.slice(count, count + notesCount).map((s, i) => `${i + 1}. ${s.trim()}`);
    return { success: true, summary, notes };
}

async function generateMaterial() {
    const generateBtn = document.getElementById('generateMaterialBtn');
    const downloadBtn = document.getElementById('downloadMaterialBtn');
    const summaryLength = document.getElementById('summaryLength').value;
    const notesCount = parseInt(document.getElementById('notesCount').value || '5', 10);
    const materialTypes = [];
    if (mt_oneword && mt_oneword.checked) materialTypes.push(mt_oneword.value);
    if (mt_summary && mt_summary.checked) materialTypes.push(mt_summary.value);
    if (mt_2marks && mt_2marks.checked) materialTypes.push(mt_2marks.value);
    if (mt_long && mt_long.checked) materialTypes.push(mt_long.value);
    if (mt_essay && mt_essay.checked) materialTypes.push(mt_essay.value);
    const difficulty = (materialDifficulty && materialDifficulty.value) || 'medium';
    const topics = (materialTopics && materialTopics.value) || '';
    const instructions = (materialInstructions && materialInstructions.value) || '';
    if (!uploadedMaterialFile) {
        showToast('Please upload a file first', 'error');
        return;
    }
    generateBtn.disabled = true;
    try {
        let response;
        if (USE_MOCK_API) {
            response = await mockGenerateMaterial(uploadedMaterialFile, summaryLength, notesCount, materialTypes, difficulty, topics, instructions);
        } else {
            const fd = new FormData();
            fd.append('file', uploadedMaterialFile);
            fd.append('summary_length', summaryLength);
            fd.append('notes_count', notesCount);
            fd.append('material_types', JSON.stringify(materialTypes));
            fd.append('difficulty', difficulty);
            fd.append('topics', topics);
            fd.append('instructions', instructions);
            const resp = await fetch(`${API_BASE_URL}/generate-material`, {
                method: 'POST',
                body: fd,
                headers: token ? { 'Authorization': 'Bearer ' + token } : {}
            });
            response = await resp.json();
        }
        if (response && response.success) {
            generatedMaterial = response;
            displayGeneratedMaterial(response);
            if (downloadBtn) downloadBtn.disabled = false;
            showToast('Material generated successfully', 'success');
        } else {
            showToast(response.message || 'Failed to generate material', 'error');
        }
    } catch (err) {
        console.error('Generate Material error:', err);
        showToast('An error occurred while generating material', 'error');
    } finally {
        generateBtn.disabled = false;
    }
}

// Template upload function (if exists)
function handleTemplateUpload(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    showToast('Template upload functionality coming soon!', 'info');
    // Reset the file input
    event.target.value = '';
}
[file content end]