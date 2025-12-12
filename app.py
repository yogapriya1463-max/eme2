[file content begin]
# backend/app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from bson.objectid import ObjectId
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
import datetime
from functools import wraps
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
    # ... [Keep existing register code] ...

# User Login
@app.route('/api/login', methods=['POST'])
def login():
    # ... [Keep existing login code] ...

# Forgot Password
@app.route('/api/forgot-password', methods=['POST'])
def forgot_password():
    # ... [Keep existing forgot password code] ...

# Get User Profile
@app.route('/api/profile', methods=['GET'])
@token_required
def get_profile(current_user):
    # ... [Keep existing profile code] ...

# Check Authentication Status
@app.route('/api/check-auth', methods=['GET'])
def check_auth():
    # ... [Keep existing check auth code] ...

# Database Status
@app.route('/api/db-status', methods=['GET'])
def db_status():
    # ... [Keep existing db status code] ...

# Health Check
@app.route('/api/health', methods=['GET'])
def health_check():
    # ... [Keep existing health check code] ...

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
[file content end]