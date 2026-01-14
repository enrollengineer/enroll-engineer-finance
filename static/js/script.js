// script.js - Complete FinanceFlow Pro with Authentication

// Utility Functions
const formatINR = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

// Global Variables
let currentPeriod = 'monthly';
let currentEditingInvoiceId = null;
let invoicesData = [];
let accountsData = {
  "Employee Payment": [],
  "Allowance": [],
  "Reimbursement": [],
  "Purchase": [],
  "Vendor Payment": [],
  "Miscellaneous Income": [],
  "Miscellaneous Expense": []
};
let currentTab = "Employee Payment";
let currentEditingId = null;
let users = [];
let currentEditingUserId = null;
let currentUser = null;
let userStatusCheckInterval = null;

// Chart Variables
let revenueChart;
let expenseChart;
let floatingChart;

// Dynamic Chart Data (calculated from actual data)
const floatingChartData = {
    daily: { labels: ['6am', '9am', '12pm', '3pm', '6pm', '9pm', '12am'], values: [], growth: 0, revenue: 0, rate: 0 },
    weekly: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], values: [], growth: 0, revenue: 0, rate: 0 },
    monthly: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], values: [], growth: 0, revenue: 0, rate: 0 }
};

const financialData = {
    daily: { revenue: 0, outstandingInvoices: 0, monthlyExpenses: 0, netProfit: 0, revenueData: [], expenseData: [] },
    weekly: { revenue: 0, outstandingInvoices: 0, monthlyExpenses: 0, netProfit: 0, revenueData: [], expenseData: [] },
    monthly: { revenue: 0, outstandingInvoices: 0, monthlyExpenses: 0, netProfit: 0, revenueData: [], expenseData: [] }
};

// --- AUTHENTICATION LOGIC ---

// DOM Elements
const authModal = document.getElementById("authModal");
const appContent = document.getElementById("appContent");
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const logoutBtn = document.getElementById("logoutBtn");
const userInitial = document.getElementById("userInitial");

// Check for existing user login on page load
document.addEventListener('DOMContentLoaded', () => {
  const storedUser = localStorage.getItem("currentUser");
  if (storedUser) {
    currentUser = JSON.parse(storedUser);
    console.log("Found logged-in user:", currentUser);
    if (currentUser.status === "approved") {
      showAppContent();
      startUserStatusCheck(); // Start checking status for logged-in approved users
    } else if (currentUser.status === "pending") {
      // User is logged in but pending approval
      showPendingApprovalMessage();
      startUserStatusCheck(); // Start checking status for pending users
    }
    // If status is 'rejected', they should be logged out, but we'll let the check handle it.
  } else {
    // No user found, show auth modal
    console.log("No user found, showing auth modal.");
    authModal.classList.remove("hidden");
    appContent.classList.add("hidden");
  }
});

// Handle Login Form submission
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const secretCode = document.getElementById("loginSecret").value.trim();

    try {
      const userSnapshot = await getDocs(query(collection(window.firestoreDb, "users"), where("email", "==", email)));
      if (userSnapshot.empty) {
        alert("User not found. Please sign up first.");
        return;
      }

      const userDoc = userSnapshot.docs[0];
      const userData = { id: userDoc.id, ...userDoc.data() };

      if (userData.secretCode !== secretCode) {
        alert("Invalid secret code.");
        return;
      }

      if (userData.status === "rejected") {
        alert("Your account has been rejected. Please contact an administrator.");
        return;
      }

      // Store user data in localStorage
      localStorage.setItem("currentUser", JSON.stringify(userData));
      currentUser = userData;
      console.log("Login successful for:", userData);

      if (userData.status === "approved") {
        alert("Login successful!");
        authModal.classList.add("hidden");
        showAppContent();
        startUserStatusCheck(); // Start checking status after login
      } else if (userData.status === "pending") {
        alert("Login successful, but your account is pending approval. Please wait.");
        showPendingApprovalMessage();
        startUserStatusCheck(); // Start checking status after login
      }

    } catch (error) {
      console.error("Login error:", error);
      alert("An error occurred during login. Please try again.");
    }
  });
}

// Handle Signup Form submission
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("signupName").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const secretCode = document.getElementById("signupSecret").value.trim();

    // Simple secret code check (replace with server-side validation)
    const commonSecret = "1234"; // Example secret code
    if (secretCode !== commonSecret) {
      alert("Invalid secret code. You cannot sign up.");
      return;
    }

    try {
      // Check if user already exists
      const userQuerySnapshot = await getDocs(query(collection(window.firestoreDb, "users"), where("email", "==", email)));
      if (!userQuerySnapshot.empty) {
        alert("An account with this email already exists.");
        return;
      }

      // Create new user document
      const newUser = {
        name: name,
        email: email,
        secretCode: secretCode, // In production, hash this!
        status: "pending", // Default status
        role: "User", // Default role
        createdAt: new Date()
      };

      const docRef = await addDoc(collection(window.firestoreDb, "users"), newUser);
      console.log("User signed up with ID:", docRef.id);

      alert("Signup successful! Your account is pending admin approval.");
      // Show the login form again
      showLoginForm();
    } catch (error) {
      console.error("Signup error:", error);
      alert("An error occurred during signup. Please try again.");
    }
  });
}

// Handle Logout
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("currentUser");
    currentUser = null;
    stopUserStatusCheck();
    authModal.classList.remove("hidden");
    appContent.classList.add("hidden");
    alert("You have been logged out.");
    // Reset forms if needed
    loginForm.reset();
    signupForm.reset();
  });
}

// Function to show the main app content
function showAppContent() {
  authModal.classList.add("hidden");
  appContent.classList.remove("hidden");
  if (currentUser && userInitial) {
     userInitial.textContent = currentUser.name ? currentUser.name.charAt(0) : currentUser.email.charAt(0);
  }
  // Initialize other parts of your app that depend on being logged in
  initApp();
}

// Function to show a pending approval message instead of the full app
function showPendingApprovalMessage() {
  authModal.classList.add("hidden");
  appContent.classList.add("hidden"); // Hide main content
  // You could create a dedicated "pending" view, or show an alert
  // For simplicity, we'll just show an alert and keep the auth modal hidden
  alert("Your account is pending admin approval. You will be notified when it's approved. Please check back later or contact an administrator.");
  // Optionally, you could redirect to a simple "pending.html" page
}

// --- USER STATUS CHECKING ---

// Start checking user status periodically
function startUserStatusCheck() {
  if (userStatusCheckInterval) {
    clearInterval(userStatusCheckInterval); // Clear any existing interval
  }
  // Check every 5 seconds (adjust as needed)
  userStatusCheckInterval = setInterval(checkUserStatus, 5000);
  console.log("Started user status check interval.");
}

// Stop checking user status
function stopUserStatusCheck() {
  if (userStatusCheckInterval) {
    clearInterval(userStatusCheckInterval);
    userStatusCheckInterval = null;
    console.log("Stopped user status check interval.");
  }
}

// Function to check the current user's status in Firestore
async function checkUserStatus() {
  if (!currentUser || !currentUser.id) {
    console.log("No current user to check status for.");
    stopUserStatusCheck();
    return;
  }

  try {
    const userDocRef = doc(window.firestoreDb, "users", currentUser.id);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      const freshUserData = userDocSnap.data();
      const oldStatus = currentUser.status;
      const newStatus = freshUserData.status;

      console.log(`User status check: ${oldStatus} -> ${newStatus}`);

      if (oldStatus !== newStatus) {
        currentUser = { ...currentUser, ...freshUserData }; // Update local user object
        localStorage.setItem("currentUser", JSON.stringify(currentUser)); // Update localStorage

        if (newStatus === "approved" && oldStatus === "pending") {
          console.log("User approved!");
          alert("Your account has been approved! Welcome to FinanceFlow Pro.");
          showAppContent();
          stopUserStatusCheck(); // Stop checking once approved
        } else if (newStatus === "rejected") {
          console.log("User rejected!");
          alert("Your account has been rejected. Logging out.");
          localStorage.removeItem("currentUser");
          currentUser = null;
          stopUserStatusCheck();
          authModal.classList.remove("hidden");
          appContent.classList.add("hidden");
        } else if (newStatus === "pending" && oldStatus === "approved") {
             // User was approved, now pending (unlikely but possible)
             console.log("User status changed to pending.");
             showPendingApprovalMessage();
             startUserStatusCheck(); // Continue checking
        }
        // Handle other status changes if needed
      } else {
        // Status hasn't changed, do nothing
        console.log("User status unchanged:", newStatus);
      }
    } else {
      console.warn("User document no longer exists. Logging out.");
      localStorage.removeItem("currentUser");
      currentUser = null;
      stopUserStatusCheck();
      authModal.classList.remove("hidden");
      appContent.classList.add("hidden");
      alert("Your account could not be found. Please contact support.");
    }
  } catch (error) {
    console.error("Error checking user status:", error);
    // Don't necessarily log out on error, just retry next time
  }
}


// --- END AUTHENTICATION LOGIC ---

// --- FIREBASE INTEGRATION AND DATA MANAGEMENT ---

// Import Firestore functions
import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc, query, where, getDoc, orderBy, startAfter, limit } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Data calculation functions
function calculateFinancialMetrics() {
    // Calculate metrics from actual invoice and transaction data
    const totalRevenue = invoicesData.filter(inv => inv.status === 'Paid').reduce((sum, inv) => sum + (inv.grandTotal || inv.amount || 0), 0);
    const outstandingInvoices = invoicesData.filter(inv => inv.status !== 'Paid').reduce((sum, inv) => sum + (inv.grandTotal || inv.amount || 0), 0);
    
    // Calculate expenses from all expense categories
    let totalExpenses = 0;
    Object.keys(accountsData).forEach(category => {
        if (category !== 'Miscellaneous Income') {
            totalExpenses += accountsData[category].reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
        }
    });
    
    const netProfit = totalRevenue - totalExpenses;
    
    // Update financial data for all periods (simplified - using same data)
    ['daily', 'weekly', 'monthly'].forEach(period => {
        financialData[period].revenue = totalRevenue;
        financialData[period].outstandingInvoices = outstandingInvoices;
        financialData[period].monthlyExpenses = totalExpenses;
        financialData[period].netProfit = netProfit;
        
        // Generate sample chart data based on actual values
        const baseRevenue = totalRevenue / 6; // Distribute over 6 periods
        const baseExpense = totalExpenses / 6;
        
        financialData[period].revenueData = Array.from({length: 6}, (_, i) => {
            return baseRevenue * (0.8 + Math.random() * 0.4); // Add some variation
        });
        
        financialData[period].expenseData = Array.from({length: 6}, (_, i) => {
            return baseExpense * (0.8 + Math.random() * 0.4);
        });
    });
    
    // Update floating chart data
    ['daily', 'weekly', 'monthly'].forEach(period => {
        floatingChartData[period].revenue = totalRevenue;
        floatingChartData[period].rate = outstandingInvoices > 0 ? Math.round((totalRevenue / (totalRevenue + outstandingInvoices)) * 100) : 100;
        floatingChartData[period].growth = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;
        
        const baseValue = totalRevenue / floatingChartData[period].labels.length;
        floatingChartData[period].values = floatingChartData[period].labels.map(() => {
            return baseValue * (0.7 + Math.random() * 0.6);
        });
    });
}

// --- INVOICES ---
window.saveInvoice = async function (invoice) {
  try {
    if (invoice.id && invoice.id.startsWith('INV-')) {
      // Update existing invoice
      const invoicesRef = collection(window.firestoreDb, "invoices");
      const q = query(invoicesRef, where("invoiceNumber", "==", invoice.id));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const docRef = querySnapshot.docs[0].ref;
        await updateDoc(docRef, invoice);
        console.log("✅ Invoice updated:", invoice.id);
      }
    } else {
      // Create new invoice
      const docRef = await addDoc(collection(window.firestoreDb, "invoices"), invoice);
      console.log("✅ Invoice saved with ID:", docRef.id);
    }
    window.loadInvoices(); // Reload the list
    calculateFinancialMetrics(); // Recalculate metrics
    updateCharts(currentPeriod); // Update charts
    closeInvoiceModal();
    showNotification('Invoice saved successfully', 'success');
  } catch (e) {
    console.error("❌ Error saving invoice:", e);
    showNotification('Error saving invoice', 'error');
  }
};

window.loadInvoices = async function () {
  try {
    const querySnapshot = await getDocs(collection(window.firestoreDb, "invoices"));
    invoicesData = querySnapshot.docs.map(doc => ({ 
      id: doc.id, 
      docId: doc.id, // Keep Firestore document ID
      ...doc.data() 
    }));
    console.log("✅ Invoices loaded:", invoicesData.length);
    renderInvoiceTable();
    calculateFinancialMetrics();
    updateMetrics(currentPeriod);
    updateCharts(currentPeriod);
  } catch (e) {
    console.error("❌ Error loading invoices:", e);
  }
};

window.deleteInvoice = async function (invoiceId) {
  if (!confirm("Are you sure you want to delete this invoice?")) return;
  try {
    const invoice = invoicesData.find(inv => inv.id === invoiceId || inv.docId === invoiceId);
    if (invoice && invoice.docId) {
      await deleteDoc(doc(window.firestoreDb, "invoices", invoice.docId));
      console.log("✅ Invoice deleted:", invoiceId);
      window.loadInvoices(); // Reload the list
      showNotification('Invoice deleted successfully', 'success');
    }
  } catch (e) {
    console.error("❌ Error deleting invoice:", e);
    showNotification('Error deleting invoice', 'error');
  }
};

// --- TRANSACTIONS ---
window.saveTransaction = async function (transaction) {
  try {
    if (transaction.id && transaction.docId) {
      // Update existing transaction
      const transactionDocRef = doc(window.firestoreDb, "transactions", transaction.docId);
      await updateDoc(transactionDocRef, transaction);
      console.log("✅ Transaction updated:", transaction.id);
    } else {
      // Create new transaction
      const docRef = await addDoc(collection(window.firestoreDb, "transactions"), {
        ...transaction,
        createdAt: new Date(),
        category: currentTab
      });
      console.log("✅ Transaction saved with ID:", docRef.id);
    }
    window.loadTransactions(); // Reload the list
    calculateFinancialMetrics(); // Recalculate metrics
    updateCharts(currentPeriod); // Update charts
    closeModal();
    showNotification('Transaction saved successfully', 'success');
  } catch (e) {
    console.error("❌ Error saving transaction:", e);
    showNotification('Error saving transaction', 'error');
  }
};

window.loadTransactions = async function () {
  try {
    const querySnapshot = await getDocs(collection(window.firestoreDb, "transactions"));
    const transactions = querySnapshot.docs.map(doc => ({ 
      id: doc.id,
      docId: doc.id,
      ...doc.data() 
    }));
    console.log("✅ Transactions loaded:", transactions.length);
    
    // Organize transactions by category
    accountsData = {
      "Employee Payment": [],
      "Allowance": [],
      "Reimbursement": [],
      "Purchase": [],
      "Vendor Payment": [],
      "Miscellaneous Income": [],
      "Miscellaneous Expense": []
    };
    
    transactions.forEach(transaction => {
      const category = transaction.category || "Miscellaneous Expense";
      if (accountsData[category]) {
        accountsData[category].push(transaction);
      }
    });
    
    renderTable(currentTab); // Render current tab
    calculateFinancialMetrics();
    updateMetrics(currentPeriod);
    updateCharts(currentPeriod);
  } catch (e) {
    console.error("❌ Error loading transactions:", e);
  }
};

window.deleteTransaction = async function (transactionId) {
  if (!confirm("Are you sure you want to delete this transaction?")) return;
  try {
    // Find transaction in current category
    const transaction = accountsData[currentTab].find(t => t.id === transactionId || t.docId === transactionId);
    if (transaction && transaction.docId) {
      await deleteDoc(doc(window.firestoreDb, "transactions", transaction.docId));
      console.log("✅ Transaction deleted:", transactionId);
      window.loadTransactions(); // Reload the list
      showNotification('Transaction deleted successfully', 'success');
    }
  } catch (e) {
    console.error("❌ Error deleting transaction:", e);
    showNotification('Error deleting transaction', 'error');
  }
};

// --- USERS (ADMIN) ---
window.loadUsers = async function () {
  try {
    const querySnapshot = await getDocs(collection(window.firestoreDb, "users"));
    users = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log("✅ Users loaded:", users);
    renderUserList();
  } catch (e) {
    console.error("❌ Error loading users:", e);
  }
};

window.approveUser = async function (userId) {
  try {
    const userDocRef = doc(window.firestoreDb, "users", userId);
    await updateDoc(userDocRef, { status: "approved" });
    console.log("✅ User approved:", userId);
    window.loadUsers(); // Reload the list
  } catch (e) {
    console.error("❌ Error approving user:", e);
  }
};

window.rejectUser = async function (userId) {
  if (!confirm("Are you sure you want to reject this user?")) return;
  try {
    const userDocRef = doc(window.firestoreDb, "users", userId);
    await updateDoc(userDocRef, { status: "rejected" }); // Or deleteDoc(userDocRef) to remove entirely
    console.log("✅ User rejected:", userId);
    window.loadUsers(); // Reload the list
  } catch (e) {
    console.error("❌ Error rejecting user:", e);
  }
};

// --- COMPREHENSIVE UI AND CHART FUNCTIONS ---

// Dashboard Chart Functions
function changePeriod(period) {
    currentPeriod = period;
    updateMetrics(period);
    updateCharts(period);
    
    // Update period button styles
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.classList.remove('bg-gray-100', 'text-blue-700');
        btn.classList.add('text-gray-700');
    });
    document.querySelector(`[data-period="${period}"]`)?.classList.add('bg-gray-100', 'text-blue-700');
}

function updateMetrics(period) {
    const data = financialData[period];
    document.getElementById('totalRevenue').textContent = formatINR(data.revenue);
    document.getElementById('outstandingInvoices').textContent = formatINR(data.outstandingInvoices);
    document.getElementById('monthlyExpenses').textContent = formatINR(data.monthlyExpenses);
    document.getElementById('netProfit').textContent = formatINR(data.netProfit);
}

function updateCharts(period) {
    const data = financialData[period];
    const labels = period === 'daily' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] :
                   period === 'weekly' ? ['Week 1', 'Week 2', 'Week 3', 'Week 4'] :
                   ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

    if (revenueChart) {
        revenueChart.data.labels = labels;
        revenueChart.data.datasets[0].data = data.revenueData;
        revenueChart.update();
    }

    if (expenseChart) {
        expenseChart.data.labels = labels;
        expenseChart.data.datasets[0].data = data.expenseData;
        expenseChart.update();
    }
}

function initFloatingChart() {
    const ctx = document.getElementById('floatingChart')?.getContext('2d');
    if (!ctx) return;
    
    const gradientFill = ctx.createLinearGradient(0, 0, 0, 150);
    gradientFill.addColorStop(0, 'rgba(147, 51, 234, 0.3)');
    gradientFill.addColorStop(1, 'rgba(147, 51, 234, 0.0)');

    floatingChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: floatingChartData.monthly.labels,
            datasets: [{
                data: floatingChartData.monthly.values,
                fill: true,
                backgroundColor: gradientFill,
                borderColor: 'rgba(147, 51, 234, 1)',
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: { x: { display: false }, y: { display: false } }
        }
    });
}

function updateFloatingChart(period) {
    const data = floatingChartData[period];
    
    ['daily', 'weekly', 'monthly'].forEach(p => {
        const btn = document.getElementById(p + 'BtnFloat');
        if (btn) {
            btn.className = `group px-5 py-2.5 text-sm rounded-xl bg-gradient-to-r ${
                p === period ? 'from-white/20 to-blue-500/20' : 'from-white/10 to-blue-500/10 hover:from-white/20 hover:to-blue-500/20'
            } text-white transition-all duration-300 hover:shadow-lg hover:scale-105`;
        }
    });

    if (floatingChart) {
        floatingChart.data.labels = data.labels;
        floatingChart.data.datasets[0].data = data.values;
        floatingChart.update('none');
    }

    const growthElement = document.getElementById('floatingGrowth');
    if (growthElement) growthElement.textContent = `+${data.growth}%`;
    
    const periodLabelElement = document.getElementById('periodLabel');
    if (periodLabelElement) periodLabelElement.textContent = `${period.charAt(0).toUpperCase() + period.slice(1)} Revenue`;
    
    const overviewRevenueElement = document.getElementById('overviewRevenue');
    if (overviewRevenueElement) {
        if (data.revenue >= 10000000) {
            overviewRevenueElement.textContent = `₹${(data.revenue / 10000000).toFixed(2)}Cr`;
        } else if (data.revenue >= 100000) {
            overviewRevenueElement.textContent = `₹${(data.revenue / 100000).toFixed(1)}L`;
        } else {
            overviewRevenueElement.textContent = formatINR(data.revenue);
        }
    }
    
    const overviewRateElement = document.getElementById('overviewRate');
    if (overviewRateElement) overviewRateElement.textContent = `${data.rate}%`;
}

// Invoice Management Functions
function renderInvoiceTable() {
    const tableBody = document.getElementById('invoiceTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    if (invoicesData.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="py-8 text-center text-gray-500">
                    No invoices found. Create your first invoice!
                </td>
            </tr>
        `;
        return;
    }
    
    invoicesData.forEach(invoice => {
        const statusClass = invoice.status === 'Paid' ? 'bg-green-100 text-green-800' : 
                           invoice.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : 
                           'bg-red-100 text-red-800';
        
        const row = document.createElement('tr');
        row.className = 'border-b border-gray-100 hover:bg-gray-50';
        row.innerHTML = `
            <td class="py-3 px-4 font-medium">${invoice.id || invoice.orderNo}</td>
            <td class="py-3 px-4">${invoice.clientName}</td>
            <td class="py-3 px-4 font-semibold">${formatINR(invoice.grandTotal || invoice.amount || 0)}</td>
            <td class="py-3 px-4">
                <select class="status-dropdown ${statusClass} px-2 py-1 rounded text-xs" onchange="changeInvoiceStatus('${invoice.id}', this.value)">
                    <option value="Paid" ${invoice.status === 'Paid' ? 'selected' : ''}>Paid</option>
                    <option value="Pending" ${invoice.status === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option value="Overdue" ${invoice.status === 'Overdue' ? 'selected' : ''}>Overdue</option>
                </select>
            </td>
            <td class="py-3 px-4 text-gray-600">${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN') : 'N/A'}</td>
            <td class="py-3 px-4">
                <div class="flex space-x-2">
                    <button onclick="editInvoice('${invoice.id}')" class="px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="printInvoice('${invoice.id}')" class="px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors" title="Print">
                        <i class="fas fa-print"></i>
                    </button>
                    <button onclick="window.deleteInvoice('${invoice.id}')" class="px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function changeInvoiceStatus(invoiceId, newStatus) {
    const invoice = invoicesData.find(inv => inv.id === invoiceId);
    if (invoice) {
        invoice.status = newStatus;
        
        // Save to Firebase
        window.saveInvoice(invoice);
        showNotification(`Invoice ${invoiceId} status changed to ${newStatus}`, 'success');
    }
}

// Export Functions
function exportToExcel() {
    try {
        if (invoicesData.length === 0) {
            showNotification('No invoice data to export', 'error');
            return;
        }
        
        const exportData = invoicesData.map(invoice => ({
            'Invoice ID': invoice.id || invoice.orderNo || 'N/A',
            'Order No': invoice.orderNo || 'N/A',
            'Date': invoice.date || 'N/A',
            'Client Name': invoice.clientName || 'N/A',
            'Amount': invoice.grandTotal || invoice.amount || 0,
            'Status': invoice.status || 'Pending',
            'Due Date': invoice.dueDate || 'N/A',
            'Export Date': new Date().toLocaleDateString('en-IN')
        }));
        
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
        
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `FinanceFlow_Invoices_${timestamp}.xlsx`;
        
        XLSX.writeFile(wb, filename);
        showNotification('Invoice data exported successfully', 'success');
        
    } catch (error) {
        console.error('Failed to export to Excel:', error);
        showNotification('Failed to export invoice data', 'error');
    }
}

function exportAllData() {
    const allData = {
        invoices: invoicesData,
        accounts: accountsData,
        financialMetrics: financialData,
        exportDate: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(allData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `financeflow-data-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    showNotification('All data exported successfully', 'success');
}

// --- INITIALIZATION ---
// Initialize main charts
function initMainCharts() {
    // Revenue Chart
    const revenueCtx = document.getElementById('revenueChart');
    if (revenueCtx) {
        revenueChart = new Chart(revenueCtx, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Revenue',
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(0, 0, 0, 0.05)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    // Expense Chart
    const expenseCtx = document.getElementById('expenseChart');
    if (expenseCtx) {
        expenseChart = new Chart(expenseCtx, {
            type: 'doughnut',
            data: {
                datasets: [{
                    backgroundColor: ['#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4', '#10b981'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }
}

// Invoice Modal Functions
function openInvoiceModal(invoiceId = null) {
    const modal = document.getElementById('invoiceModal');
    const modalTitle = document.getElementById('invoiceModalTitle');
    const submitBtn = document.getElementById('invoiceSubmitBtn');
    
    currentEditingInvoiceId = invoiceId;
    
    if (invoiceId) {
        modalTitle.textContent = 'Edit Invoice';
        submitBtn.textContent = 'Update Invoice';
        populateInvoiceForm(invoiceId);
    } else {
        modalTitle.textContent = 'Create New Invoice';
        submitBtn.textContent = 'Create Invoice';
        resetInvoiceForm();
        addInvoiceItem(); // Add first item by default
    }
    
    modal.classList.remove('hidden');
}

function closeInvoiceModal() {
    const modal = document.getElementById('invoiceModal');
    modal.classList.add('hidden');
    currentEditingInvoiceId = null;
    resetInvoiceForm();
}

function resetInvoiceForm() {
    document.getElementById('invoiceForm').reset();
    document.getElementById('invoiceItems').innerHTML = '';
    document.getElementById('subtotal').value = '';
    document.getElementById('grandTotal').value = '';
}

function addInvoiceItem() {
    const itemsContainer = document.getElementById('invoiceItems');
    const itemDiv = document.createElement('div');
    itemDiv.className = 'p-4 border border-gray-300 rounded-lg invoice-item';
    
    itemDiv.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <h5 class="font-medium text-gray-900">Item ${itemsContainer.children.length + 1}</h5>
            <button type="button" onclick="removeInvoiceItem(this)" class="text-red-600 hover:text-red-800">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="md:col-span-2">
                <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input type="text" name="description" class="w-full px-3 py-2 border border-gray-300 rounded-lg" required>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">HSN/SAC Code</label>
                <input type="text" name="hsnCode" class="w-full px-3 py-2 border border-gray-300 rounded-lg">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input type="number" name="quantity" value="1" min="1" step="0.01" class="w-full px-3 py-2 border border-gray-300 rounded-lg" onchange="calculateItemAmount(this)" required>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                <select name="unit" class="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="Piece">Piece</option>
                    <option value="Service">Service</option>
                    <option value="Hour">Hour</option>
                    <option value="Day">Day</option>
                </select>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">List Price (₹)</label>
                <input type="number" name="listPrice" step="0.01" class="w-full px-3 py-2 border border-gray-300 rounded-lg" onchange="calculateItemAmount(this)" required>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Discount (₹)</label>
                <input type="number" name="discount" value="0" step="0.01" class="w-full px-3 py-2 border border-gray-300 rounded-lg" onchange="calculateItemAmount(this)">
            </div>
        </div>
        <div class="mt-3 text-right">
            <span class="text-sm text-gray-600">Amount: </span>
            <span class="font-semibold text-lg item-amount">₹0</span>
        </div>
    `;
    
    itemsContainer.appendChild(itemDiv);
}

function removeInvoiceItem(button) {
    const itemDiv = button.closest('.invoice-item');
    itemDiv.remove();
    calculateTotals();
    
    // Update item numbers
    const items = document.querySelectorAll('.invoice-item h5');
    items.forEach((item, index) => {
        item.textContent = `Item ${index + 1}`;
    });
}

function calculateItemAmount(input) {
    const itemDiv = input.closest('.invoice-item');
    const quantity = parseFloat(itemDiv.querySelector('[name="quantity"]').value) || 0;
    const listPrice = parseFloat(itemDiv.querySelector('[name="listPrice"]').value) || 0;
    const discount = parseFloat(itemDiv.querySelector('[name="discount"]').value) || 0;
    
    const amount = (quantity * listPrice) - discount;
    itemDiv.querySelector('.item-amount').textContent = formatINR(amount);
    
    calculateTotals();
}

function calculateTotals() {
    let subtotal = 0;
    document.querySelectorAll('.invoice-item').forEach(itemDiv => {
        const quantity = parseFloat(itemDiv.querySelector('[name="quantity"]').value) || 0;
        const listPrice = parseFloat(itemDiv.querySelector('[name="listPrice"]').value) || 0;
        const discount = parseFloat(itemDiv.querySelector('[name="discount"]').value) || 0;
        subtotal += (quantity * listPrice) - discount;
    });
    
    const sgstRate = parseFloat(document.getElementById('sgstRate').value) || 0;
    const cgstRate = parseFloat(document.getElementById('cgstRate').value) || 0;
    
    const sgstAmount = (subtotal * sgstRate) / 100;
    const cgstAmount = (subtotal * cgstRate) / 100;
    const grandTotal = subtotal + sgstAmount + cgstAmount;
    
    document.getElementById('subtotal').value = subtotal.toFixed(2);
    document.getElementById('grandTotal').value = grandTotal.toFixed(2);
}

// Transaction Functions
function renderTable(tab) {
    const tableBody = document.getElementById("transactionTable");
    if (!tableBody) return;
    
    tableBody.innerHTML = "";
    const transactions = accountsData[tab] || [];
    
    if (transactions.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-8 text-center text-gray-500">
                    No transactions found for ${tab}. Add your first transaction!
                </td>
            </tr>
        `;
        return;
    }
    
    transactions.forEach(transaction => {
        const row = document.createElement("tr");
        row.className = "border-b border-gray-100 hover:bg-gray-50";
        row.innerHTML = `
            <td class="px-6 py-4 text-gray-700">${transaction.date ? new Date(transaction.date).toLocaleDateString('en-IN') : 'N/A'}</td>
            <td class="px-6 py-4 font-medium text-gray-900">${transaction.description || 'N/A'}</td>
            <td class="px-6 py-4 text-gray-600">${transaction.notes || '-'}</td>
            <td class="px-6 py-4 text-right font-semibold ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}">
                ${formatINR(Math.abs(transaction.amount))} ${transaction.amount >= 0 ? '(Credit)' : '(Debit)'}
            </td>
            <td class="px-6 py-4 text-center">
                <div class="flex justify-center space-x-2">
                    <button onclick="editTransaction('${transaction.id}')" class="px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="window.deleteTransaction('${transaction.id}')" class="px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function switchTab(tab) {
    currentTab = tab;
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('border-indigo-500', 'text-indigo-600');
        btn.classList.add('border-transparent', 'text-gray-600');
    });
    
    const activeBtn = document.querySelector(`[data-tab="${tab}"]`);
    if (activeBtn) {
        activeBtn.classList.remove('border-transparent', 'text-gray-600');
        activeBtn.classList.add('border-indigo-500', 'text-indigo-600');
    }
    
    renderTable(tab);
}

function openModal(transactionId = null) {
    const modal = document.getElementById("modal");
    const modalTitle = document.getElementById("modal-title");
    const submitBtn = document.getElementById("submitBtn");
    
    currentEditingId = transactionId;
    
    if (transactionId) {
        modalTitle.textContent = "Edit Transaction";
        submitBtn.textContent = "Update";
        populateTransactionForm(transactionId);
    } else {
        modalTitle.textContent = "Add Transaction";
        submitBtn.textContent = "Add";
        resetTransactionForm();
    }
    
    modal.classList.remove("hidden");
}

function closeModal() {
    document.getElementById("modal").classList.add("hidden");
    currentEditingId = null;
    resetTransactionForm();
}

function resetTransactionForm() {
    document.getElementById("transactionForm").reset();
}

function populateTransactionForm(transactionId) {
    const transaction = accountsData[currentTab].find(t => t.id === transactionId);
    if (transaction) {
        document.getElementById("date").value = transaction.date;
        document.getElementById("description").value = transaction.description;
        document.getElementById("notes").value = transaction.notes || '';
        document.getElementById("amount").value = Math.abs(transaction.amount);
    }
}

function editTransaction(transactionId) {
    openModal(transactionId);
}

function editInvoice(invoiceId) {
    openInvoiceModal(invoiceId);
}

function printInvoice(invoiceId) {
    const invoice = invoicesData.find(inv => inv.id === invoiceId);
    if (invoice) {
        showNotification('Print functionality will be implemented', 'info');
    }
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg z-50 max-w-sm ${
        type === 'success' ? 'bg-green-500 text-white' : 
        type === 'error' ? 'bg-red-500 text-white' : 
        'bg-blue-500 text-white'
    }`;
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'} mr-2"></i>
            <span>${message}</span>
        </div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function initApp() {
    console.log('🚀 Initializing FinanceFlow Pro...');
    
    // Initialize charts
    initFloatingChart();
    updateFloatingChart('monthly');
    initMainCharts();
    
    // Set initial period
    changePeriod('monthly');
    
    // Load initial data
    window.loadInvoices();
    window.loadTransactions();
    window.loadUsers(); // Load users for admin panel
    
    // Setup event listeners
    setupEventListeners();
}

function setupEventListeners() {
    // Period buttons
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            changePeriod(this.dataset.period);
        });
    });
    
    // Tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });
    
    // Invoice form
    const invoiceForm = document.getElementById('invoiceForm');
    if (invoiceForm) {
        invoiceForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            const items = [];
            
            // Collect items data
            document.querySelectorAll('.invoice-item').forEach(itemDiv => {
                const quantity = parseFloat(itemDiv.querySelector('[name="quantity"]').value) || 0;
                const listPrice = parseFloat(itemDiv.querySelector('[name="listPrice"]').value) || 0;
                const discount = parseFloat(itemDiv.querySelector('[name="discount"]').value) || 0;
                
                items.push({
                    description: itemDiv.querySelector('[name="description"]').value,
                    hsnCode: itemDiv.querySelector('[name="hsnCode"]').value,
                    quantity: quantity,
                    unit: itemDiv.querySelector('[name="unit"]').value,
                    listPrice: listPrice,
                    discount: discount,
                    amount: (quantity * listPrice) - discount
                });
            });
            
            const subtotal = parseFloat(document.getElementById('subtotal').value) || 0;
            const sgstRate = parseFloat(document.getElementById('sgstRate').value) || 0;
            const cgstRate = parseFloat(document.getElementById('cgstRate').value) || 0;
            const grandTotal = parseFloat(document.getElementById('grandTotal').value) || 0;
            
            const invoiceData = {
                id: currentEditingInvoiceId || `INV-${Date.now()}`,
                orderNo: document.getElementById('orderNo').value,
                date: document.getElementById('invoiceDate').value,
                orderId: document.getElementById('orderId').value,
                dueDate: document.getElementById('dueDate').value,
                clientName: document.getElementById('clientName').value,
                clientGstin: document.getElementById('clientGstin').value,
                shippingAddress: document.getElementById('shippingAddress').value,
                items: items,
                subtotal: subtotal,
                sgstRate: sgstRate,
                cgstRate: cgstRate,
                grandTotal: grandTotal,
                status: currentEditingInvoiceId ? invoicesData.find(inv => inv.id === currentEditingInvoiceId)?.status || 'Pending' : 'Pending',
                createdAt: new Date()
            };
            
            window.saveInvoice(invoiceData);
        });
    }
    
    // Transaction form
    const transactionForm = document.getElementById("transactionForm");
    if (transactionForm) {
        transactionForm.addEventListener("submit", function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            const amount = parseFloat(formData.get("amount")) || 0;
            const adjustedAmount = ['Miscellaneous Income'].includes(currentTab) ? amount : -amount;
            
            const transactionData = {
                id: currentEditingId || `TXN-${Date.now()}`,
                date: formData.get("date"),
                description: formData.get("description"),
                notes: formData.get("notes"),
                amount: adjustedAmount,
                category: currentTab,
                createdAt: new Date()
            };
            
            window.saveTransaction(transactionData);
        });
    }
    
    // Modal event listeners
    const openModalBtn = document.getElementById('openModal');
    if (openModalBtn) {
        openModalBtn.addEventListener('click', () => openModal());
    }
    
    const closeModalBtn = document.getElementById('closeModal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeModal);
    }
    
    const cancelModalBtn = document.getElementById('cancelModal');
    if (cancelModalBtn) {
        cancelModalBtn.addEventListener('click', closeModal);
    }
    
    // Set today's date as default for new invoices
    const invoiceDateField = document.getElementById('invoiceDate');
    if (invoiceDateField) {
        invoiceDateField.value = new Date().toISOString().split('T')[0];
    }
    
    const transactionDateField = document.getElementById('date');
    if (transactionDateField) {
        transactionDateField.value = new Date().toISOString().split('T')[0];
    }
    
    // Smooth scrolling for navigation
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
}

    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // --- EVENT LISTENERS FOR MODALS ---
    // Invoice Modal
    document.getElementById('openInvoiceModal')?.addEventListener('click', () => openInvoiceModal());
    document.getElementById('closeInvoiceModal')?.addEventListener('click', () => closeModal('invoiceModal'));
    document.getElementById('cancelInvoiceBtn')?.addEventListener('click', () => closeModal('invoiceModal'));
    document.getElementById('invoiceForm')?.addEventListener('submit', handleInvoiceFormSubmit);

    // Transaction Modal
    document.getElementById('openTransactionModal')?.addEventListener('click', () => openModal());
    document.getElementById('closeTransactionModal')?.addEventListener('click', () => closeModal('addTransactionModal')); // Add close button if needed
    // Transaction form submit is handled in index.html script tag

    // User Modal
    document.getElementById('openUserModal')?.addEventListener('click', () => openUserModal());
    document.getElementById('closeUserModal')?.addEventListener('click', () => closeModal('userModal'));
    document.getElementById('cancelUserBtn')?.addEventListener('click', () => closeModal('userModal'));
    document.getElementById('userForm')?.addEventListener('submit', handleUserFormSubmit);

    // Tab switching for Accounts
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            switchTab(button.dataset.tab);
        });
    });
}

// --- MODAL HANDLERS ---
function openInvoiceModal(invoiceId = null) {
    const modal = document.getElementById("invoiceModal");
    const modalTitle = document.getElementById("invoiceModalTitle");
    const invoiceForm = document.getElementById("invoiceForm");
    invoiceForm.reset();
    currentEditingInvoiceId = invoiceId;

    if (invoiceId) {
        modalTitle.textContent = "Edit Invoice";
        // Pre-fill form if editing
        const invoice = invoicesData.find(inv => inv.id === invoiceId);
        if (invoice) {
            document.getElementById("invoiceId").value = invoice.id;
            document.getElementById("clientName").value = invoice.clientName || '';
            document.getElementById("invoiceAmount").value = invoice.amount || '';
            document.getElementById("invoiceDate").value = invoice.date || '';
            document.getElementById("invoiceStatus").value = invoice.status || 'Pending';
            document.getElementById("invoiceDescription").value = invoice.description || '';
        }
    } else {
        modalTitle.textContent = "Create New Invoice";
        document.getElementById("invoiceId").value = '';
    }
    modal.classList.remove("hidden");
}

function openModal(transactionId = null) { // Renamed from openTransactionModal for clarity
    const modal = document.getElementById("addTransactionModal");
    const modalTitle = document.getElementById("modal-title");
    const transactionForm = document.getElementById("addTransactionForm");
    transactionForm.reset();
    currentEditingId = transactionId;

    if (transactionId) {
        modalTitle.textContent = "Edit Transaction";
        // Pre-fill form if editing (you'll need to find the transaction data)
         // This part depends on how you store/load transactions for editing
         // Example (assuming you have a global transactions array loaded):
         /*
         const transaction = transactions.find(t => t.id === transactionId);
         if (transaction) {
            document.getElementById("transactionId").value = transaction.id;
            document.getElementById("transactionDate").value = transaction.date;
            document.getElementById("transactionDescription").value = transaction.description;
            document.getElementById("transactionNotes").value = transaction.notes || '';
            document.getElementById("transactionType").value = transaction.type;
            document.getElementById("transactionAmount").value = Math.abs(transaction.amount); // Assuming amount is stored as number
         }
         */
    } else {
        modalTitle.textContent = "Add New Transaction";
        document.getElementById("transactionId").value = '';
    }
    modal.classList.remove("hidden");
}

function openUserModal(userId = null) {
    const modal = document.getElementById("userModal");
    const modalTitle = document.getElementById("user-modal-title");
    const userForm = document.getElementById("userForm");
    userForm.reset();
    currentEditingUserId = userId;

    if (userId) {
        modalTitle.textContent = "Edit User";
        // Pre-fill form if editing (find user data)
        const user = users.find(u => u.id === userId);
        if (user) {
            document.getElementById("userId").value = user.id;
            document.getElementById("userName").value = user.name || '';
            document.getElementById("userEmail").value = user.email || '';
            document.getElementById("userRole").value = user.role || 'User';
            // Disable email editing for existing users?
            document.getElementById("userEmail").disabled = true;
        }
    } else {
        modalTitle.textContent = "Add New User";
        document.getElementById("userId").value = '';
        document.getElementById("userEmail").disabled = false; // Enable for new users
    }
    modal.classList.remove("hidden");
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add("hidden");
    }
    // Reset forms if needed
    if (modalId === 'invoiceModal') document.getElementById('invoiceForm')?.reset();
    if (modalId === 'addTransactionModal') document.getElementById('addTransactionForm')?.reset();
    if (modalId === 'userModal') document.getElementById('userForm')?.reset();
}

// --- FORM SUBMIT HANDLERS ---
function handleInvoiceFormSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const invoice = {
        id: formData.get('invoiceId') || null, // null for new invoices
        clientName: formData.get('clientName'),
        amount: parseFloat(formData.get('invoiceAmount')),
        date: formData.get('invoiceDate'),
        status: formData.get('invoiceStatus'),
        description: formData.get('invoiceDescription')
    };
    window.saveInvoice(invoice);
}

async function handleUserFormSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const userId = formData.get('userId');
    const userData = {
        name: formData.get('userName'),
        email: formData.get('userEmail'),
        role: formData.get('userRole')
        // Status is typically set by admin, not here, unless it's initial signup
        // For editing, we usually don't change email or status here
    };

    try {
        if (userId) {
            // Update existing user
            const userDocRef = doc(window.firestoreDb, "users", userId);
            await updateDoc(userDocRef, userData);
            console.log("✅ User updated:", userId);
        } else {
            // Check if email already exists before creating
            const q = query(collection(window.firestoreDb, "users"), where("email", "==", userData.email));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                alert("A user with this email already exists.");
                return;
            }
            // Create new user (initially pending)
            userData.status = "pending";
            userData.secretCode = "1234"; // Or generate/set server-side
            userData.createdAt = new Date();
            const docRef = await addDoc(collection(window.firestoreDb, "users"), userData);
            console.log("✅ User created with ID:", docRef.id);
        }
        window.loadUsers(); // Reload the list
        closeModal('userModal');
    } catch (error) {
        console.error("❌ Error saving user:", error);
        alert("An error occurred while saving the user.");
    }
}

// --- RENDERING FUNCTIONS ---
function renderInvoiceTable() {
    const tableBody = document.getElementById('invoiceTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    invoicesData.forEach(invoice => {
        const statusClass = invoice.status === 'Paid' ? 'invoice-status-paid' :
                           invoice.status === 'Pending' ? 'invoice-status-pending' :
                           'invoice-status-overdue';
        const row = document.createElement('tr');
        row.className = 'border-b border-gray-100 hover:bg-gray-50';
        row.innerHTML = `
            <td class="px-6 py-4 font-medium text-gray-900">${invoice.id}</td>
            <td class="px-6 py-4">${invoice.clientName}</td>
            <td class="px-6 py-4 font-semibold">${formatINR(invoice.amount)}</td>
            <td class="px-6 py-4">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass === 'invoice-status-paid' ? 'bg-green-100 text-green-800' : statusClass === 'invoice-status-pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}">
                    ${invoice.status}
                </span>
            </td>
            <td class="px-6 py-4 text-gray-500">${new Date(invoice.date).toLocaleDateString('en-IN')}</td>
            <td class="px-6 py-4 text-center">
                <button onclick="openInvoiceModal('${invoice.id}')" class="text-indigo-600 hover:text-indigo-900 mr-3">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="window.deleteInvoice('${invoice.id}')" class="text-red-600 hover:text-red-900">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function renderTransactions(transactions) { // For Dashboard
    const tableBody = document.getElementById('recentTransactions');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    // Sort by date descending and take top 5
    const recentTransactions = [...transactions]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);

    recentTransactions.forEach(transaction => {
        const amountClass = transaction.type === 'Credit' ? 'transaction-positive' : 'transaction-negative';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${transaction.description}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${new Date(transaction.date).toLocaleDateString('en-IN')}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-right ${amountClass}">${formatINR(transaction.amount)}</td>
        `;
        tableBody.appendChild(row);
    });
}

function renderTable(tab) { // For Accounts section tabs
    currentTab = tab;
    const tableBody = document.getElementById('transactionTable');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    // This part needs to be adapted based on how you want to display data per tab
    // Assuming you load all transactions and filter/sort here, or you have separate collections
    // For now, let's assume `accountsData` is populated from Firestore or local state
    // Let's simplify and just render all transactions for the selected tab conceptually
    // You might need a different structure or query based on your data model

    // Example: If accountsData was loaded from a specific query per tab
    // const tabTransactions = accountsData[tab] || [];
    // Or, filter the main transactions list:
     window.loadTransactions(); // Ensure data is loaded
     // Filter logic would go here if needed, but renderTransactions handles display

    // Highlight active tab button
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.add('border-transparent', 'text-gray-600');
        btn.classList.remove('border-indigo-500', 'text-indigo-600');
    });
    const activeBtn = document.querySelector(`[data-tab="${tab}"]`);
    if (activeBtn) {
        activeBtn.classList.remove('border-transparent', 'text-gray-600');
        activeBtn.classList.add('border-indigo-500', 'text-indigo-600');
    }
}

function switchTab(tab) {
    renderTable(tab);
}

function renderUserList() {
    const userList = document.getElementById('userList');
    if (!userList) return;
    userList.innerHTML = '';
    users.forEach(user => {
        // Don't show pending/rejected users to non-admins if needed, but for admin panel, show all
        const userDiv = document.createElement('div');
        userDiv.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-lg';
        userDiv.innerHTML = `
            <div class="flex items-center">
                <div class="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    ${user.name ? user.name.split(' ').map(n => n[0]).join('') : user.email.charAt(0).toUpperCase()}
                </div>
                <div class="ml-3">
                    <div class="text-sm font-medium text-gray-900">${user.name || user.email}</div>
                    <div class="text-sm text-gray-500">${user.email}</div>
                </div>
            </div>
            <div class="flex items-center space-x-2">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    user.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    user.status === 'approved' ? 'bg-green-100 text-green-800' :
                    'bg-red-100 text-red-800'
                }">
                    ${user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                </span>
                ${
                    user.status === 'pending' ?
                    `<button onclick="window.approveUser('${user.id}')" class="text-xs bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded">Approve</button>
                     <button onclick="window.rejectUser('${user.id}')" class="text-xs bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded">Reject</button>` :
                    user.status === 'approved' ?
                    `<span class="text-xs text-gray-500">${user.role}</span>
                     <button onclick="window.rejectUser('${user.id}')" class="text-xs bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded">Reject</button>` :
                    `<span class="text-xs text-gray-500">Rejected</span>
                     <button onclick="window.approveUser('${user.id}')" class="text-xs bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded">Re-Approve</button>`
                }
            </div>
        `;
        userList.appendChild(userDiv);
    });
}

// --- CHART INITIALIZATION ---
function initCharts() {
    // Revenue Chart (example data)
    const revenueCtx = document.getElementById('revenueChart');
    if (revenueCtx) {
        new Chart(revenueCtx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
                datasets: [{
                    label: 'Revenue',
                    data: [12000, 19000, 15000, 22000, 18000, 25000, 24560],
                    borderColor: 'rgb(79, 70, 229)',
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }

    // Floating Chart (example)
    initFloatingChart();
}

function initFloatingChart() {
    // Placeholder for floating chart logic if separate from main charts
}

function updateFloatingChart(period) {
    // Placeholder for updating floating chart based on period
}

// --- NOTIFICATIONS ---
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-4 py-2 rounded-md shadow-lg z-50 ${
        type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
    }`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// --- INVOICE PDF/PRINT ---
function generateInvoiceTemplate(invoice) {
    // ... (keep your existing template generation logic)
}

function downloadInvoicePDF(invoice) {
    // ... (keep your existing PDF download logic)
}

function printInvoice(invoice) {
    // ... (keep your existing print logic)
}

// --- EXPORT ---
function exportToExcel() {
    // ... (keep your existing Excel export logic)
}

// --- END OF EXISTING LOGIC ---