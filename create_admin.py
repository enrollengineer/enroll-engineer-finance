#!/usr/bin/env python3
"""
Script to create the first admin user for the FinanceFlow Pro application.
Run this script once to create an admin account that can approve other users.
"""

import sys
import hashlib
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, firestore

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def create_admin_user():
    try:
        # Initialize Firebase (if not already initialized)
        try:
            firebase_admin.get_app()
            print("Firebase already initialized")
        except ValueError:
            cred = credentials.Certificate("firebase-service-account.json")
            firebase_admin.initialize_app(cred)
            print("Firebase initialized")
        
        db = firestore.client()
        
        # Get admin details from user
        print("=== Create Admin User ===")
        name = input("Enter admin name: ").strip()
        email = input("Enter admin email: ").strip().lower()
        password = input("Enter admin password: ").strip()
        
        if not all([name, email, password]):
            print("❌ All fields are required!")
            return False
        
        # Check if user already exists
        users_ref = db.collection('users')
        existing_users = list(users_ref.where('email', '==', email).stream())
        
        if existing_users:
            print(f"❌ User with email {email} already exists!")
            
            # Ask if they want to make this user an admin
            make_admin = input("Do you want to make this user an admin? (y/n): ").lower()
            if make_admin == 'y':
                existing_user = existing_users[0]
                users_ref.document(existing_user.id).update({
                    'role': 'Admin',
                    'status': 'approved'
                })
                print(f"✅ User {email} has been made an admin!")
                return True
            else:
                return False
        
        # Create admin user
        admin_data = {
            'name': name,
            'email': email,
            'password': hash_password(password),
            'status': 'approved',  # Admin is automatically approved
            'role': 'Admin',
            'createdAt': datetime.now(),
            'lastLogin': None
        }
        
        doc_ref = users_ref.add(admin_data)
        admin_id = doc_ref[1].id
        
        print(f"✅ Admin user created successfully!")
        print(f"   ID: {admin_id}")
        print(f"   Name: {name}")
        print(f"   Email: {email}")
        print(f"   Role: Admin")
        print(f"   Status: Approved")
        print(f"\n🎉 You can now log in with these credentials!")
        
        return True
        
    except Exception as e:
        print(f"❌ Error creating admin user: {str(e)}")
        return False

def list_existing_users():
    """List existing users to see current state"""
    try:
        db = firestore.client()
        users_ref = db.collection('users')
        users = list(users_ref.stream())
        
        if not users:
            print("📝 No users found in the database.")
            return
        
        print("\n=== Existing Users ===")
        for user_doc in users:
            user_data = user_doc.to_dict()
            print(f"ID: {user_doc.id}")
            print(f"  Name: {user_data.get('name', 'N/A')}")
            print(f"  Email: {user_data.get('email', 'N/A')}")
            print(f"  Role: {user_data.get('role', 'N/A')}")
            print(f"  Status: {user_data.get('status', 'N/A')}")
            print("-" * 40)
            
    except Exception as e:
        print(f"❌ Error listing users: {str(e)}")

def main():
    print("🔧 FinanceFlow Pro Admin Setup")
    print("=" * 50)
    
    # Check if Firebase credentials exist
    try:
        with open("firebase-service-account.json", 'r') as f:
            pass
    except FileNotFoundError:
        print("❌ firebase-service-account.json not found!")
        print("Please ensure your Firebase service account key is in the current directory.")
        sys.exit(1)
    
    while True:
        print("\nWhat would you like to do?")
        print("1. Create new admin user")
        print("2. List existing users")
        print("3. Exit")
        
        choice = input("Enter your choice (1-3): ").strip()
        
        if choice == '1':
            create_admin_user()
        elif choice == '2':
            list_existing_users()
        elif choice == '3':
            print("👋 Goodbye!")
            break
        else:
            print("❌ Invalid choice. Please enter 1, 2, or 3.")

if __name__ == '__main__':
    main()
