// app.js - UPDATED FILE UPLOAD AND DOWNLOAD FUNCTIONS
// (Replace the entire app.js content with this)

const API_BASE_URL = 'http://localhost:5000/api';

// State management
let currentUser = null;
let isLoggedIn = false;
let currentSection = 'home';
let token = null;

// File upload state
let uploadedFiles = [];
let generatedPaperContent = null;

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
                showLoginModal();
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

// Generate Paper Functions - UPDATED
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
    
    // Create a blob with the paper content
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

// UPDATED: Reset question form including uploaded template file
function resetQuestionForm() {
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
    
    showToast('Form has been reset', 'info');
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

// Validate Answers Functions - UPDATED
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
    
    if (uploadedFiles.length > 0) {
        const startValidationBtn = document.getElementById('startValidationBtn');
        startValidationBtn.disabled = false;
        startValidationBtn.classList.remove('btn-disabled');
        startValidationBtn.classList.add('btn-primary');
        showToast(`${validFiles.length} file(s) uploaded successfully`, 'success');
    }
}

function updateFileList() {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '';
    
    if (uploadedFiles.length === 0) {
        fileList.innerHTML = '<p style="color: #666; font-style: italic; padding: 1rem; text-align: center;">No files uploaded yet</p>';
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
            showToast('File removed', 'info');
            
            // Update validation button state
            const startValidationBtn = document.getElementById('startValidationBtn');
            if (uploadedFiles.length === 0) {
                startValidationBtn.disabled = true;
                startValidationBtn.classList.add('btn-disabled');
                startValidationBtn.classList.remove('btn-primary');
            }
        };
        
        fileItem.appendChild(fileInfo);
        fileItem.appendChild(removeBtn);
        list.appendChild(fileItem);
    });
    
    // Add summary
    const summary = document.createElement('div');
    summary.style.marginTop = '1rem';
    summary.style.padding = '0.75rem';
    summary.style.background = '#e7f1ff';
    summary.style.borderRadius = '6px';
    summary.style.border = '1px solid #0366d6';
    summary.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <strong>Total Files:</strong> ${uploadedFiles.length}
            </div>
            <div style="font-size: 0.9rem; color: #0366d6;">
                Click "Start Validation" to begin
            </div>
        </div>
    `;
    list.appendChild(summary);
    
    fileList.appendChild(list);
}

function startValidation() {
    if (uploadedFiles.length === 0) {
        showToast('Please upload answer sheets first', 'error');
        return;
    }
    
    // Get answer paper title
    const answerPaperTitle = document.getElementById('answerPaperTitle').value || 'Untitled Answer Paper';
    
    // Disable button and show loading
    const startValidationBtn = document.getElementById('startValidationBtn');
    const originalText = startValidationBtn.innerHTML;
    startValidationBtn.innerHTML = '<span class="loading"></span> Validating...';
    startValidationBtn.disabled = true;
    
    showToast('Validating answer sheets... This may take a moment.', 'info');
    
    // Simulate validation delay
    setTimeout(() => {
        // Generate sample results
        const resultsHTML = `
            <div style="margin-bottom: 1.5rem;">
                <h5 style="color: #0366d6; margin-bottom: 0.5rem; border-bottom: 2px solid #0366d6; padding-bottom: 0.5rem;">
                    Validation Report: ${answerPaperTitle}
                </h5>
                <div style="font-size: 0.9rem; color: #666; margin-bottom: 1rem;">
                    Validated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
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
            
            <div style="margin-bottom: 1.5rem;">
                <h6 style="color: #495057; margin-bottom: 0.75rem;">📊 Student Performance Summary</h6>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f8f9fa;">
                                <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid #dee2e6;">Student</th>
                                <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid #dee2e6;">Score</th>
                                <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid #dee2e6;">Grade</th>
                                <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid #dee2e6;">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Array.from({length: Math.min(5, uploadedFiles.length)}, (_, i) => `
                                <tr style="border-bottom: 1px solid #dee2e6;">
                                    <td style="padding: 0.75rem;">Student ${i + 1}</td>
                                    <td style="padding: 0.75rem;">${Math.floor(Math.random() * 30) + 70}%</td>
                                    <td style="padding: 0.75rem;">${['A', 'B', 'C'][i % 3]}</td>
                                    <td style="padding: 0.75rem;">
                                        <span style="padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.85rem; background: #d4edda; color: #155724;">
                                            Validated
                                        </span>
                                    </td>
                                </tr>
                            `).join('')}
                            ${uploadedFiles.length > 5 ? `
                                <tr>
                                    <td colspan="4" style="padding: 0.75rem; text-align: center; color: #666;">
                                        ... and ${uploadedFiles.length - 5} more students
                                    </td>
                                </tr>
                            ` : ''}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div style="margin-top: 1.5rem; padding: 1rem; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #6f42c1;">
                <strong>📋 Validation Summary:</strong>
                <ul style="margin-top: 0.5rem; padding-left: 1.5rem;">
                    <li>All ${uploadedFiles.length} answer sheets processed successfully</li>
                    <li>AI detected handwriting with 95% accuracy</li>
                    <li>Answers graded based on standardized rubrics</li>
                    <li>Detailed reports available for each student</li>
                    <li>Average processing time: 2.3 seconds per sheet</li>
                </ul>
            </div>
            
            <div style="margin-top: 1.5rem; padding: 1rem; background: #e7f1ff; border-radius: 6px; border: 1px solid #0366d6;">
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
        downloadResultsBtn.classList.remove('btn-disabled');
        downloadResultsBtn.classList.add('btn-success');
        
        // Reset button
        startValidationBtn.innerHTML = originalText;
        startValidationBtn.disabled = false;
        
        showToast('Validation completed successfully!', 'success');
        
        // Scroll to results
        validationResults.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 3000);
}

function downloadValidationResults() {
    if (uploadedFiles.length === 0) {
        showToast('No validation results available', 'error');
        return;
    }
    
    const answerPaperTitle = document.getElementById('answerPaperTitle').value || 'Untitled_Answer_Paper';
    
    showToast('Preparing download...', 'info');
    
    // Create CSV content
    let csvContent = 'Student Name,Score,Grade,Status\n';
    
    // Add sample data
    for (let i = 0; i < Math.min(10, uploadedFiles.length); i++) {
        const score = Math.floor(Math.random() * 30) + 70;
        const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : 'D';
        csvContent += `Student ${i + 1},${score}%,${grade},Validated\n`;
    }
    
    // Add summary
    csvContent += '\nSUMMARY\n';
    csvContent += `Total Papers,${uploadedFiles.length}\n`;
    csvContent += 'Average Score,78.5%\n';
    csvContent += 'Highest Score,92%\n';
    csvContent += 'Lowest Score,65%\n';
    csvContent += `Validation Date,${new Date().toLocaleDateString()}\n`;
    
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

function clearAllFiles() {
    if (uploadedFiles.length === 0) {
        showToast('No files to clear', 'info');
        return;
    }
    
    if (confirm(`Are you sure you want to remove all ${uploadedFiles.length} uploaded files?`)) {
        uploadedFiles = [];
        updateFileList();
        
        const validationResults = document.getElementById('validationResults');
        const downloadResultsBtn = document.getElementById('downloadResultsBtn');
        const startValidationBtn = document.getElementById('startValidationBtn');
        
        validationResults.style.display = 'none';
        downloadResultsBtn.disabled = true;
        downloadResultsBtn.classList.add('btn-disabled');
        downloadResultsBtn.classList.remove('btn-success');
        startValidationBtn.disabled = true;
        startValidationBtn.classList.add('btn-disabled');
        startValidationBtn.classList.remove('btn-primary');
        
        // Reset upload button
        const uploadAnswersBtn = document.getElementById('uploadAnswersBtn');
        const innerDiv = uploadAnswersBtn.querySelector('div');
        innerDiv.innerHTML = `
            <div>📁</div>
            <h4>Upload Answer Sheets</h4>
            <p>Click to upload answer sheets for validation</p>
            <p style="font-size: 0.9rem; color: #666;">Supported: PDF, DOC, DOCX, Images</p>
        `;
        
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

    // Generate Paper functionality - UPDATED
    const generatePaperBtn = document.getElementById('generatePaperBtn');
    const downloadPaperBtn = document.getElementById('downloadPaperBtn');
    const resetFormBtn = document.getElementById('resetFormBtn');
    const templateUpload = document.getElementById('templateUpload');
    const uploadTemplateBtn = document.getElementById('uploadTemplateBtn');
    
    if (generatePaperBtn) generatePaperBtn.addEventListener('click', generatePaperPreview);
    if (downloadPaperBtn) downloadPaperBtn.addEventListener('click', downloadGeneratedPaper);
    if (resetFormBtn) resetFormBtn.addEventListener('click', resetQuestionForm);
    if (uploadTemplateBtn) uploadTemplateBtn.addEventListener('click', () => {
        // Reset the file input before opening file dialog (optional)
        // templateUpload.value = '';
        templateUpload.click();
    });
    if (templateUpload) templateUpload.addEventListener('change', handleTemplateUpload);

    // Validate Answers functionality - UPDATED
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
document.addEventListener('DOMContentLoaded', init);// app.js - UPDATED FILE UPLOAD AND DOWNLOAD FUNCTIONS
// (Replace the entire app.js content with this)

const API_BASE_URL = 'http://localhost:5000/api';

// State management
let currentUser = null;
let isLoggedIn = false;
let currentSection = 'home';
let token = null;

// File upload state
let uploadedFiles = [];
let generatedPaperContent = null;

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
                showLoginModal();
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

// Generate Paper Functions - UPDATED
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
    
    // Create a blob with the paper content
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

// UPDATED: Reset question form including uploaded template file
function resetQuestionForm() {
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
    
    showToast('Form has been reset', 'info');
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

// Validate Answers Functions - UPDATED
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
    
    if (uploadedFiles.length > 0) {
        const startValidationBtn = document.getElementById('startValidationBtn');
        startValidationBtn.disabled = false;
        startValidationBtn.classList.remove('btn-disabled');
        startValidationBtn.classList.add('btn-primary');
        showToast(`${validFiles.length} file(s) uploaded successfully`, 'success');
    }
}

function updateFileList() {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '';
    
    if (uploadedFiles.length === 0) {
        fileList.innerHTML = '<p style="color: #666; font-style: italic; padding: 1rem; text-align: center;">No files uploaded yet</p>';
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
            showToast('File removed', 'info');
            
            // Update validation button state
            const startValidationBtn = document.getElementById('startValidationBtn');
            if (uploadedFiles.length === 0) {
                startValidationBtn.disabled = true;
                startValidationBtn.classList.add('btn-disabled');
                startValidationBtn.classList.remove('btn-primary');
            }
        };
        
        fileItem.appendChild(fileInfo);
        fileItem.appendChild(removeBtn);
        list.appendChild(fileItem);
    });
    
    // Add summary
    const summary = document.createElement('div');
    summary.style.marginTop = '1rem';
    summary.style.padding = '0.75rem';
    summary.style.background = '#e7f1ff';
    summary.style.borderRadius = '6px';
    summary.style.border = '1px solid #0366d6';
    summary.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <strong>Total Files:</strong> ${uploadedFiles.length}
            </div>
            <div style="font-size: 0.9rem; color: #0366d6;">
                Click "Start Validation" to begin
            </div>
        </div>
    `;
    list.appendChild(summary);
    
    fileList.appendChild(list);
}

function startValidation() {
    if (uploadedFiles.length === 0) {
        showToast('Please upload answer sheets first', 'error');
        return;
    }
    
    // Get answer paper title
    const answerPaperTitle = document.getElementById('answerPaperTitle').value || 'Untitled Answer Paper';
    
    // Disable button and show loading
    const startValidationBtn = document.getElementById('startValidationBtn');
    const originalText = startValidationBtn.innerHTML;
    startValidationBtn.innerHTML = '<span class="loading"></span> Validating...';
    startValidationBtn.disabled = true;
    
    showToast('Validating answer sheets... This may take a moment.', 'info');
    
    // Simulate validation delay
    setTimeout(() => {
        // Generate sample results
        const resultsHTML = `
            <div style="margin-bottom: 1.5rem;">
                <h5 style="color: #0366d6; margin-bottom: 0.5rem; border-bottom: 2px solid #0366d6; padding-bottom: 0.5rem;">
                    Validation Report: ${answerPaperTitle}
                </h5>
                <div style="font-size: 0.9rem; color: #666; margin-bottom: 1rem;">
                    Validated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
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
            
            <div style="margin-bottom: 1.5rem;">
                <h6 style="color: #495057; margin-bottom: 0.75rem;">📊 Student Performance Summary</h6>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f8f9fa;">
                                <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid #dee2e6;">Student</th>
                                <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid #dee2e6;">Score</th>
                                <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid #dee2e6;">Grade</th>
                                <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid #dee2e6;">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Array.from({length: Math.min(5, uploadedFiles.length)}, (_, i) => `
                                <tr style="border-bottom: 1px solid #dee2e6;">
                                    <td style="padding: 0.75rem;">Student ${i + 1}</td>
                                    <td style="padding: 0.75rem;">${Math.floor(Math.random() * 30) + 70}%</td>
                                    <td style="padding: 0.75rem;">${['A', 'B', 'C'][i % 3]}</td>
                                    <td style="padding: 0.75rem;">
                                        <span style="padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.85rem; background: #d4edda; color: #155724;">
                                            Validated
                                        </span>
                                    </td>
                                </tr>
                            `).join('')}
                            ${uploadedFiles.length > 5 ? `
                                <tr>
                                    <td colspan="4" style="padding: 0.75rem; text-align: center; color: #666;">
                                        ... and ${uploadedFiles.length - 5} more students
                                    </td>
                                </tr>
                            ` : ''}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div style="margin-top: 1.5rem; padding: 1rem; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #6f42c1;">
                <strong>📋 Validation Summary:</strong>
                <ul style="margin-top: 0.5rem; padding-left: 1.5rem;">
                    <li>All ${uploadedFiles.length} answer sheets processed successfully</li>
                    <li>AI detected handwriting with 95% accuracy</li>
                    <li>Answers graded based on standardized rubrics</li>
                    <li>Detailed reports available for each student</li>
                    <li>Average processing time: 2.3 seconds per sheet</li>
                </ul>
            </div>
            
            <div style="margin-top: 1.5rem; padding: 1rem; background: #e7f1ff; border-radius: 6px; border: 1px solid #0366d6;">
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
        downloadResultsBtn.classList.remove('btn-disabled');
        downloadResultsBtn.classList.add('btn-success');
        
        // Reset button
        startValidationBtn.innerHTML = originalText;
        startValidationBtn.disabled = false;
        
        showToast('Validation completed successfully!', 'success');
        
        // Scroll to results
        validationResults.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 3000);
}

function downloadValidationResults() {
    if (uploadedFiles.length === 0) {
        showToast('No validation results available', 'error');
        return;
    }
    
    const answerPaperTitle = document.getElementById('answerPaperTitle').value || 'Untitled_Answer_Paper';
    
    showToast('Preparing download...', 'info');
    
    // Create CSV content
    let csvContent = 'Student Name,Score,Grade,Status\n';
    
    // Add sample data
    for (let i = 0; i < Math.min(10, uploadedFiles.length); i++) {
        const score = Math.floor(Math.random() * 30) + 70;
        const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : 'D';
        csvContent += `Student ${i + 1},${score}%,${grade},Validated\n`;
    }
    
    // Add summary
    csvContent += '\nSUMMARY\n';
    csvContent += `Total Papers,${uploadedFiles.length}\n`;
    csvContent += 'Average Score,78.5%\n';
    csvContent += 'Highest Score,92%\n';
    csvContent += 'Lowest Score,65%\n';
    csvContent += `Validation Date,${new Date().toLocaleDateString()}\n`;
    
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

function clearAllFiles() {
    if (uploadedFiles.length === 0) {
        showToast('No files to clear', 'info');
        return;
    }
    
    if (confirm(`Are you sure you want to remove all ${uploadedFiles.length} uploaded files?`)) {
        uploadedFiles = [];
        updateFileList();
        
        const validationResults = document.getElementById('validationResults');
        const downloadResultsBtn = document.getElementById('downloadResultsBtn');
        const startValidationBtn = document.getElementById('startValidationBtn');
        
        validationResults.style.display = 'none';
        downloadResultsBtn.disabled = true;
        downloadResultsBtn.classList.add('btn-disabled');
        downloadResultsBtn.classList.remove('btn-success');
        startValidationBtn.disabled = true;
        startValidationBtn.classList.add('btn-disabled');
        startValidationBtn.classList.remove('btn-primary');
        
        // Reset upload button
        const uploadAnswersBtn = document.getElementById('uploadAnswersBtn');
        const innerDiv = uploadAnswersBtn.querySelector('div');
        innerDiv.innerHTML = `
            <div>📁</div>
            <h4>Upload Answer Sheets</h4>
            <p>Click to upload answer sheets for validation</p>
            <p style="font-size: 0.9rem; color: #666;">Supported: PDF, DOC, DOCX, Images</p>
        `;
        
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

    // Generate Paper functionality - UPDATED
    const generatePaperBtn = document.getElementById('generatePaperBtn');
    const downloadPaperBtn = document.getElementById('downloadPaperBtn');
    const resetFormBtn = document.getElementById('resetFormBtn');
    const templateUpload = document.getElementById('templateUpload');
    const uploadTemplateBtn = document.getElementById('uploadTemplateBtn');
    
    if (generatePaperBtn) generatePaperBtn.addEventListener('click', generatePaperPreview);
    if (downloadPaperBtn) downloadPaperBtn.addEventListener('click', downloadGeneratedPaper);
    if (resetFormBtn) resetFormBtn.addEventListener('click', resetQuestionForm);
    if (uploadTemplateBtn) uploadTemplateBtn.addEventListener('click', () => {
        // Reset the file input before opening file dialog (optional)
        // templateUpload.value = '';
        templateUpload.click();
    });
    if (templateUpload) templateUpload.addEventListener('change', handleTemplateUpload);

    // Validate Answers functionality - UPDATED
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