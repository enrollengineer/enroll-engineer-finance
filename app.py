from flask import Flask, jsonify, request, session, render_template, send_from_directory
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, firestore
import os
from dotenv import load_dotenv
import hashlib
import secrets
from datetime import datetime, timedelta
from functools import wraps

# Load environment variables
load_dotenv()

# Initialize Flask app (standard structure)
app = Flask(
    __name__,
    static_folder='static',
    static_url_path='/static',
    template_folder='templates'
)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key-here-change-in-production')
# Use Flask's built-in session (signed cookies) - works on Vercel serverless
app.config['SESSION_COOKIE_SECURE'] = False  # Set to True in production with HTTPS
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=24)

# Configure CORS with proper settings
CORS(app, 
     supports_credentials=True,
     origins=["http://localhost:5000", "http://127.0.0.1:5000"],
     allow_headers=["Content-Type", "Authorization"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

# Initialize Firebase safely (don't crash import-time if credentials are missing)
firebase_initialized = False
db = None
try:
    cred = None
    if os.getenv('FIREBASE_CREDENTIALS_JSON'):
        import json
        cred_dict = json.loads(os.environ['FIREBASE_CREDENTIALS_JSON'])
        cred = credentials.Certificate(cred_dict)
    elif os.getenv('GOOGLE_APPLICATION_CREDENTIALS'):
        cred = credentials.Certificate(os.environ['GOOGLE_APPLICATION_CREDENTIALS'])
    else:
        # Fallback to file path (ensure this file is gitignored)
        cred_path = os.getenv('FIREBASE_CREDENTIALS_FILE', 'firebase-service-account.json')
        try:
            cred = credentials.Certificate(cred_path)
        except Exception:
            cred = None

    if cred:
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        firebase_initialized = True
        print("✅ Firebase initialized")
    else:
        print("⚠️ Firebase credentials not provided or file missing; running without Firebase (limited functionality)")

except Exception as e:
    print(f"❌ Firebase init failed: {e}")
    db = None
    firebase_initialized = False

# Helper response when DB not configured

def require_db_response():
    return jsonify({'error': 'Backend not configured: missing Firebase credentials'}), 503

# Backward-compatible routes for moved static assets
# Allow existing HTML references like /admin.js, /auth.js, /script.js and /assets/*
@app.route('/admin.js')
def serve_admin_js():
    return send_from_directory('static/js', 'admin.js')

@app.route('/auth.js')
def serve_auth_js():
    return send_from_directory('static/js', 'auth.js')

@app.route('/script.js')
def serve_script_js():
    return send_from_directory('static/js', 'script.js')

@app.route('/assets/<path:filename>')
def serve_legacy_assets(filename):
    return send_from_directory('static/assets', filename)

# Serve HTML file (templates)
@app.route('/')
def serve_index():
    return render_template('index.html')

# Admin approval UI (render approve-user.html)
@app.route('/admin/approve-user')
@admin_required
def serve_approve_user():
    return render_template('approve-user.html')

# Admin setup page route (render admin_setup.html)
@app.route('/admin_setup')
@admin_required
def serve_admin_setup():
    return render_template('admin_setup.html')

# Authentication Decorators
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        print(f"DEBUG: login_required check - session: {dict(session)}")  # Debug line
        if 'user_id' not in session:
            print(f"DEBUG: No user_id in session, returning 401")  # Debug line
            return jsonify({'error': 'Authentication required'}), 401
        print(f"DEBUG: User authenticated: {session['user_id']}")  # Debug line
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not firebase_initialized:
            return jsonify({'error': 'Backend not configured: missing Firebase credentials'}), 503
        print(f"DEBUG: admin_required check - session: {dict(session)}")  # Debug line
        if 'user_id' not in session:
            print(f"DEBUG: No user_id in session for admin check, returning 401")  # Debug line
            return jsonify({'error': 'Authentication required'}), 401
        
        user_ref = db.collection('users').document(session['user_id'])
        user_doc = user_ref.get()
        
        if not user_doc.exists or user_doc.to_dict().get('role') != 'Admin':
            print(f"DEBUG: User is not admin, returning 403")  # Debug line
            return jsonify({'error': 'Admin access required'}), 403
        
        print(f"DEBUG: Admin access granted for: {session['user_id']}")  # Debug line
        return f(*args, **kwargs)
    return decorated_function

def approved_user_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not firebase_initialized:
            return jsonify({'error': 'Backend not configured: missing Firebase credentials'}), 503
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        
        user_ref = db.collection('users').document(session['user_id'])
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            session.clear()
            return jsonify({'error': 'User not found'}), 404
        
        user_data = user_doc.to_dict()
        if user_data.get('status') != 'approved':
            return jsonify({'error': 'Account not approved', 'status': user_data.get('status')}), 403
        
        return f(*args, **kwargs)
    return decorated_function

# Utility Functions
def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password, hashed):
    return hashlib.sha256(password.encode()).hexdigest() == hashed

# Initialize admin user if it doesn't exist (env-driven)
# Set ADMIN_EMAIL and ADMIN_PASSWORD in environment to enable creation
# Optionally gate with INIT_ADMIN_ON_START=true

def init_admin_user():
    should_init = os.getenv('INIT_ADMIN_ON_START', 'true').lower() in ['1', 'true', 'yes']
    admin_email = os.getenv('ADMIN_EMAIL')
    admin_password = os.getenv('ADMIN_PASSWORD')

    if not should_init or not admin_email or not admin_password:
        print("ℹ️ Skipping admin auto-creation (set INIT_ADMIN_ON_START=true and ADMIN_EMAIL/ADMIN_PASSWORD to enable).")
        return

    if not firebase_initialized:
        print("⚠️ Skipping admin auto-creation because Firebase is not initialized.")
        return
    
    try:
        users_ref = db.collection('users')
        existing_admin = list(users_ref.where('email', '==', admin_email).stream())
        
        if not existing_admin:
            admin_data = {
                'email': admin_email,
                'password': hash_password(admin_password),
                'status': 'approved',
                'role': 'Admin',
                'createdAt': datetime.now(),
                'lastLogin': None
            }
            
            users_ref.add(admin_data)
            print(f"✅ Admin user created: {admin_email}")
        else:
            print(f"✅ Admin user already exists: {admin_email}")
    except Exception as e:
        print(f"❌ Error initializing admin user: {str(e)}")

# Authentication Routes
@app.route('/api/auth/signup', methods=['POST'])
def signup():
    try:
        if not firebase_initialized:
            return require_db_response()

        data = request.get_json()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '').strip()
        
        # Validate input
        if not all([email, password]):
            return jsonify({'error': 'Email and password are required'}), 400
        
        # Check if user already exists
        users_ref = db.collection('users')
        existing_users = users_ref.where('email', '==', email).stream()
        
        if any(existing_users):
            return jsonify({'error': 'User with this email already exists'}), 409
        
        # Create new user
        user_data = {
            'email': email,
            'password': hash_password(password),
            'status': 'pending',
            'role': 'User',
            'createdAt': datetime.now(),
            'lastLogin': None
        }
        
        doc_ref = users_ref.add(user_data)
        user_id = doc_ref[1].id
        
        return jsonify({
            'message': 'User created successfully. Pending admin approval.',
            'user_id': user_id,
            'status': 'pending'
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        if not firebase_initialized:
            return require_db_response()

        data = request.get_json()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '').strip()
        
        if not all([email, password]):
            return jsonify({'error': 'Email and password are required'}), 400
        
        # Find user
        users_ref = db.collection('users')
        user_docs = list(users_ref.where('email', '==', email).stream())
        
        if not user_docs:
            return jsonify({'error': 'Invalid email or password'}), 401
        
        user_doc = user_docs[0]
        user_data = user_doc.to_dict()
        user_id = user_doc.id
        
        # Verify password
        if not verify_password(password, user_data['password']):
            return jsonify({'error': 'Invalid email or password'}), 401
        
        # Update last login
        users_ref.document(user_id).update({'lastLogin': datetime.now()})
        
        # Create session
        session['user_id'] = user_id
        session['user_email'] = email
        session['user_role'] = user_data.get('role', 'User')
        session['user_status'] = user_data.get('status', 'pending')
        
        print(f"DEBUG: Login successful for {email}, session created with ID: {user_id}")  # Debug line
        print(f"DEBUG: Session data after login: {dict(session)}")  # Debug line
        
        return jsonify({
            'message': 'Login successful',
            'user': {
                'id': user_id,
                'name': user_data.get('name'),
                'email': email,
                'role': user_data.get('role'),
                'status': user_data.get('status')
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out successfully'}), 200

@app.route('/api/auth/me', methods=['GET'])
@login_required
def get_current_user():
    try:
        if not firebase_initialized:
            return require_db_response()

        print(f"DEBUG: Session data: {dict(session)}")  # Debug line
        user_ref = db.collection('users').document(session['user_id'])
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            session.clear()
            return jsonify({'error': 'User not found'}), 404
        
        user_data = user_doc.to_dict()
        return jsonify({
            'user': {
                'id': session['user_id'],
                'name': user_data.get('name'),
                'email': user_data.get('email'),
                'role': user_data.get('role'),
                'status': user_data.get('status')
            }
        }), 200
        
    except Exception as e:
        print(f"DEBUG: Error in get_current_user: {str(e)}")  # Debug line
        return jsonify({'error': str(e)}), 500

# Debug endpoint to check session
@app.route('/api/auth/debug-session', methods=['GET'])
def debug_session():
    return jsonify({
        'session_data': dict(session),
        'has_user_id': 'user_id' in session,
        'session_id': request.cookies.get('session')
    }), 200

# Admin Routes
@app.route('/api/admin/users', methods=['GET'])
@admin_required
def get_all_users():
    try:
        users_ref = db.collection('users')
        users = []
        
        for doc in users_ref.stream():
            user_data = doc.to_dict()
            users.append({
                'id': doc.id,
                'name': user_data.get('name'),
                'email': user_data.get('email'),
                'role': user_data.get('role'),
                'status': user_data.get('status'),
                'createdAt': user_data.get('createdAt'),
                'lastLogin': user_data.get('lastLogin')
            })
        
        return jsonify({'users': users}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users/<user_id>/approve', methods=['PUT'])
@admin_required
def approve_user(user_id):
    try:
        user_ref = db.collection('users').document(user_id)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            return jsonify({'error': 'User not found'}), 404
        
        user_ref.update({'status': 'approved'})
        
        return jsonify({'message': 'User approved successfully'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users/<user_id>/reject', methods=['PUT'])
@admin_required
def reject_user(user_id):
    try:
        user_ref = db.collection('users').document(user_id)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            return jsonify({'error': 'User not found'}), 404
        
        user_ref.update({'status': 'rejected'})
        
        return jsonify({'message': 'User rejected successfully'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users/<user_id>/role', methods=['PUT'])
@admin_required
def update_user_role(user_id):
    try:
        data = request.get_json()
        new_role = data.get('role')
        
        if new_role not in ['Admin', 'Manager', 'User']:
            return jsonify({'error': 'Invalid role'}), 400
        
        user_ref = db.collection('users').document(user_id)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            return jsonify({'error': 'User not found'}), 404
        
        user_ref.update({'role': new_role})
        
        return jsonify({'message': f'User role updated to {new_role}'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users/<user_id>', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    try:
        user_ref = db.collection('users').document(user_id)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            return jsonify({'error': 'User not found'}), 404
        
        user_ref.delete()
        
        return jsonify({'message': 'User deleted successfully'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# API Routes (Protected)
@app.route('/api/invoices', methods=['GET'])
@approved_user_required
def get_invoices():
    try:
        invoices_ref = db.collection('invoices')
        docs = invoices_ref.stream()
        invoices = []
        for doc in docs:
            invoice_data = doc.to_dict()
            invoice_data['id'] = doc.id
            invoices.append(invoice_data)
        return jsonify(invoices)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/invoices', methods=['POST'])
@approved_user_required
def create_invoice():
    try:
        data = request.get_json()
        # Add validation as needed
        doc_ref = db.collection('invoices').document()
        doc_ref.set(data)
        return jsonify({'id': doc_ref.id, 'message': 'Invoice created successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/invoices/<invoice_id>', methods=['PUT'])
@approved_user_required
def update_invoice(invoice_id):
    try:
        data = request.get_json()
        doc_ref = db.collection('invoices').document(invoice_id)
        doc_ref.update(data)
        return jsonify({'message': 'Invoice updated successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/invoices/<invoice_id>', methods=['DELETE'])
@approved_user_required
def delete_invoice(invoice_id):
    try:
        db.collection('invoices').document(invoice_id).delete()
        return jsonify({'message': 'Invoice deleted successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/transactions', methods=['GET'])
@approved_user_required
def get_transactions():
    try:
        transactions_ref = db.collection('transactions')
        docs = transactions_ref.stream()
        transactions = []
        for doc in docs:
            transaction_data = doc.to_dict()
            transaction_data['id'] = doc.id
            transactions.append(transaction_data)
        return jsonify(transactions)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/transactions', methods=['POST'])
@approved_user_required
def create_transaction():
    try:
        data = request.get_json()
        doc_ref = db.collection('transactions').document()
        doc_ref.set(data)
        return jsonify({'id': doc_ref.id, 'message': 'Transaction created successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("🚀 Starting FinanceFlow Pro...")
    print("📊 Initializing admin user...")
    init_admin_user()
    print("🌐 Starting Flask server on http://localhost:5000")
    app.run(debug=True, port=5000)
