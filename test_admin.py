#!/usr/bin/env python3
"""
Simple script to test the admin login credentials
"""

import os
import requests
import json

def test_admin_login():
    admin_email = os.getenv("ADMIN_EMAIL")
    admin_password = os.getenv("ADMIN_PASSWORD")
    
    print("🧪 Testing admin login...")
    if not admin_email or not admin_password:
        print("ℹ️ Skipping test: ADMIN_EMAIL/ADMIN_PASSWORD not set in environment")
        return
    print(f"📧 Email: {admin_email}")
    
    try:
        # Test login
        response = requests.post(
            "http://localhost:5000/api/auth/login",
            json={
                "email": admin_email,
                "password": admin_password
            },
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            user = data.get('user', {})
            print("✅ Login successful!")
            print(f"   Role: {user.get('role')}")
            print(f"   Status: {user.get('status')}")
            print(f"   Email: {user.get('email')}")
        else:
            print(f"❌ Login failed: {response.status_code}")
            try:
                error_data = response.json()
                print(f"   Error: {error_data.get('error', 'Unknown error')}")
            except:
                print(f"   Response: {response.text}")
    
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to server. Make sure Flask app is running on http://localhost:5000")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

def test_user_signup():
    test_email = "test@example.com"
    test_password = "testpassword"
    
    print(f"\n🧪 Testing user signup...")
    print(f"📧 Email: {test_email}")
    print(f"🔑 Password: {test_password}")
    
    try:
        response = requests.post(
            "http://localhost:5000/api/auth/signup",
            json={
                "email": test_email,
                "password": test_password
            },
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 201:
            data = response.json()
            print("✅ Signup successful!")
            print(f"   Status: {data.get('status')}")
            print(f"   Message: {data.get('message')}")
        else:
            print(f"❌ Signup failed: {response.status_code}")
            try:
                error_data = response.json()
                print(f"   Error: {error_data.get('error', 'Unknown error')}")
            except:
                print(f"   Response: {response.text}")
    
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to server. Make sure Flask app is running on http://localhost:5000")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    print("🔧 FinanceFlow Pro - Admin Credentials Test")
    print("=" * 50)
    
    test_admin_login()
    test_user_signup()
    
    print("\n📝 Note: If the server is not running, start it with: python app.py")
    print("🔒 Tip: Set ADMIN_EMAIL and ADMIN_PASSWORD as environment variables for testing.")
