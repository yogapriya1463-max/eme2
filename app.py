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
    db = client['question_generator']  # Changed database name
    users_collection = db['login']
    
    # Test connection
    client.admin.command('ping')
    logger.info("✅ MongoDB connected successfully")
    
    # Count existing users
    user_count = users_collection.count_documents({})
    logger.info(f"📊 Total users in database: {user_count}")
    
except Exception as e:
    logger.error(f"❌ MongoDB connection failed: {str(e)}")
    raise

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
        
        # Check for token in Authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
        
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        
        try:
            # Decode the token
            data = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            current_user = users_collection.find_one({'_id': ObjectId(data['user_id'])})
            
            if not current_user:
                return jsonify({'message': 'User not found!'}), 401
                
            # Remove password from user object
            current_user['_id'] = str(current_user['_id'])
            if 'password' in current_user:
                del current_user['password']
                
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token!'}), 401
            
        return f(current_user, *args, **kwargs)
    
    return decorated

# Routes
@app.route('/')
def home():
    return jsonify({'message': 'Question Generator API is running!'})

# User Registration
@app.route('/api/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        logger.info(f"📝 Registration attempt for email: {data.get('email')}")
        
        # Validate required fields
        required_fields = ['name', 'email', 'password', 'confirmPassword']
        for field in required_fields:
            if field not in data or not data[field].strip():
                logger.warning(f"Missing field: {field}")
                return jsonify({
                    'message': f'{field.replace("_", " ").title()} is required',
                    'field': field
                }), 400
        
        # Check if passwords match
        if data['password'] != data['confirmPassword']:
            logger.warning("Passwords don't match")
            return jsonify({
                'message': 'Passwords do not match',
                'field': 'confirmPassword'
            }), 400
        
        # Check password strength
        if len(data['password']) < 6:
            logger.warning("Password too short")
            return jsonify({
                'message': 'Password must be at least 6 characters long',
                'field': 'password'
            }), 400
        
        # Check if user already exists
        existing_user = users_collection.find_one({'email': data['email'].lower()})
        if existing_user:
            logger.warning(f"Email already exists: {data['email']}")
            return jsonify({
                'message': 'Email already registered',
                'field': 'email'
            }), 400
        
        # Create new user
        user_data = {
            'name': data['name'].strip(),
            'email': data['email'].lower().strip(),
            'password': generate_password_hash(data['password']),
            'created_at': datetime.datetime.utcnow(),
            'last_login': datetime.datetime.utcnow(),
            'role': 'user',
            'is_active': True,
            'preferences': {}
        }
        
        logger.info(f"Creating user: {user_data['email']}")
        
        # Insert user into database
        result = users_collection.insert_one(user_data)
        logger.info(f"✅ User created with ID: {result.inserted_id}")
        
        # Generate JWT token
        token = generate_token(result.inserted_id, user_data['email'])
        
        # Prepare user response
        user_response = {
            '_id': str(result.inserted_id),
            'name': user_data['name'],
            'email': user_data['email'],
            'role': user_data['role'],
            'created_at': user_data['created_at'].isoformat()
        }
        
        # Log success
        logger.info(f"🎉 Registration successful for: {user_data['email']}")
        
        return jsonify({
            'message': 'Registration successful',
            'user': user_response,
            'token': token
        }), 201
        
    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        return jsonify({'message': 'Server error occurred'}), 500

# User Login
@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        email = data.get('email', '').lower()
        logger.info(f"🔐 Login attempt for email: {email}")
        
        # Validate required fields
        if not email or not data.get('password'):
            logger.warning("Missing email or password")
            return jsonify({'message': 'Email and password are required'}), 400
        
        # Find user by email
        user = users_collection.find_one({'email': email})
        
        if not user:
            logger.warning(f"User not found: {email}")
            return jsonify({'message': 'Invalid email or password'}), 401
        
        # Check if user is active
        if not user.get('is_active', True):
            logger.warning(f"Account disabled: {email}")
            return jsonify({'message': 'Account is disabled'}), 401
        
        # Verify password
        if not check_password_hash(user['password'], data['password']):
            logger.warning(f"Invalid password for: {email}")
            return jsonify({'message': 'Invalid email or password'}), 401
        
        # Update last login
        users_collection.update_one(
            {'_id': user['_id']},
            {'$set': {'last_login': datetime.datetime.utcnow()}}
        )
        
        # Generate JWT token
        token = generate_token(user['_id'], user['email'])
        
        # Prepare user response
        user_response = {
            '_id': str(user['_id']),
            'name': user['name'],
            'email': user['email'],
            'role': user.get('role', 'user'),
            'created_at': user['created_at'].isoformat() if 'created_at' in user else None
        }
        
        logger.info(f"✅ Login successful for: {email}")
        
        return jsonify({
            'message': 'Login successful',
            'user': user_response,
            'token': token
        }), 200
        
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return jsonify({'message': 'Server error occurred'}), 500

# Forgot Password
@app.route('/api/forgot-password', methods=['POST'])
def forgot_password():
    try:
        data = request.get_json()
        
        if not data.get('email'):
            return jsonify({'message': 'Email is required'}), 400
        
        # Check if user exists
        user = users_collection.find_one({'email': data['email'].lower()})
        
        # Always return success message for security (don't reveal if user exists)
        # In production, you would send an email with reset link here
        
        return jsonify({
            'message': 'If an account exists with this email, you will receive a password reset link shortly.'
        }), 200
        
    except Exception as e:
        logger.error(f"Forgot password error: {str(e)}")
        return jsonify({'message': 'Server error occurred'}), 500

# Get User Profile (Protected Route)
@app.route('/api/profile', methods=['GET'])
@token_required
def get_profile(current_user):
    return jsonify({'user': current_user}), 200

# Check Authentication Status
@app.route('/api/check-auth', methods=['GET'])
def check_auth():
    token = None
    
    # Check for token in Authorization header
    if 'Authorization' in request.headers:
        auth_header = request.headers['Authorization']
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
    
    if not token:
        return jsonify({'authenticated': False}), 200
    
    try:
        # Decode the token
        data = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = users_collection.find_one({'_id': ObjectId(data['user_id'])})
        
        if user:
            user_response = {
                '_id': str(user['_id']),
                'name': user['name'],
                'email': user['email'],
                'role': user.get('role', 'user')
            }
            return jsonify({
                'authenticated': True,
                'user': user_response
            }), 200
        else:
            return jsonify({'authenticated': False}), 200
            
    except jwt.ExpiredSignatureError:
        return jsonify({'authenticated': False}), 200
    except jwt.InvalidTokenError:
        return jsonify({'authenticated': False}), 200
    except Exception as e:
        return jsonify({'authenticated': False}), 200

# Database Status
@app.route('/api/db-status', methods=['GET'])
def db_status():
    try:
        # Check MongoDB connection
        client.admin.command('ping')
        
        # Get user count
        user_count = users_collection.count_documents({})
        
        # Get sample users (without passwords)
        sample_users = list(users_collection.find(
            {}, 
            {'password': 0}
        ).limit(5))
        
        # Convert ObjectId to string
        for user in sample_users:
            user['_id'] = str(user['_id'])
        
        return jsonify({
            'status': 'connected',
            'database': 'question_generator',
            'collection': 'login',
            'user_count': user_count,
            'sample_users': sample_users,
            'message': 'MongoDB is connected and working'
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'disconnected',
            'error': str(e),
            'message': 'MongoDB connection failed'
        }), 500

# Health Check
@app.route('/api/health', methods=['GET'])
def health_check():
    try:
        # Check MongoDB connection
        client.admin.command('ping')
        return jsonify({
            'status': 'healthy',
            'database': 'connected',
            'server': 'running'
        }), 200
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'database': 'disconnected',
            'error': str(e)
        }), 500

if __name__ == '__main__':
    # Create indexes
    try:
        users_collection.create_index('email', unique=True)
        logger.info("✅ Email index created")
    except Exception as e:
        logger.error(f"Index creation error: {str(e)}")
    
    logger.info("🚀 Starting Flask server on http://localhost:5000")
    app.run(debug=True, port=5000, host='0.0.0.0')
