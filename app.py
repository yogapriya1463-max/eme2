# backend/app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from bson.objectid import ObjectId
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
import datetime
from functools import wraps
import smtplib
from email.message import EmailMessage
import os
from dotenv import load_dotenv
import logging
import google.generativeai as genai
import tempfile
import base64
import io
from PIL import Image
import PyPDF2
from docx import Document

# Setup logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# MongoDB Configuration
MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/')
logger.info(f"Connecting to MongoDB: {MONGO_URI}")

try:
    client = MongoClient(MONGO_URI)
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
    
except Exception as e:
    logger.error(f"❌ MongoDB connection failed: {str(e)}")
    raise

# Gemini AI Configuration
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    logger.info("✅ Gemini AI configured successfully")
else:
    logger.warning("⚠️ GEMINI_API_KEY not found. AI features will be limited.")

# JWT Configuration
JWT_SECRET = os.getenv('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'

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
            current_user = users_collection.find_one({'_id': ObjectId(data['user_id'])})
            
            if not current_user:
                return jsonify({'message': 'User not found!'}), 401
                
            current_user['_id'] = str(current_user['_id'])
            if 'password' in current_user:
                del current_user['password']
                
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token!'}), 401
            
        return f(current_user, *args, **kwargs)
    
    return decorated

# Gemini AI Helper Functions
def generate_questions_with_gemini(subject, topics, difficulty, question_types, total_marks):
    """Generate questions using Gemini AI"""
    try:
        if not GEMINI_API_KEY:
            return None, "Gemini API key not configured"
        
        model = genai.GenerativeModel('gemini-pro')
        
        prompt = f"""
        Generate a question paper for {subject} with the following specifications:
        
        Subject: {subject}
        Topics: {topics}
        Difficulty Level: {difficulty}
        Question Types Required: {', '.join(question_types)}
        Total Marks: {total_marks}
        
        Please generate a comprehensive question paper with:
        1. Clear instructions
        2. Questions distributed by marks
        3. Questions covering different topics
        4. Variety as per question types
        
        Format the output with section headers and mark allocations.
        """
        
        response = model.generate_content(prompt)
        return response.text, None
        
    except Exception as e:
        logger.error(f"Gemini AI error: {str(e)}")
        return None, str(e)

def validate_answer_with_gemini(question, answer, max_marks):
    """Validate answers using Gemini AI"""
    try:
        if not GEMINI_API_KEY:
            return None, None, "Gemini API key not configured"
        
        model = genai.GenerativeModel('gemini-pro')
        
        prompt = f"""
        As an expert examiner, evaluate the following answer:
        
        Question: {question}
        Student's Answer: {answer}
        Maximum Marks: {max_marks}
        
        Please provide:
        1. Marks awarded (out of {max_marks})
        2. Brief feedback on the answer
        3. Key points that should have been included
        4. Suggestions for improvement
        
        Format the response clearly.
        """
        
        response = model.generate_content(prompt)
        return response.text, None
        
    except Exception as e:
        logger.error(f"Gemini AI validation error: {str(e)}")
        return None, str(e)

def extract_text_from_file(file_content, file_type):
    """Extract text from uploaded files for processing"""
    try:
        if file_type == 'application/pdf':
            # Extract text from PDF
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
            text = ""
            for page in pdf_reader.pages:
                text += page.extract_text()
            return text
            
        elif file_type == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
            # Extract text from DOCX
            doc = Document(io.BytesIO(file_content))
            text = "\n".join([para.text for para in doc.paragraphs])
            return text
            
        elif file_type in ['image/jpeg', 'image/png', 'image/jpg']:
            # Extract text from image using Gemini Vision
            if not GEMINI_API_KEY:
                return "Image processing requires Gemini API key"
            
            model = genai.GenerativeModel('gemini-pro-vision')
            image = Image.open(io.BytesIO(file_content))
            
            prompt = "Extract all text from this image. If it's handwritten, transcribe it as accurately as possible."
            response = model.generate_content([prompt, image])
            return response.text
            
        else:
            return "Unsupported file format"
            
    except Exception as e:
        logger.error(f"File extraction error: {str(e)}")
        return f"Error extracting text: {str(e)}"


# Email helper
def send_password_reset_email(to_email, reset_link):
    SMTP_HOST = os.getenv('SMTP_HOST')
    SMTP_PORT = int(os.getenv('SMTP_PORT', '587'))
    SMTP_USER = os.getenv('SMTP_USER')
    SMTP_PASS = os.getenv('SMTP_PASS')
    SMTP_FROM = os.getenv('SMTP_FROM', SMTP_USER)

    if not SMTP_HOST or not SMTP_USER or not SMTP_PASS:
        logger.warning('SMTP not configured; skipping sending reset email. Reset link: %s', reset_link)
        return False, 'SMTP not configured; link logged on server'

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

# Routes
@app.route('/')
def home():
    return jsonify({'message': 'Question Generator API with Gemini AI is running!'})

# Generate Question Paper with AI
@app.route('/api/generate-paper', methods=['POST'])
@token_required
def generate_paper(current_user):
    try:
        data = request.get_json()
        
        required_fields = ['title', 'subject', 'topics', 'difficulty', 'question_types', 'total_marks']
        for field in required_fields:
            if field not in data:
                return jsonify({'message': f'{field} is required'}), 400
        
        # Generate questions using Gemini AI
        ai_content, error = generate_questions_with_gemini(
            data['subject'],
            data['topics'],
            data['difficulty'],
            data['question_types'],
            data['total_marks']
        )
        
        if error:
            # Fallback to template if AI fails
            ai_content = f"""
            Question Paper: {data['title']}
            Subject: {data['subject']}
            Topics: {data['topics']}
            Difficulty: {data['difficulty']}
            Total Marks: {data['total_marks']}
            
            Section A: Multiple Choice Questions (20 marks)
            1. Sample MCQ question? [1 mark]
            
            Section B: Short Answer Questions (30 marks)
            2. Explain briefly... [5 marks]
            
            Section C: Long Answer Questions (50 marks)
            3. Discuss in detail... [10 marks]
            """
        
        # Save to database
        paper_data = {
            'user_id': current_user['_id'],
            'title': data['title'],
            'subject': data['subject'],
            'topics': data['topics'],
            'difficulty': data['difficulty'],
            'question_types': data['question_types'],
            'total_marks': data['total_marks'],
            'ai_generated': bool(GEMINI_API_KEY),
            'content': ai_content,
            'created_at': datetime.datetime.utcnow(),
            'additional_info': data.get('additional_info', {})
        }
        
        result = papers_collection.insert_one(paper_data)
        
        return jsonify({
            'message': 'Question paper generated successfully',
            'paper_id': str(result.inserted_id),
            'content': ai_content,
            'ai_used': bool(GEMINI_API_KEY)
        }), 201
        
    except Exception as e:
        logger.error(f"Generate paper error: {str(e)}")
        return jsonify({'message': 'Server error occurred'}), 500

# Validate Answer Sheets with AI
@app.route('/api/validate-answers', methods=['POST'])
@token_required
def validate_answers(current_user):
    try:
        # Check if files are uploaded
        if 'files' not in request.files:
            return jsonify({'message': 'No files uploaded'}), 400
        
        files = request.files.getlist('files')
        data = request.form
        
        if len(files) == 0:
            return jsonify({'message': 'No files selected'}), 400
        
        results = []
        
        for i, file in enumerate(files):
            if file.filename == '':
                continue
            
            # Read file content
            file_content = file.read()
            file_type = file.content_type
            
            # Extract text from file
            extracted_text = extract_text_from_file(file_content, file_type)
            
            # Process with Gemini AI
            if GEMINI_API_KEY:
                model = genai.GenerativeModel('gemini-pro')
                
                prompt = f"""
                You are an expert examiner. Evaluate this answer sheet:
                
                {extracted_text}
                
                Provide:
                1. Total marks (out of 100)
                2. Grade (A, B, C, D, F)
                3. Key strengths
                4. Areas for improvement
                5. Overall feedback
                
                Format as JSON with keys: marks, grade, strengths, improvements, feedback
                """
                
                try:
                    response = model.generate_content(prompt)
                    ai_feedback = response.text
                except Exception as ai_error:
                    ai_feedback = f"AI evaluation failed: {str(ai_error)}"
            else:
                ai_feedback = "Gemini AI not configured for evaluation"
            
            result = {
                'filename': file.filename,
                'student_id': f'Student_{i+1}',
                'extracted_text': extracted_text[:500] + "..." if len(extracted_text) > 500 else extracted_text,
                'ai_feedback': ai_feedback,
                'file_type': file_type
            }
            
            results.append(result)
        
        # Save validation results to database
        validation_data = {
            'user_id': current_user['_id'],
            'paper_title': data.get('paper_title', 'Untitled'),
            'student_count': len(files),
            'results': results,
            'created_at': datetime.datetime.utcnow(),
            'ai_used': bool(GEMINI_API_KEY)
        }
        
        result = validations_collection.insert_one(validation_data)
        
        return jsonify({
            'message': 'Answer sheets validated successfully',
            'validation_id': str(result.inserted_id),
            'results': results,
            'ai_used': bool(GEMINI_API_KEY)
        }), 200
        
    except Exception as e:
        logger.error(f"Validate answers error: {str(e)}")
        return jsonify({'message': 'Server error occurred'}), 500

# Get AI-generated sample questions
@app.route('/api/ai-sample-questions', methods=['POST'])
@token_required
def get_ai_sample_questions(current_user):
    try:
        data = request.get_json()
        
        subject = data.get('subject', 'General')
        topic = data.get('topic', 'Introduction')
        count = data.get('count', 5)
        
        if not GEMINI_API_KEY:
            return jsonify({
                'message': 'Gemini AI not configured',
                'questions': [
                    f"Sample question {i+1} about {topic} in {subject}"
                    for i in range(count)
                ]
            }), 200
        
        model = genai.GenerativeModel('gemini-pro')
        
        prompt = f"""
        Generate {count} sample questions for {subject} on the topic of {topic}.
        
        Include:
        - Different question types (MCQ, short answer, essay)
        - Varying difficulty levels
        - Clear mark allocations
        - Expected answers
        
        Format each question clearly.
        """
        
        response = model.generate_content(prompt)
        
        return jsonify({
            'message': 'Sample questions generated successfully',
            'questions': response.text.split('\n'),
            'ai_generated': True
        }), 200
        
    except Exception as e:
        logger.error(f"Sample questions error: {str(e)}")
        return jsonify({'message': 'Server error occurred'}), 500

# Check AI Status
@app.route('/api/ai-status', methods=['GET'])
def ai_status():
    return jsonify({
        'gemini_configured': bool(GEMINI_API_KEY),
        'ai_features': {
            'question_generation': bool(GEMINI_API_KEY),
            'answer_validation': bool(GEMINI_API_KEY),
            'text_extraction': bool(GEMINI_API_KEY),
            'image_processing': bool(GEMINI_API_KEY)
        }
    }), 200

# ... [Keep all existing user/auth routes from previous app.py] ...

# User Registration
@app.route('/api/register', methods=['POST'])
def register():
    # Placeholder for registration logic; keep previous implementation here.
    # If you have an existing registration flow, paste it here. For now, do nothing.
    pass

# User Login
@app.route('/api/login', methods=['POST'])
def login():
    # Placeholder for login logic; keep previous implementation here.
    # If you have an existing login flow, paste it here. For now, do nothing.
    pass

# Forgot Password
@app.route('/api/forgot-password', methods=['POST'])
def forgot_password():
        try:
                data = request.get_json()
                email = data.get('email', '').strip().lower()
                if not email:
                        return jsonify({'success': False, 'message': 'Email is required.'}), 400

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
                users_collection.update_one({'_id': user['_id']}, {'$set': {
                        'password_reset_token': reset_token,
                        'password_reset_expires': reset_payload['exp'].isoformat()
                }})

                # Build the reset link using the backend host URL
                reset_link = f"{request.host_url.rstrip('/')}/reset-password?token={reset_token}"

                # Send password reset email
                sent, err = send_password_reset_email(user['email'], reset_link)
                if not sent:
                        # Still return a 200 with generic message but note we couldn't send
                        logger.warning('Forgot password: could not send email: %s', err)
                        return jsonify({'success': True, 'message': 'If an account exists with this email, you will receive a password reset link shortly.'}), 200

                logger.info('Password reset requested and email sent to %s', user['email'])
                return jsonify({'success': True, 'message': 'If an account exists with this email, you will receive a password reset link shortly.'}), 200

        except Exception as e:
                logger.error('Forgot password error: %s', str(e))
                return jsonify({'success': False, 'message': 'Internal server error'}), 500


# Reset password form (simple HTML page served by the backend)
@app.route('/reset-password', methods=['GET'])
def reset_password_page():
        token = request.args.get('token', '')
        # Return a minimal HTML page containing a form that posts token + new password to /api/reset-password
        html = """
        <!doctype html>
        <html>
        <head>
            <meta charset='utf-8' />
            <meta name='viewport' content='width=device-width, initial-scale=1.0' />
            <title>Reset Password</title>
            <style>body{{font-family: Arial, Helvetica, sans-serif; background: #f5f7fa; padding: 2rem;}} .container{{max-width:420px;margin:0 auto;background:#fff;padding:1.5rem;border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,0.08);}}</style>
        </head>
        <body>
            <div class='container'>
                <h2>Reset Your Password</h2>
                <p>Enter your new password below.</p>
                <form id='resetForm'>
                    <div style='margin-bottom:0.75rem;'>
                        <label>New Password</label><br/>
                        <input id='newPassword' type='password' style='width:100%;padding:0.5rem;margin-top:0.25rem;border:1px solid #ddd;border-radius:4px;' required />
                    </div>
                    <div style='margin-bottom:0.75rem;'>
                        <label>Confirm Password</label><br/>
                        <input id='confirmPassword' type='password' style='width:100%;padding:0.5rem;margin-top:0.25rem;border:1px solid #ddd;border-radius:4px;' required />
                    </div>
                    <input type='hidden' id='resetToken' value='__RESET_TOKEN__' />
                    <button type='submit' style='padding:0.6rem 1rem;background:#0366d6;color:#fff;border:none;border-radius:6px;cursor:pointer;'>Reset Password</button>
                </form>
                <div id='status' style='margin-top:0.75rem; color:#666; font-size:0.9rem;'></div>
            </div>
            <script>
                document.getElementById('resetForm').addEventListener('submit', async function(e){
                    e.preventDefault();
                    const newPassword = document.getElementById('newPassword').value;
                    const confirmPassword = document.getElementById('confirmPassword').value;
                    const token = document.getElementById('resetToken').value;
                    const statusEl = document.getElementById('status');
                    if(!newPassword){ statusEl.textContent = 'Enter a new password.'; return; }
                    if(newPassword !== confirmPassword){ statusEl.textContent = 'Passwords do not match.'; return; }
                    try{
                        const resp = await fetch('/api/reset-password', {
                            method: 'POST',
                            headers:{ 'Content-Type':'application/json' },
                            body: JSON.stringify({ token, new_password: newPassword })
                        });
                        const data = await resp.json();
                        if(resp.ok && data.success){
                            statusEl.style.color = 'green';
                            statusEl.textContent = data.message || 'Password reset successfully. You may now login.';
                        } else {
                            statusEl.style.color = 'red';
                            statusEl.textContent = data.message || 'Failed to reset password.';
                        }
                    }catch(err){ statusEl.style.color = 'red'; statusEl.textContent = 'An error occurred.'; }
                });
            </script>
        </body>
        </html>
        """
        # Replace placeholder with actual token (avoid f-string brace escaping issues)
        html = html.replace('__RESET_TOKEN__', token)
        return html


# API to perform password reset
@app.route('/api/reset-password', methods=['POST'])
def api_reset_password():
        try:
                data = request.get_json()
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

                user = users_collection.find_one({'_id': ObjectId(user_id)})
                if not user:
                        return jsonify({'success': False, 'message': 'User not found.'}), 400

                # Validate token matches stored token and hasn't expired
                stored_token = user.get('password_reset_token')
                expires_iso = user.get('password_reset_expires')
                if not stored_token or stored_token != token:
                        return jsonify({'success': False, 'message': 'Token mismatch or invalid.'}), 400
                if expires_iso:
                        expires_dt = datetime.datetime.fromisoformat(expires_iso)
                        if datetime.datetime.utcnow() > expires_dt:
                                return jsonify({'success': False, 'message': 'Reset token has expired.'}), 400

                # Update password
                hashed = generate_password_hash(new_password)
                users_collection.update_one({'_id': ObjectId(user_id)}, {'$set': {'password': hashed}, '$unset': {'password_reset_token': '', 'password_reset_expires': ''}})

                return jsonify({'success': True, 'message': 'Password has been reset successfully.'}), 200

        except Exception as e:
                logger.error('Reset password error: %s', str(e))
                return jsonify({'success': False, 'message': 'Internal server error'}), 500

# Get User Profile
@app.route('/api/profile', methods=['GET'])
@token_required
def get_profile(current_user):
    # Placeholder for user profile retrieval. Replace with existing implementation.
    return jsonify({'success': True, 'user': current_user}), 200

# Check Authentication Status
@app.route('/api/check-auth', methods=['GET'])
def check_auth():
    # Placeholder for check auth
    return jsonify({'authenticated': False}), 200

# Database Status
@app.route('/api/db-status', methods=['GET'])
def db_status():
    # Placeholder for database status
    try:
        db_stats = client.server_info()
        return jsonify({'db_connected': True, 'version': db_stats.get('version')}), 200
    except Exception:
        return jsonify({'db_connected': False}), 500

# Health Check
@app.route('/api/health', methods=['GET'])
def health_check():
    # Basic health check endpoint
    return jsonify({'status': 'ok', 'server': 'running'}), 200

if __name__ == '__main__':
    # Create indexes
    try:
        users_collection.create_index('email', unique=True)
        papers_collection.create_index('user_id')
        validations_collection.create_index('user_id')
        logger.info("✅ Database indexes created")
    except Exception as e:
        logger.error(f"Index creation error: {str(e)}")
    
    logger.info("🚀 Starting Flask server with Gemini AI on http://localhost:5000")
    logger.info(f"🤖 Gemini AI Status: {'Enabled' if GEMINI_API_KEY else 'Disabled'}")
    app.run(debug=True, port=5000, host='0.0.0.0')
