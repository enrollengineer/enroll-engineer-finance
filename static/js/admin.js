// admin.js - Admin User Management Functions

// Global function to refresh user list (called by HTML button)
async function refreshUserList() {
    if (!window.authManager || !window.authManager.isAdmin()) {
        console.log('User is not admin, cannot refresh user list');
        return;
    }

    await loadAndDisplayUsers();
}

// Global function to approve user (called by HTML buttons)
async function approveUser(userId) {
    if (!window.authManager || !window.authManager.isAdmin()) {
        return;
    }

    if (confirm('Are you sure you want to approve this user?')) {
        const success = await window.authManager.approveUser(userId);
        if (success) {
            await loadAndDisplayUsers(); // Refresh the list
        }
    }
}

// Global function to reject user (called by HTML buttons)
async function rejectUser(userId) {
    if (!window.authManager || !window.authManager.isAdmin()) {
        return;
    }

    if (confirm('Are you sure you want to reject this user? They will not be able to access the system.')) {
        const success = await window.authManager.rejectUser(userId);
        if (success) {
            await loadAndDisplayUsers(); // Refresh the list
        }
    }
}

// Main function to load and display users
async function loadAndDisplayUsers() {
    const userList = document.getElementById('userList');
    if (!userList) return;

    // Show loading state
    userList.innerHTML = `
        <div class="text-center py-8 text-gray-500">
            <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
            <p>Loading users...</p>
        </div>
    `;

    try {
        const users = await window.authManager.loadUsers();
        
        if (users.length === 0) {
            userList.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-users text-2xl mb-2"></i>
                    <p>No users found</p>
                </div>
            `;
            return;
        }

        // Count users by status
        const pendingCount = users.filter(u => u.status === 'pending').length;
        const approvedCount = users.filter(u => u.status === 'approved').length;
        const rejectedCount = users.filter(u => u.status === 'rejected').length;

        // Update counts
        document.getElementById('pendingCount').textContent = pendingCount;
        document.getElementById('approvedCount').textContent = approvedCount;
        document.getElementById('rejectedCount').textContent = rejectedCount;

        // Sort users: pending first, then approved, then rejected
        const sortedUsers = users.sort((a, b) => {
            const statusOrder = { 'pending': 0, 'approved': 1, 'rejected': 2 };
            if (statusOrder[a.status] !== statusOrder[b.status]) {
                return statusOrder[a.status] - statusOrder[b.status];
            }
            // If same status, sort by creation date (newest first)
            return new Date(b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt) - 
                   new Date(a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.createdAt);
        });

        // Render users
        userList.innerHTML = sortedUsers.map(user => createUserCard(user)).join('');

    } catch (error) {
        console.error('Error loading users:', error);
        userList.innerHTML = `
            <div class="text-center py-8 text-red-500">
                <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                <p>Error loading users. Please try again.</p>
                <button onclick="refreshUserList()" class="mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">
                    Retry
                </button>
            </div>
        `;
    }
}

function createUserCard(user) {
    const createdDate = user.createdAt ? 
        (user.createdAt.seconds ? new Date(user.createdAt.seconds * 1000) : new Date(user.createdAt)) : 
        new Date();
    
    const lastLoginDate = user.lastLogin ? 
        (user.lastLogin.seconds ? new Date(user.lastLogin.seconds * 1000) : new Date(user.lastLogin)) : 
        null;

    const statusColors = {
        'pending': 'bg-yellow-100 text-yellow-800 border-yellow-200',
        'approved': 'bg-green-100 text-green-800 border-green-200',
        'rejected': 'bg-red-100 text-red-800 border-red-200'
    };

    const statusIcons = {
        'pending': 'fa-clock',
        'approved': 'fa-check-circle',
        'rejected': 'fa-times-circle'
    };

    return `
        <div class="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
            <div class="flex items-start justify-between">
                <div class="flex items-start space-x-3">
                    <div class="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                        ${user.email.charAt(0).toUpperCase()}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center space-x-2 mb-1">
                            <h4 class="font-semibold text-gray-900 truncate">${user.email}</h4>
                            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[user.status]}">
                                <i class="fas ${statusIcons[user.status]} mr-1"></i>
                                ${user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                            </span>
                        </div>
                        <div class="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                            <div class="flex items-center">
                                <i class="fas fa-user-tag mr-1"></i>
                                <span>${user.role || 'User'}</span>
                            </div>
                            <div class="flex items-center">
                                <i class="fas fa-calendar-plus mr-1"></i>
                                <span>Joined ${createdDate.toLocaleDateString()}</span>
                            </div>
                            ${lastLoginDate ? `
                                <div class="flex items-center">
                                    <i class="fas fa-sign-in-alt mr-1"></i>
                                    <span>Last login ${lastLoginDate.toLocaleDateString()}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
                <div class="flex items-center space-x-2 ml-4">
                    ${createUserActionButtons(user)}
                </div>
            </div>
        </div>
    `;
}

function createUserActionButtons(user) {
    switch (user.status) {
        case 'pending':
            return `
                <button onclick="approveUser('${user.id}')" 
                        class="px-3 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded transition-colors"
                        title="Approve user">
                    <i class="fas fa-check mr-1"></i>Approve
                </button>
                <button onclick="rejectUser('${user.id}')" 
                        class="px-3 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                        title="Reject user">
                    <i class="fas fa-times mr-1"></i>Reject
                </button>
            `;
        case 'approved':
            return `
                <button onclick="rejectUser('${user.id}')" 
                        class="px-3 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                        title="Revoke access">
                    <i class="fas fa-ban mr-1"></i>Revoke
                </button>
                <button onclick="editUserRole('${user.id}', '${user.role || 'User'}')" 
                        class="px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                        title="Change role">
                    <i class="fas fa-user-cog mr-1"></i>Role
                </button>
            `;
        case 'rejected':
            return `
                <button onclick="approveUser('${user.id}')" 
                        class="px-3 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded transition-colors"
                        title="Re-approve user">
                    <i class="fas fa-check mr-1"></i>Re-approve
                </button>
                <span class="text-xs text-gray-400 px-2">Rejected</span>
            `;
        default:
            return '';
    }
}

// Function to edit user role
async function editUserRole(userId, currentRole) {
    const roles = ['User', 'Manager', 'Admin'];
    const roleSelect = roles.map(role => 
        `<option value="${role}" ${role === currentRole ? 'selected' : ''}>${role}</option>`
    ).join('');

    // Create modal for role selection
    const modalHTML = `
        <div id="roleModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-6 w-full max-w-md">
                <h3 class="text-lg font-semibold mb-4">Change User Role</h3>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Select Role</label>
                    <select id="roleSelect" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        ${roleSelect}
                    </select>
                </div>
                <div class="flex justify-end space-x-3">
                    <button onclick="closeRoleModal()" class="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
                        Cancel
                    </button>
                    <button onclick="updateUserRole('${userId}')" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                        Update Role
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Global function to update user role
async function updateUserRole(userId) {
    const newRole = document.getElementById('roleSelect').value;
    
    try {
        const response = await fetch(`${window.authManager.apiUrl}/admin/users/${userId}/role`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ role: newRole })
        });

        if (response.ok) {
            window.authManager.showSuccess(`User role updated to ${newRole}`);
            closeRoleModal();
            await loadAndDisplayUsers(); // Refresh the list
        } else {
            const data = await response.json();
            window.authManager.showError(data.error || 'Failed to update role');
        }
    } catch (error) {
        console.error('Error updating user role:', error);
        window.authManager.showError('Network error occurred');
    }
}

// Global function to close role modal
function closeRoleModal() {
    const modal = document.getElementById('roleModal');
    if (modal) {
        modal.remove();
    }
}

// Initialize admin functions when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for authManager to initialize
    setTimeout(() => {
        if (window.authManager && window.authManager.isAdmin()) {
            loadAndDisplayUsers();
        }
    }, 1000);
});

// Also load users when the admin section becomes visible
const adminSection = document.getElementById('admin');
if (adminSection) {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && window.authManager && window.authManager.isAdmin()) {
                loadAndDisplayUsers();
            }
        });
    }, { threshold: 0.1 });
    
    observer.observe(adminSection);
}
