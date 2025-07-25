/**
 * ChatGPT Addon Health Check
 * Content script that runs on ChatGPT.com to check login status
 * Part of the layered health check system
 */

// Prevent multiple executions
if (typeof window.healthCheckAddonLoaded === 'undefined') {
window.healthCheckAddonLoaded = true;

console.log('🏥 ChatGPT Health Check Addon loaded');

/**
 * Check if user is logged in to ChatGPT
 * @returns {boolean} True if logged in, false otherwise
 */
function isLoggedIn() {
  // Check for various indicators of being logged in
  // 1. Check for user menu button
  const userMenuButton = document.querySelector('button[data-testid="profile-button"]');
  if (userMenuButton) return true;
  
  // 2. Check for the main chat interface
  const chatInterface = document.querySelector('main .flex-1.overflow-hidden');
  if (chatInterface) return true;
  
  // 3. Check for new chat button
  const newChatButton = document.querySelector('a[href="/"]');
  if (newChatButton && newChatButton.textContent?.includes('New chat')) return true;
  
  // 4. Check if we're on the login page
  const loginForm = document.querySelector('form[action*="login"]');
  const authElements = document.querySelectorAll('[data-testid*="auth"], [class*="auth"]');
  if (loginForm || authElements.length > 0) return false;
  
  // 5. Check for conversation list
  const conversationList = document.querySelector('nav[aria-label="Chat history"]');
  if (conversationList) return true;
  
  // Default to false if no indicators found
  return false;
}

/**
 * Get user email if available
 * @returns {string|null} User email or null
 */
function getUserEmail() {
  // Try to find email in various locations
  // 1. Profile button might have email
  const profileButton = document.querySelector('button[data-testid="profile-button"]');
  if (profileButton) {
    const emailText = profileButton.textContent;
    if (emailText && emailText.includes('@')) {
      return emailText.trim();
    }
  }
  
  // 2. Check user menu if it's open
  const userMenuEmail = document.querySelector('[data-testid="user-menu"] [class*="email"]');
  if (userMenuEmail) {
    return userMenuEmail.textContent?.trim() || null;
  }
  
  return null;
}

/**
 * Get current page state
 * @returns {string} Page state description
 */
function getPageState() {
  const url = window.location.href;
  
  if (url.includes('/auth/login')) return 'login_page';
  if (url.includes('/c/')) return 'conversation';
  if (url === 'https://chat.openai.com/' || url === 'https://chat.openai.com') return 'home';
  if (url.includes('/g/')) return 'gpt';
  if (url.includes('/share/')) return 'shared_conversation';
  
  return 'unknown';
}

/**
 * Perform health check
 * @returns {Object} Health status
 */
function performHealthCheck() {
  const loggedIn = isLoggedIn();
  const userEmail = getUserEmail();
  const pageState = getPageState();
  
  let message = '';
  let action = '';
  
  if (loggedIn) {
    message = userEmail ? `Logged in as: ${userEmail}` : 'Logged in';
  } else {
    message = 'Not logged in to ChatGPT';
    action = 'https://chat.openai.com/auth/login';
  }
  
  return {
    component: 'addon',
    healthy: loggedIn,
    message: message,
    action: action,
    details: {
      pageState: pageState,
      url: window.location.href,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Listen for health check requests from extension
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Addon received message:', request);
  
  if (request.type === 'CHECK_SESSION') {
    const healthStatus = performHealthCheck();
    console.log('🏥 Health check result:', healthStatus);
    sendResponse(healthStatus);
    return true; // Keep channel open for async response
  }
  
  // Handle other message types if needed
  if (request.type === 'PING') {
    sendResponse({ type: 'PONG', from: 'chatgpt-addon' });
    return true;
  }
});

// Notify extension that addon is loaded
try {
  chrome.runtime.sendMessage({
    type: 'ADDON_LOADED',
    url: window.location.href,
    timestamp: new Date().toISOString()
  });
} catch (error) {
  // Extension might not be ready yet
  console.log('Could not notify extension of addon load:', error);
}

// Monitor for login state changes
// Prevent duplicate variable declarations
if (typeof window.healthCheckAddonState === 'undefined') {
  window.healthCheckAddonState = { lastLoginState: isLoggedIn() };
}

setInterval(() => {
  const currentLoginState = isLoggedIn();
  if (currentLoginState !== window.healthCheckAddonState.lastLoginState) {
    window.healthCheckAddonState.lastLoginState = currentLoginState;
    console.log('🔄 Login state changed:', currentLoginState);
    
    // Notify extension of state change
    try {
      chrome.runtime.sendMessage({
        type: 'LOGIN_STATE_CHANGED',
        loggedIn: currentLoginState,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.log('Could not notify extension of login state change:', error);
    }
  }
}, 5000); // Check every 5 seconds

// Log initial state
console.log('🏥 Initial health check:', performHealthCheck());

} // Close the if (typeof window.healthCheckAddonLoaded === 'undefined')