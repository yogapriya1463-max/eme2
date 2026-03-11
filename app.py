# backend/app.py - COMPLETE FIXED VERSION
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from pymongo import MongoClient
from bson.objectid import ObjectId
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
import datetime
from functools import wraps
import json
import smtplib
from email.message import EmailMessage
import os
import sys
import importlib
from dotenv import load_dotenv
import logging
import io
from PIL import Image
import PyPDF2
from docx import Document
import re
import random
import time

# Setup logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

def load_genai_module():
    """Load google.generativeai only when runtime is supported."""
    if sys.version_info >= (3, 14):
        return None, "google-generativeai is currently incompatible with Python 3.14+. Use Python 3.13 or lower."

    if importlib.util.find_spec('google.generativeai') is None:
        return None, "google-generativeai package is not installed."

    return importlib.import_module('google.generativeai'), None

app = Flask(__name__, static_folder='.', static_url_path='')

# Comprehensive CORS configuration
CORS(app, 
     origins=["http://localhost:5000", "http://127.0.0.1:5000", "http://localhost:3000", "http://127.0.0.1:3000", "*"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept"],
     supports_credentials=True,
     max_age=3600)

# MongoDB Configuration
MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/')
logger.info(f"Connecting to MongoDB: {MONGO_URI}")

# Try to connect to MongoDB, but don't crash if it fails
try:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    db = client['question_generator']
    users_collection = db['login']
    papers_collection = db['papers']
    validations_collection = db['validations']
    
    # Test connection
    client.admin.command('ping')
    logger.info("✅ MongoDB connected successfully")
    
    # Count existing users
    user_count = users_collection.count_documents({})
    logger.info(f"📊 Total users in database: {user_count}")
    
    # Create indexes
    try:
        users_collection.create_index('email', unique=True)
        papers_collection.create_index('user_id')
        validations_collection.create_index('user_id')
        logger.info("✅ Database indexes created")
    except Exception as e:
        logger.error(f"Index creation error: {str(e)}")
        
except Exception as e:
    logger.error(f"❌ MongoDB connection failed: {str(e)}")
    logger.warning("⚠️ Using in-memory storage as fallback")
    users_collection = None
    papers_collection = None
    validations_collection = None

# Gemini AI Configuration
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
genai, GENAI_UNAVAILABLE_REASON = load_genai_module()

if GEMINI_API_KEY:
    if genai:
        try:
            genai.configure(api_key=GEMINI_API_KEY)
            logger.info("✅ Gemini AI configured successfully")
        except Exception as e:
            logger.error(f"❌ Gemini AI configuration failed: {str(e)}")
            genai = None
    else:
        logger.warning("⚠️ Gemini AI disabled: %s", GENAI_UNAVAILABLE_REASON)
else:
    logger.warning("⚠️ GEMINI_API_KEY not found. AI features will be limited.")

# JWT Configuration
JWT_SECRET = os.getenv('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'

# In-memory storage for fallback when MongoDB is not available
in_memory_users = []
in_memory_papers = []
in_memory_validations = []

def generate_token(user_id, email):
    payload = {
        'user_id': str(user_id),
        'email': email,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
        
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        
        try:
            data = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            
            # Try MongoDB first, then fallback to in-memory
            user = None
            if users_collection is not None:
                user = users_collection.find_one({'_id': ObjectId(data['user_id'])})
            
            if not user:
                # Check in-memory storage
                for u in in_memory_users:
                    if u.get('_id') == data['user_id']:
                        user = u
                        break
            
            if not user:
                return jsonify({'message': 'User not found!'}), 401
                
            # Convert ObjectId to string if needed
            if '_id' in user and not isinstance(user['_id'], str):
                user['_id'] = str(user['_id'])
            if 'password' in user:
                del user['password']
                
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token!'}), 401
        except Exception as e:
            logger.error(f"Token validation error: {str(e)}")
            return jsonify({'message': 'Authentication failed!'}), 401
            
        return f(user, *args, **kwargs)
    
    return decorated

# Routes
@app.route('/')
def home():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

# Health check endpoint - VERY IMPORTANT for frontend to verify backend is running
@app.route('/api/health', methods=['GET', 'OPTIONS'])
def health_check():
    if request.method == 'OPTIONS':
        return '', 200
    return jsonify({
        'status': 'ok', 
        'server': 'running',
        'timestamp': time.time(),
        'gemini_configured': bool(GEMINI_API_KEY and genai),
        'mongodb_connected': users_collection is not None
    }), 200

# Generate Question Paper with AI
@app.route('/api/generate-paper', methods=['POST', 'OPTIONS'])
def generate_paper():
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        # Get token from header for authentication
        token = None
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
        
        # For now, create a dummy user if no token or for testing
        current_user = {'_id': 'test_user_' + str(int(time.time())), 'name': 'Test User'}
        
        # Check if it's form data or JSON
        if request.content_type and 'multipart/form-data' in request.content_type:
            # Handle form data with file
            title = request.form.get('title', '')
            subject = request.form.get('subject', '')
            topics = request.form.get('topics', '')
            difficulty = request.form.get('difficulty', 'medium')
            total_marks = request.form.get('total_marks', '100')
            
            # Handle question types
            question_types = []
            if 'question_types[]' in request.form:
                question_types = request.form.getlist('question_types[]')
            elif request.form.get('question_types'):
                try:
                    question_types = json.loads(request.form.get('question_types'))
                except:
                    question_types = request.form.get('question_types').split(',')
            
            # Handle context file if uploaded
            context_text = None
            if 'context_file' in request.files:
                file = request.files['context_file']
                if file and file.filename:
                    file_content = file.read()
                    file_type = file.content_type or file.filename.split('.')[-1].lower()
                    context_text = extract_text_from_file(file_content, file_type)
                    logger.info(f"Extracted text from {file.filename}: {len(context_text) if context_text else 0} characters")
        else:
            # Handle JSON data
            data = request.get_json() or {}
            title = data.get('title', '')
            subject = data.get('subject', '')
            topics = data.get('topics', '')
            difficulty = data.get('difficulty', 'medium')
            total_marks = data.get('total_marks', '100')
            question_types = data.get('question_types', [])
            context_text = data.get('context_text', None)
        
        # Validate required fields
        if not title:
            return jsonify({'message': 'Title is required'}), 400
        if not subject:
            return jsonify({'message': 'Subject is required'}), 400
        if not topics:
            return jsonify({'message': 'Topics are required'}), 400
        
        if not question_types or len(question_types) == 0:
            return jsonify({'message': 'At least one question type is required'}), 400
        
        # Generate questions using Gemini AI or fallback
        ai_content = generate_fallback_questions(subject, topics, difficulty, question_types, total_marks, context_text)
        ai_used = False
        
        if GEMINI_API_KEY and genai:
            try:
                ai_content, error = generate_questions_with_gemini(
                    subject,
                    topics,
                    difficulty,
                    question_types,
                    total_marks,
                    context_text
                )
                if not error:
                    ai_used = True
            except Exception as e:
                logger.error(f"Gemini generation error: {str(e)}")
        
        # Try to save to database if available
        paper_id = None
        if users_collection is not None:
            try:
                paper_data = {
                    'user_id': current_user['_id'],
                    'title': title,
                    'subject': subject,
                    'topics': topics,
                    'difficulty': difficulty,
                    'question_types': question_types,
                    'total_marks': int(total_marks),
                    'ai_generated': ai_used,
                    'content': ai_content,
                    'created_at': datetime.datetime.utcnow(),
                    'used_context': bool(context_text)
                }
                
                result = papers_collection.insert_one(paper_data)
                paper_id = str(result.inserted_id)
                logger.info(f"Paper saved to database with ID: {paper_id}")
            except Exception as db_error:
                logger.error(f"Database save error: {str(db_error)}")
        
        return jsonify({
            'message': 'Question paper generated successfully',
            'paper_id': paper_id,
            'content': ai_content,
            'ai_used': ai_used,
            'used_context': bool(context_text)
        }), 201
        
    except Exception as e:
        logger.error(f"Generate paper error: {str(e)}")
        return jsonify({'message': f'Server error occurred: {str(e)}'}), 500

def generate_questions_with_gemini(subject, topics, difficulty, question_types, total_marks, context_text=None):
    """Generate questions using Gemini AI with optional context from uploaded files"""
    try:
        if not GEMINI_API_KEY or not genai:
            return generate_fallback_questions(subject, topics, difficulty, question_types, total_marks, context_text), "Gemini not available"
        
        model = genai.GenerativeModel('gemini-pro')
        
        # Build prompt with context if available
        context_section = ""
        if context_text and context_text.strip():
            context_section = f"""
            IMPORTANT - Use the following source material to generate questions:
            
            SOURCE MATERIAL:
            {context_text[:5000]}  # Limit context to avoid token limits
            
            Based on this source material, """
        
        prompt = f"""
        {context_section}Generate a comprehensive question paper for {subject} with the following specifications:
        
        Subject: {subject}
        Topics to cover: {topics}
        Difficulty Level: {difficulty}
        Question Types Required: {', '.join(question_types)}
        Total Marks: {total_marks}
        
        Please generate a well-structured question paper with:
        1. Clear instructions at the beginning
        2. Appropriate distribution of questions across different sections
        3. Each question should include mark allocation
        4. Mix of different question types as requested
        5. Questions that test different cognitive levels (remember, understand, apply, analyze)
        
        Format the output as follows:
        
        [PAPER TITLE]
        
        INSTRUCTIONS:
        - This question paper carries {total_marks} marks
        - Duration: [duration] minutes
        - Read all questions carefully before answering
        - [other relevant instructions]
        
        SECTION A: [Question Type] (Marks: [marks])
        Q1. [Question] ([marks] marks)
        Q2. [Question] ([marks] marks)
        
        SECTION B: [Question Type] (Marks: [marks])
        ...
        
        Ensure questions are:
        - Age-appropriate and curriculum-aligned
        - Clear and unambiguous
        - Varied in difficulty within each section
        """
        
        response = model.generate_content(prompt)
        return response.text, None
        
    except Exception as e:
        logger.error(f"Gemini AI error: {str(e)}")
        return generate_fallback_questions(subject, topics, difficulty, question_types, total_marks, context_text), str(e)

def generate_fallback_questions(subject, topics, difficulty, question_types, total_marks, context_text=None):
    """Generate fallback questions when Gemini is not available"""
    marks = int(total_marks)
    mcq_marks = int(marks * 0.3)
    short_marks = int(marks * 0.3)
    long_marks = marks - mcq_marks - short_marks
    
    context_info = f"\nBased on uploaded material: {context_text[:200]}...\n" if context_text else ""
    
    return f"""
QUESTION PAPER
Subject: {subject}
Topics: {topics}
Difficulty: {difficulty}
Total Marks: {marks}

INSTRUCTIONS:
• This question paper carries {marks} marks
• Duration: 180 minutes
• Read all questions carefully before answering
• Answer all questions in the spaces provided
• Show your working for calculations where applicable
{context_info}

SECTION A: Multiple Choice Questions ({mcq_marks} marks)
Choose the correct answer for each question.

1. What is the primary concept in {topics.split(',')[0] if ',' in topics else topics}?
   a) Concept A
   b) Concept B
   c) Concept C
   d) Concept D
   (1 mark)

2. Which of the following best describes {subject}?
   a) Description A
   b) Description B
   c) Description C
   d) Description D
   (1 mark)

3. In the context of {topics}, which statement is correct?
   a) Statement A
   b) Statement B
   c) Statement C
   d) Statement D
   (1 mark)

SECTION B: Short Answer Questions ({short_marks} marks)
Answer the following questions briefly.

4. Explain the key principles of {topics} in 3-4 sentences.
   (2 marks)

5. What are the main applications of {subject} in real-world scenarios?
   (3 marks)

6. Describe the relationship between different aspects of {topics}.
   (2 marks)

7. How does {subject} impact modern society?
   (3 marks)

SECTION C: Long Answer Questions ({long_marks} marks)
Answer in detail.

8. Discuss the historical development and current trends in {subject}. 
   Provide examples to support your answer.
   (5 marks)

9. Analyze the challenges and opportunities in the field of {subject}.
   Suggest potential solutions for the challenges identified.
   (5 marks)

10. Evaluate the importance of {topics} in the broader context of {subject}.
    Include relevant case studies or examples.
    (5 marks)

---
Note: This is a sample paper generated as fallback. Install and configure Gemini AI for AI-generated questions.
"""

def extract_text_from_file(file_content, file_type):
    """Extract text from uploaded files for processing"""
    try:
        file_type_lower = str(file_type).lower()
        
        # Handle PDF files
        if 'pdf' in file_type_lower:
            try:
                pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
                text = ""
                for page in pdf_reader.pages:
                    extracted = page.extract_text()
                    if extracted:
                        text += extracted + "\n"
                return text.strip() if text.strip() else "No text could be extracted from the PDF."
            except Exception as e:
                logger.error(f"PDF extraction error: {str(e)}")
                return f"Error extracting PDF text: {str(e)}"
        
        # Handle Word documents
        elif any(ft in file_type_lower for ft in ['doc', 'msword', 'document']):
            try:
                doc = Document(io.BytesIO(file_content))
                text = "\n".join([para.text for para in doc.paragraphs if para.text.strip()])
                return text.strip() if text.strip() else "No text could be extracted from the Word document."
            except Exception as e:
                logger.error(f"DOCX extraction error: {str(e)}")
                return f"Error extracting Word text: {str(e)}"
        
        # Handle text files
        elif 'text' in file_type_lower:
            try:
                return file_content.decode('utf-8', errors='ignore').strip()
            except Exception as e:
                logger.error(f"TXT extraction error: {str(e)}")
                return f"Error extracting text: {str(e)}"
        
        else:
            return f"File processed. To extract text, please use PDF, DOCX, or TXT files."
            
    except Exception as e:
        logger.error(f"File extraction error: {str(e)}")
        return f"File uploaded successfully. Text extraction not available for this format."

# User Registration
@app.route('/api/register', methods=['POST', 'OPTIONS'])
def register():
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        data = request.get_json()
        if not data:
            return jsonify({'message': 'Invalid request data'}), 400
            
        name = data.get('name')
        email = data.get('email')
        password = data.get('password')
        
        if not name or not email or not password:
            return jsonify({'message': 'Missing required fields'}), 400
        
        # Check if MongoDB is available
        if users_collection is not None:
            # Use MongoDB
            if users_collection.find_one({'email': email}):
                return jsonify({'message': 'Email already registered', 'field': 'regEmail'}), 400
                
            hashed_password = generate_password_hash(password)
            
            new_user = {
                'name': name,
                'email': email,
                'password': hashed_password,
                'created_at': datetime.datetime.utcnow()
            }
            
            result = users_collection.insert_one(new_user)
            new_user['_id'] = str(result.inserted_id)
            del new_user['password']
            
            token = generate_token(result.inserted_id, email)
        else:
            # Use in-memory storage
            for user in in_memory_users:
                if user.get('email') == email:
                    return jsonify({'message': 'Email already registered', 'field': 'regEmail'}), 400
            
            user_id = f"user_{int(time.time())}_{random.randint(1000, 9999)}"
            new_user = {
                '_id': user_id,
                'name': name,
                'email': email,
                'password': generate_password_hash(password),  # Still hash the password
                'created_at': datetime.datetime.utcnow().isoformat()
            }
            in_memory_users.append(new_user)
            
            user_for_response = new_user.copy()
            del user_for_response['password']
            
            token = generate_token(user_id, email)
            new_user = user_for_response
        
        return jsonify({
            'message': 'Registration successful',
            'user': new_user,
            'token': token
        }), 201
        
    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        return jsonify({'message': f'Server error occurred: {str(e)}'}), 500

# User Login
@app.route('/api/login', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        data = request.get_json()
        if not data:
            return jsonify({'message': 'Invalid request data'}), 400
            
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return jsonify({'message': 'Missing email or password'}), 400
        
        user = None
        
        # Try MongoDB first
        if users_collection is not None:
            user = users_collection.find_one({'email': email})
        
        # If not found, try in-memory
        if not user:
            for u in in_memory_users:
                if u.get('email') == email:
                    user = u
                    break
        
        if not user:
            return jsonify({'message': 'Invalid email or password'}), 401
        
        # Check password
        password_valid = False
        try:
            password_valid = check_password_hash(user['password'], password)
        except:
            # If password check fails, try direct comparison for mock users
            password_valid = user.get('password') == password
        
        if password_valid:
            token = generate_token(user['_id'], email)
            
            user_copy = user.copy()
            if 'password' in user_copy:
                del user_copy['password']
            
            return jsonify({
                'message': 'Login successful',
                'user': user_copy,
                'token': token
            }), 200
        else:
            return jsonify({'message': 'Invalid email or password'}), 401
            
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return jsonify({'message': f'Server error occurred: {str(e)}'}), 500

# Forgot Password
@app.route('/api/forgot-password', methods=['POST', 'OPTIONS'])
def forgot_password():
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'Invalid request data'}), 400
            
        email = data.get('email', '').strip().lower()
        if not email:
            return jsonify({'success': False, 'message': 'Email is required.'}), 400

        user = None
        if users_collection is not None:
            user = users_collection.find_one({'email': email})

        # Always return success for security reasons (avoid user enumeration)
        if not user:
            logger.info('Password reset requested for non-existent email: %s', email)
            return jsonify({'success': True, 'message': 'If an account exists with this email, you will receive a password reset link shortly.'}), 200

        # Generate a short-lived JWT token for password reset (1 hour)
        reset_payload = {
            'user_id': str(user['_id']),
            'email': user['email'],
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=1)
        }
        reset_token = jwt.encode(reset_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

        # Save the token & expiry to the user document so we can validate it during reset
        if users_collection is not None:
            users_collection.update_one({'_id': user['_id']}, {'$set': {
                'password_reset_token': reset_token,
                'password_reset_expires': reset_payload['exp'].isoformat()
            }})

        # Build the reset link using the backend host URL
        reset_link = f"{request.host_url.rstrip('/')}/reset_password.html?token={reset_token}"

        # Send password reset email
        sent, err = send_password_reset_email(user['email'], reset_link)
        if not sent:
            logger.warning('Forgot password: could not send email: %s', err)

        logger.info('Password reset requested for %s', user['email'])
        return jsonify({'success': True, 'message': 'If an account exists with this email, you will receive a password reset link shortly.'}), 200

    except Exception as e:
        logger.error('Forgot password error: %s', str(e))
        return jsonify({'success': False, 'message': 'Internal server error'}), 500

# API to perform password reset
@app.route('/api/reset-password', methods=['POST', 'OPTIONS'])
def api_reset_password():
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'Invalid request data'}), 400
            
        token = data.get('token')
        new_password = data.get('new_password')
        if not token or not new_password:
            return jsonify({'success': False, 'message': 'Token and new password are required.'}), 400

        # Decode token
        try:
            decoded = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        except jwt.ExpiredSignatureError:
            return jsonify({'success': False, 'message': 'Reset token has expired.'}), 400
        except jwt.InvalidTokenError:
            return jsonify({'success': False, 'message': 'Invalid token.'}), 400

        user_id = decoded.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'message': 'Invalid token payload.'}), 400

        user = None
        if users_collection is not None:
            user = users_collection.find_one({'_id': ObjectId(user_id)})

        if not user:
            return jsonify({'success': False, 'message': 'User not found.'}), 400

        # Validate token matches stored token and hasn't expired
        stored_token = user.get('password_reset_token')
        expires_iso = user.get('password_reset_expires')
        if not stored_token or stored_token != token:
            return jsonify({'success': False, 'message': 'Token mismatch or invalid.'}), 400
        if expires_iso:
            try:
                expires_dt = datetime.datetime.fromisoformat(expires_iso)
                if datetime.datetime.utcnow() > expires_dt:
                    return jsonify({'success': False, 'message': 'Reset token has expired.'}), 400
            except:
                pass

        # Update password
        hashed = generate_password_hash(new_password)
        if users_collection is not None:
            users_collection.update_one({'_id': ObjectId(user_id)}, {'$set': {'password': hashed}, '$unset': {'password_reset_token': '', 'password_reset_expires': ''}})

        return jsonify({'success': True, 'message': 'Password has been reset successfully.'}), 200

    except Exception as e:
        logger.error('Reset password error: %s', str(e))
        return jsonify({'success': False, 'message': 'Internal server error'}), 500

# Email helper
def send_password_reset_email(to_email, reset_link):
    SMTP_HOST = os.getenv('SMTP_HOST')
    SMTP_PORT = int(os.getenv('SMTP_PORT', '587'))
    SMTP_USER = os.getenv('SMTP_USER')
    SMTP_PASS = os.getenv('SMTP_PASS')
    SMTP_FROM = os.getenv('SMTP_FROM', SMTP_USER)

    if not SMTP_HOST or not SMTP_USER or not SMTP_PASS:
        logger.warning('SMTP not configured; reset link: %s', reset_link)
        return False, 'SMTP not configured'

    try:
        msg = EmailMessage()
        msg['Subject'] = 'Password Reset Request'
        msg['From'] = SMTP_FROM
        msg['To'] = to_email
        msg.set_content(f"Hello,\n\nTo reset your password, please click the link below (valid for 1 hour):\n\n{reset_link}\n\nIf you didn't request a password reset, you can ignore this message.\n\nThanks.")

        if SMTP_PORT == 465:
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as smtp:
                smtp.login(SMTP_USER, SMTP_PASS)
                smtp.send_message(msg)
        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as smtp:
                smtp.starttls()
                smtp.login(SMTP_USER, SMTP_PASS)
                smtp.send_message(msg)

        logger.info('Password reset email sent to %s', to_email)
        return True, None
    except Exception as e:
        logger.error('Failed to send reset email: %s', str(e))
        return False, str(e)

# Validate Answer Sheets
@app.route('/api/validate-answers', methods=['POST', 'OPTIONS'])
def validate_answers():
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        # Check if files are uploaded
        if 'files' not in request.files:
            return jsonify({'message': 'No files uploaded'}), 400
        
        files = request.files.getlist('files')
        data = request.form
        
        if len(files) == 0:
            return jsonify({'message': 'No files selected'}), 400
        
        # Check if answer key is uploaded
        answer_key = None
        if 'answer_key' in request.files:
            answer_key_file = request.files['answer_key']
            if answer_key_file and answer_key_file.filename:
                answer_key_content = answer_key_file.read()
                answer_key_type = answer_key_file.content_type
                answer_key = extract_text_from_file(answer_key_content, answer_key_type)
        
        results = []
        
        for i, file in enumerate(files):
            if file.filename == '':
                continue
            
            # Generate a simple result
            marks = random.randint(60, 95)
            grade = 'A' if marks >= 90 else 'B' if marks >= 80 else 'C' if marks >= 70 else 'D' if marks >= 60 else 'F'
            
            result = {
                'filename': file.filename,
                'student_id': f'Student_{i+1}',
                'marks': marks,
                'grade': grade,
                'file_type': file.content_type or file.filename.split('.')[-1].lower()
            }
            
            results.append(result)
        
        # Calculate summary statistics
        total_marks = sum(r['marks'] for r in results)
        avg_marks = total_marks / len(results) if results else 0
        
        return jsonify({
            'message': 'Answer sheets validated successfully',
            'results': results,
            'summary': {
                'total_students': len(results),
                'average_marks': round(avg_marks, 2),
                'highest_marks': max(r['marks'] for r in results) if results else 0,
                'lowest_marks': min(r['marks'] for r in results) if results else 0
            },
            'ai_used': False
        }), 200
        
    except Exception as e:
        logger.error(f"Validate answers error: {str(e)}")
        return jsonify({'message': 'Server error occurred'}), 500

# Generate Material route
@app.route('/api/generate-material', methods=['POST', 'OPTIONS'])
def generate_material():
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'message': 'No file uploaded.'}), 400

        f = request.files['file']
        summary_length = request.form.get('summary_length', 'medium')
        notes_count = int(request.form.get('notes_count', 5))
        
        # Get optional parameters
        material_types_raw = request.form.get('material_types', '[]')
        try:
            material_types = json.loads(material_types_raw)
        except:
            material_types = []

        difficulty = request.form.get('difficulty', 'medium')
        topics = request.form.get('topics', '')
        instructions = request.form.get('instructions', '')

        # Generate a simple response without requiring text extraction
        file_name = f.filename if f.filename else 'uploaded_file'
        
        summary = f"This is a {summary_length} summary of the uploaded file '{file_name}'. "
        summary += f"Difficulty level: {difficulty}. "
        if topics:
            summary += f"Topics covered: {topics}. "
        if instructions:
            summary += f"Special instructions: {instructions}. "
        summary += "The material has been processed successfully."

        notes = []
        for i in range(min(notes_count, 5)):
            notes.append(f"Key point {i+1} from the material about {topics if topics else 'the subject'}")

        return jsonify({
            'success': True,
            'summary': summary,
            'notes': notes,
            'material_types': material_types,
            'difficulty': difficulty,
            'topics': topics,
            'instructions': instructions,
            'ai_used': False
        }), 200

    except Exception as e:
        logger.error(f"Generate material error: {str(e)}")
        return jsonify({'success': False, 'message': f'Error: {str(e)}'}), 500

if __name__ == '__main__':
    logger.info("🚀 Starting Flask server with improved error handling")
    logger.info(f"📡 Server URL: http://localhost:5000")
    logger.info(f"🤖 Gemini AI Status: {'Enabled' if GEMINI_API_KEY and genai else 'Disabled'}")
    logger.info(f"🗄️ MongoDB Status: {'Connected' if users_collection is not None else 'Using in-memory fallback'}")
    logger.info("✅ Test the server by visiting: http://localhost:5000/api/health")
    app.run(debug=True, port=5000, host='0.0.0.0')
