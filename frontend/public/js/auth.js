// CampusAid Authentication Handler
const API_BASE = 'http://localhost:3000/api';

// Check for existing session on page load
async function checkExistingSession() {
  try {
    const response = await fetch(`${API_BASE}/session/verify`, {
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        console.log('Existing session found, redirecting...');
        // User is already logged in, redirect to services
        window.location.href = '/services.html';
      }
    }
  } catch (error) {
    console.log('No existing session found');
  }
}

// Handle login form submission
async function handleLogin(event) {
  event.preventDefault();
  
  console.log('Login form submitted');
  
  // Get form elements
  const emailInput = document.getElementById('email');
  const studentIdInput = document.getElementById('studentId');
  const errorMessage = document.getElementById('errorMessage');
  const successMessage = document.getElementById('successMessage');
  const loginBtn = document.getElementById('loginBtn');
  const loginBtnText = document.getElementById('loginBtnText');
  const loginBtnLoader = document.getElementById('loginBtnLoader');
  
  // Hide previous messages
  if (errorMessage) errorMessage.style.display = 'none';
  if (successMessage) successMessage.style.display = 'none';
  
  // Get values
  const email = emailInput ? emailInput.value.trim() : '';
  const studentId = studentIdInput ? studentIdInput.value.trim() : '';
  
  // Validation
  if (!email && !studentId) {
    showError('Please enter your email or student ID');
    return;
  }
  
  // Prepare login data
  const loginData = {};
  if (email) loginData.email = email;
  if (studentId) loginData.student_id = studentId;
  
  console.log('Attempting login with:', loginData);
  
  try {
    // Show loading state
    if (loginBtn) loginBtn.disabled = true;
    if (loginBtnText) loginBtnText.textContent = 'Signing in...';
    if (loginBtnLoader) loginBtnLoader.style.display = 'inline-block';
    
    const response = await fetch(`${API_BASE}/session/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(loginData)
    });
    
    const data = await response.json();
    console.log('Login response:', data);
    
    if (response.ok && data.success) {
      // Store user data in sessionStorage for quick access
      sessionStorage.setItem('user', JSON.stringify(data.data.user));
      sessionStorage.setItem('services', JSON.stringify(data.data.services || []));
      sessionStorage.setItem('channels', JSON.stringify(data.data.channels || []));
      
      // Show success message
      if (successMessage) {
        successMessage.textContent = 'Login successful! Redirecting...';
        successMessage.style.display = 'block';
      }
      
      // Redirect to services page
      setTimeout(() => {
        window.location.href = '/services.html';
      }, 500);
    } else {
      showError(data.error || 'Login failed. Please check your credentials.');
    }
  } catch (error) {
    console.error('Login error:', error);
    showError('Connection error. Please check if the server is running.');
  } finally {
    // Reset button state
    if (loginBtn) loginBtn.disabled = false;
    if (loginBtnText) loginBtnText.textContent = 'Sign In';
    if (loginBtnLoader) loginBtnLoader.style.display = 'none';
  }
}

// Handle logout
async function handleLogout() {
  try {
    console.log('Logging out...');
    
    const response = await fetch(`${API_BASE}/session/logout`, {
      method: 'POST',
      credentials: 'include'
    });
    
    // Clear session storage regardless of response
    sessionStorage.clear();
    localStorage.clear();
    
    // Redirect to login page
    window.location.href = '/';
  } catch (error) {
    console.error('Logout error:', error);
    // Clear storage and redirect anyway
    sessionStorage.clear();
    localStorage.clear();
    window.location.href = '/';
  }
}

// Show error message
function showError(message) {
  console.error('Error:', message);
  
  const errorDiv = document.getElementById('errorMessage');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      errorDiv.style.display = 'none';
    }, 5000);
  } else {
    alert(message);
  }
}

// Show success message
function showSuccess(message) {
  console.log('Success:', message);
  
  const successDiv = document.getElementById('successMessage');
  if (successDiv) {
    successDiv.textContent = message;
    successDiv.style.display = 'block';
  }
}

// Get current user from session
function getCurrentUser() {
  const userJson = sessionStorage.getItem('user');
  return userJson ? JSON.parse(userJson) : null;
}

// Check if user is authenticated
function isAuthenticated() {
  return getCurrentUser() !== null;
}

// Check if user is service admin
function isServiceAdmin() {
  const user = getCurrentUser();
  return user && user.role === 'service_admin';
}

// Require authentication (redirect to login if not authenticated)
function requireAuth() {
  if (!isAuthenticated()) {
    console.log('User not authenticated, redirecting to login');
    window.location.href = '/';
    return false;
  }
  return true;
}

// Initialize auth on page load
document.addEventListener('DOMContentLoaded', () => {
  const currentPath = window.location.pathname;
  console.log('Current path:', currentPath);
  
  // On login page
  if (currentPath === '/' || currentPath === '/index.html') {
    console.log('On login page, checking for existing session...');
    checkExistingSession();
    
    // Attach login form handler
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      console.log('Login form found, attaching handler');
      loginForm.addEventListener('submit', handleLogin);
    }
  } else {
    // On protected pages, check if user is authenticated
    console.log('On protected page, checking authentication...');
    
    // Only require auth on services and chat pages
    if (currentPath.includes('services.html') || currentPath.includes('chat.html')) {
      if (!isAuthenticated()) {
        console.log('Not authenticated, redirecting to login');
        window.location.href = '/';
        return;
      } else {
        console.log('User authenticated:', getCurrentUser());
      }
    }
  }
  
  // Attach logout handlers if they exist
  const logoutButtons = document.querySelectorAll('.logout-btn, #logoutBtn, [data-action="logout"]');
  if (logoutButtons.length > 0) {
    console.log(`Found ${logoutButtons.length} logout button(s)`);
    logoutButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout();
      });
    });
  }
  
  // Display user info if element exists
  const userNameElement = document.getElementById('userName');
  if (userNameElement) {
    const user = getCurrentUser();
    if (user) {
      userNameElement.textContent = user.full_name || user.email || user.student_id;
    }
  }
  
  // Show/hide admin features based on role
  if (isServiceAdmin()) {
    const adminElements = document.querySelectorAll('.admin-only');
    adminElements.forEach(el => el.style.display = 'block');
  }
});

// Export functions for use in other scripts
window.CampusAidAuth = {
  getCurrentUser,
  isAuthenticated,
  isServiceAdmin,
  requireAuth,
  handleLogout,
  showError,
  showSuccess
};