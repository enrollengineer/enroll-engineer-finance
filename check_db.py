#!/usr/bin/env python3
"""
Test script to check database state
"""

import os
from app import db, hash_password, init_admin_user

def check_admin_user():
    print("🔍 Checking admin user in database...")
    
    try:
        admin_email = os.getenv('ADMIN_EMAIL')
        if not admin_email:
            print("ℹ️ ADMIN_EMAIL not set; set it to check for an admin user.")
            return False
        
        users_ref = db.collection('users')
        admin_docs = list(users_ref.where('email', '==', admin_email).stream())
        
        if admin_docs:
            admin_data = admin_docs[0].to_dict()
            print("✅ Admin user found:")
            print(f"   Email: {admin_data.get('email')}")
            print(f"   Role: {admin_data.get('role')}")
            print(f"   Status: {admin_data.get('status')}")
            print(f"   Has password: {'password' in admin_data}")
            
            # Test password if provided in env (do not print it)
            admin_password = os.getenv('ADMIN_PASSWORD')
            if admin_password and 'password' in admin_data:
                expected_hash = hash_password(admin_password)
                actual_hash = admin_data.get('password')
                print(f"   Password matches: {actual_hash == expected_hash}")
            
            return True
        else:
            print("❌ Admin user not found in database")
            return False
            
    except Exception as e:
        print(f"❌ Error checking admin user: {str(e)}")
        return False

def check_all_users():
    print("\n👥 All users in database:")
    
    try:
        users_ref = db.collection('users')
        docs = list(users_ref.stream())
        
        if not docs:
            print("   No users found")
            return
        
        for i, doc in enumerate(docs, 1):
            user_data = doc.to_dict()
            print(f"   {i}. ID: {doc.id}")
            print(f"      Email: {user_data.get('email')}")
            print(f"      Role: {user_data.get('role')}")
            print(f"      Status: {user_data.get('status')}")
            print(f"      Created: {user_data.get('createdAt')}")
            print()
            
    except Exception as e:
        print(f"❌ Error checking users: {str(e)}")

def recreate_admin():
    print("🔧 Recreating admin user...")
    try:
        init_admin_user()
        return True
    except Exception as e:
        print(f"❌ Error creating admin: {str(e)}")
        return False

if __name__ == "__main__":
    print("🔧 Database Check Tool")
    print("=" * 50)
    
    # Check if admin exists
    admin_exists = check_admin_user()
    
    # Show all users
    check_all_users()
    
    # Recreate admin if needed
    if not admin_exists:
        print("🔄 Admin user not found, creating...")
        if recreate_admin():
            print("✅ Admin user created successfully")
            check_admin_user()
        else:
            print("❌ Failed to create admin user")
    
    print("\n✅ Check complete!")
