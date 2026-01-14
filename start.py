#!/usr/bin/env python3
"""
Simple startup script for FinanceFlow Pro
This script will check dependencies and start the application
"""

import sys
import os
import subprocess
import importlib.util

def check_dependency(package_name, import_name=None):
    """Check if a Python package is installed"""
    if import_name is None:
        import_name = package_name
    
    spec = importlib.util.find_spec(import_name)
    return spec is not None

def install_dependencies():
    """Install required dependencies"""
    print("📦 Installing required dependencies...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ Dependencies installed successfully!")
        return True
    except subprocess.CalledProcessError:
        print("❌ Failed to install dependencies!")
        return False

def check_firebase_config():
    """Check if Firebase configuration exists (env or file)"""
    if os.getenv("FIREBASE_CREDENTIALS_JSON") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
        return True
    if not os.path.exists("firebase-service-account.json") and not os.getenv('FIREBASE_CREDENTIALS_FILE'):
        print("❌ Firebase credentials not found!")
        print("Provide one of the following:")
        print("  - Set FIREBASE_CREDENTIALS_JSON (JSON string) or GOOGLE_APPLICATION_CREDENTIALS (path)")
        print("  - Or place firebase-service-account.json in the project root")
        print("Get it from: Firebase Console > Project Settings > Service Accounts")
        return False
    return True

def main():
    print("🚀 FinanceFlow Pro Startup")
    print("=" * 50)
    
    # Check Firebase config
    if not check_firebase_config():
        sys.exit(1)
    
    # Check dependencies
    required_packages = [
        ("Flask", "flask"),
        ("Flask-CORS", "flask_cors"),
        ("Flask-Session", "flask_session"),
        ("firebase-admin", "firebase_admin"),
        ("python-dotenv", "dotenv")
    ]
    
    missing_packages = []
    for package, import_name in required_packages:
        if not check_dependency(package, import_name):
            missing_packages.append(package)
    
    if missing_packages:
        print(f"📋 Missing packages: {', '.join(missing_packages)}")
        install = input("Would you like to install them now? (y/n): ").lower()
        if install == 'y':
            if not install_dependencies():
                sys.exit(1)
        else:
            print("Please install dependencies manually: pip install -r requirements.txt")
            sys.exit(1)
    else:
        print("✅ All dependencies are installed!")
    
    print("\n🎯 Starting FinanceFlow Pro...")
    print("ℹ️ To auto-create an admin, set ADMIN_EMAIL and ADMIN_PASSWORD (and optionally INIT_ADMIN_ON_START=true)")
    print("🌐 Application will be available at: http://localhost:5000")
    print("Press Ctrl+C to stop the server\n")
    
    # Start the application
    try:
        from app import app, init_admin_user
        print("📊 Initializing admin user...")
        init_admin_user()
        print("🚀 Starting Flask server...")
        app.run(debug=True, port=5000, host='0.0.0.0')
    except KeyboardInterrupt:
        print("\n👋 Server stopped by user")
    except Exception as e:
        print(f"❌ Error starting application: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
