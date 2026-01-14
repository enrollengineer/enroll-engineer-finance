// auth.js - Complete Authentication System

class AuthManager {
    constructor() {
        // Using Firebase directly instead of API server
        this.currentUser = null;
        this.statusCheckInterval = null;
        this.init();
    }

    init() {
        // Check for existing user session
        this.checkAuthStatus();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Set up periodic status checks
        this.startStatusCheck();
    }

    setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Signup form
        const signupForm = document.getElementById('signupForm');
        if (signupForm) {
            signupForm.addEventListener('submit', (e) => this.handleSignup(e));
        }

        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }

        // Form switching
        const switchToLoginBtn = document.getElementById('switchToLoginBtn');
        const switchToSignupBtn = document.getElementById('switchToSignupBtn');
        
        if (switchToLoginBtn) {
            switchToLoginBtn.addEventListener('click', () => this.showLoginForm());
        }
        
        if (switchToSignupBtn) {
            switchToSignupBtn.addEventListener('click', () => this.showSignupForm());
        }
    }

    async checkAuthStatus() {
        // Wait for Firebase to be loaded
        if (!window.firebaseAuth) {
            setTimeout(() => this.checkAuthStatus(), 1000);
            return;
        }

        window.onAuthStateChanged(window.firebaseAuth, async (user) => {
            if (user) {
                // User is signed in, check their status in Firestore
                try {
                    const userQuery = window.firestoreQuery(
                        window.firestoreCollection(window.firestoreDb, 'users'),
                        window.firestoreWhere('email', '==', user.email)
                    );
                    const userDocs = await window.firestoreGetDocs(userQuery);
                    
                    if (!userDocs.empty) {
                        const userData = userDocs.docs[0].data();
                        this.currentUser = { ...userData, uid: user.uid, id: userDocs.docs[0].id };
                        
                        if (this.currentUser.status === 'approved') {
                            this.showAppContent();
                        } else if (this.currentUser.status === 'pending') {
                            this.showPendingMessage();
                        } else {
                            this.showAuthModal();
                        }
                    } else {
                        // User exists in auth but not in Firestore
                        this.showAuthModal();
                    }
                } catch (error) {
                    console.error('Error checking user status:', error);
                    this.showAuthModal();
                }
            } else {
                // User is signed out
                this.currentUser = null;
                this.showAuthModal();
            }
        });
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value.trim();
        
        console.log('🔐 Login attempt for email:', email);
        
        if (!email || !password) {
            this.showError('Please fill in all fields');
            return;
        }

        try {
            this.showLoading(true);
            
            console.log('🚀 Attempting Firebase authentication...');
            // Sign in with Firebase Authentication
            const userCredential = await window.signInWithEmailAndPassword(window.firebaseAuth, email, password);
            const user = userCredential.user;
            
            // Check user status in Firestore
            const userQuery = window.firestoreQuery(
                window.firestoreCollection(window.firestoreDb, 'users'),
                window.firestoreWhere('email', '==', email)
            );
            const userDocs = await window.firestoreGetDocs(userQuery);
            
            if (!userDocs.empty) {
                const userData = userDocs.docs[0].data();
                this.currentUser = { ...userData, uid: user.uid, id: userDocs.docs[0].id };
                
                if (this.currentUser.status === 'approved') {
                    this.showSuccess('Login successful!');
                    // Auth state change will handle showing app content
                } else if (this.currentUser.status === 'pending') {
                    this.showSuccess('Login successful! Your account is pending approval.');
                    // Auth state change will handle showing pending message
                } else {
                    this.showError('Your account has been rejected. Please contact an administrator.');
                    await window.signOut(window.firebaseAuth);
                }
            } else {
                this.showError('User account not found in system.');
                await window.signOut(window.firebaseAuth);
            }
        } catch (error) {
            console.error('Login error:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            
            let errorMessage = 'Login failed: ';
            
            if (error.code === 'auth/invalid-login-credentials') {
                errorMessage = 'Invalid email or password. Please check your credentials and try again.';
            } else if (error.code === 'auth/user-not-found') {
                errorMessage = 'No account found with this email address. Please sign up first.';
            } else if (error.code === 'auth/wrong-password') {
                errorMessage = 'Incorrect password. Please try again.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Please enter a valid email address.';
            } else if (error.code === 'auth/user-disabled') {
                errorMessage = 'This account has been disabled. Please contact support.';
            } else {
                errorMessage += error.message || 'Please try again.';
            }
            
            this.showError(errorMessage);
        } finally {
            this.showLoading(false);
        }
    }

    async handleSignup(e) {
        e.preventDefault();
        
        const name = document.getElementById('signupName').value.trim();
        const email = document.getElementById('signupEmail').value.trim();
        const password = document.getElementById('signupPassword').value.trim();

        if (!name || !email || !password) {
            this.showError('Please fill in all fields');
            return;
        }

        try {
            this.showLoading(true);
            
            // Create user with Firebase Authentication
            const userCredential = await window.createUserWithEmailAndPassword(window.firebaseAuth, email, password);
            const user = userCredential.user;
            
            // Create user document in Firestore
            await window.firestoreAddDoc(window.firestoreCollection(window.firestoreDb, 'users'), {
                uid: user.uid,
                name: name,
                email: email,
                role: 'User',
                status: 'pending',
                createdAt: new Date()
            });
            
            this.showSuccess('Account created successfully! Your account is pending admin approval.');
            this.showLoginForm();
            document.getElementById('signupForm').reset();
            
        } catch (error) {
            console.error('Signup error:', error);
            let errorMessage = 'Signup failed: ';
            
            if (error.code === 'auth/email-already-in-use') {
                errorMessage += 'An account with this email already exists.';
            } else if (error.code === 'auth/weak-password') {
                errorMessage += 'Password should be at least 6 characters.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage += 'Please enter a valid email address.';
            } else {
                errorMessage += error.message || 'Please try again.';
            }
            
            this.showError(errorMessage);
        } finally {
            this.showLoading(false);
        }
    }

    async logout() {
        try {
            await window.signOut(window.firebaseAuth);
            this.showSuccess('Logged out successfully');
        } catch (error) {
            console.error('Logout error:', error);
            this.showError('Error logging out');
        }
        
        this.currentUser = null;
        this.stopStatusCheck();
        // Auth state change will handle showing auth modal
    }

    startStatusCheck() {
        // Check status every 10 seconds for pending users
        this.statusCheckInterval = setInterval(() => {
            if (this.currentUser && this.currentUser.status === 'pending') {
                this.checkAuthStatus();
            }
        }, 10000);
    }

    stopStatusCheck() {
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
            this.statusCheckInterval = null;
        }
    }

    showAuthModal() {
        const authModal = document.getElementById('authModal');
        const appContent = document.querySelector('body > *:not(#authModal)');
        
        if (authModal) {
            authModal.classList.remove('hidden');
        }
        
        // Hide app content except auth modal
        document.querySelectorAll('nav, section, footer').forEach(el => {
            el.style.display = 'none';
        });
    }

    showAppContent() {
        const authModal = document.getElementById('authModal');
        
        if (authModal) {
            authModal.classList.add('hidden');
        }
        
        // Show app content
        document.querySelectorAll('nav, section, footer').forEach(el => {
            el.style.display = '';
        });

        // Update user display
        this.updateUserDisplay();
        
        // Initialize app if needed
        if (typeof initApp === 'function') {
            initApp();
        }
    }

    showPendingMessage() {
        const authModal = document.getElementById('authModal');
        
        if (authModal) {
            authModal.classList.add('hidden');
        }
        
        // Hide app content
        document.querySelectorAll('nav, section, footer').forEach(el => {
            el.style.display = 'none';
        });

        // Show pending message
        this.showPendingOverlay();
    }

    showPendingOverlay() {
        // Remove existing pending overlay
        const existingOverlay = document.getElementById('pendingOverlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }

        // Create pending overlay
        const overlay = document.createElement('div');
        overlay.id = 'pendingOverlay';
        overlay.className = 'fixed inset-0 bg-gradient-to-r from-purple-600 to-indigo-700 flex items-center justify-center z-50';
        
        overlay.innerHTML = `
            <div class="bg-white rounded-2xl shadow-lg w-full max-w-md p-8 text-center">
                <div class="mb-6">
                    <div class="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fas fa-clock text-yellow-600 text-2xl"></i>
                    </div>
                    <h2 class="text-2xl font-bold text-gray-900 mb-2">Access Request Pending</h2>
                    <p class="text-gray-600">Your access request is being reviewed by an administrator. You will be automatically logged in once approved.</p>
                </div>
                
                <div class="space-y-4">
                    <div class="flex justify-center">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                    </div>
                    <p class="text-sm text-gray-500">Checking status...</p>
                </div>
                
                <div class="mt-6 pt-6 border-t">
                    <button onclick="authManager.logout()" class="text-purple-600 hover:text-purple-800 font-medium">
                        <i class="fas fa-sign-out-alt mr-2"></i>Logout
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
    }

    updateUserDisplay() {
        if (this.currentUser) {
            const userInitial = document.querySelector('.w-8.h-8.bg-gradient-to-r');
            if (userInitial) {
                userInitial.textContent = this.currentUser.email.charAt(0).toUpperCase();
            }

            // Add logout functionality if not exists
            const userAvatar = document.querySelector('.w-8.h-8.bg-gradient-to-r');
            if (userAvatar && !userAvatar.hasAttribute('data-dropdown-setup')) {
                userAvatar.setAttribute('data-dropdown-setup', 'true');
                userAvatar.style.cursor = 'pointer';
                userAvatar.addEventListener('click', () => {
                    // Toggle user dropdown
                    this.toggleUserDropdown();
                });
            }
        }
    }

    toggleUserDropdown() {
        const existingDropdown = document.getElementById('userDropdown');
        
        if (existingDropdown) {
            existingDropdown.remove();
            return;
        }

        const dropdown = document.createElement('div');
        dropdown.id = 'userDropdown';
        dropdown.className = 'absolute right-0 top-12 bg-white rounded-lg shadow-lg border py-2 z-50';
        dropdown.style.minWidth = '200px';
        
        dropdown.innerHTML = `
            <div class="px-4 py-2 border-b">
                <div class="font-semibold text-gray-900">${this.currentUser.email}</div>
                <div class="text-xs text-gray-400">${this.currentUser.role}</div>
            </div>
            <button onclick="authManager.logout()" class="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50">
                <i class="fas fa-sign-out-alt mr-2"></i>Logout
            </button>
        `;

        // Position dropdown relative to user avatar
        const userAvatar = document.querySelector('.w-8.h-8.bg-gradient-to-r');
        if (userAvatar) {
            const rect = userAvatar.getBoundingClientRect();
            dropdown.style.position = 'fixed';
            dropdown.style.top = (rect.bottom + 5) + 'px';
            dropdown.style.right = (window.innerWidth - rect.right) + 'px';
        }

        document.body.appendChild(dropdown);

        // Close dropdown when clicking outside
        setTimeout(() => {
            document.addEventListener('click', function closeDropdown(e) {
                if (!dropdown.contains(e.target)) {
                    dropdown.remove();
                    document.removeEventListener('click', closeDropdown);
                }
            });
        }, 100);
    }

    showLoginForm() {
        document.getElementById('login-container').classList.remove('hidden');
        document.getElementById('signup-container').classList.add('hidden');
    }

    showSignupForm() {
        document.getElementById('login-container').classList.add('hidden');
        document.getElementById('signup-container').classList.remove('hidden');
    }

    showLoading(show) {
        const loginBtn = document.querySelector('#loginForm button[type="submit"]');
        const signupBtn = document.querySelector('#signupForm button[type="submit"]');
        
        if (show) {
            if (loginBtn) {
                loginBtn.disabled = true;
                loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Logging in...';
            }
            if (signupBtn) {
                signupBtn.disabled = true;
                signupBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Creating Account...';
            }
        } else {
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.innerHTML = 'Login';
            }
            if (signupBtn) {
                signupBtn.disabled = false;
                signupBtn.innerHTML = 'Sign Up';
            }
        }
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showNotification(message, type = 'success') {
        // Remove existing notifications
        document.querySelectorAll('.auth-notification').forEach(el => el.remove());

        const notification = document.createElement('div');
        notification.className = `auth-notification fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 max-w-sm ${
            type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`;
        
        notification.innerHTML = `
            <div class="flex items-center">
                <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} mr-2"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    // Admin functions (only for admin users)
    async loadUsers() {
        if (!this.currentUser || this.currentUser.role !== 'Admin') {
            return [];
        }

        try {
            const querySnapshot = await window.firestoreGetDocs(window.firestoreCollection(window.firestoreDb, 'users'));
            const users = [];
            querySnapshot.forEach((doc) => {
                users.push({ id: doc.id, ...doc.data() });
            });
            return users;
        } catch (error) {
            console.error('Error loading users:', error);
            return [];
        }
    }

    async approveUser(userId) {
        try {
            await window.firestoreUpdateDoc(
                window.firestoreDoc(window.firestoreDb, 'users', userId),
                { status: 'approved' }
            );
            this.showSuccess('User approved successfully');
            return true;
        } catch (error) {
            console.error('Error approving user:', error);
            this.showError('Failed to approve user');
            return false;
        }
    }

    async rejectUser(userId) {
        try {
            await window.firestoreUpdateDoc(
                window.firestoreDoc(window.firestoreDb, 'users', userId),
                { status: 'rejected' }
            );
            this.showSuccess('User rejected successfully');
            return true;
        } catch (error) {
            console.error('Error rejecting user:', error);
            this.showError('Failed to reject user');
            return false;
        }
    }

    // Check if current user has admin access
    isAdmin() {
        return this.currentUser && this.currentUser.role === 'Admin';
    }

    // Check if current user is approved
    isApproved() {
        return this.currentUser && this.currentUser.status === 'approved';
    }
}

// Initialize authentication manager
const authManager = new AuthManager();

// Export for global access
window.authManager = authManager;
