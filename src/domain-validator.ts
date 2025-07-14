/**
 * Domain validation utilities for the Chrome extension
 * Ensures extension only operates on allowed domains
 */

// Define allowed domains based on manifest permissions
export const ALLOWED_DOMAINS = [
  'chat.openai.com',
  'chatgpt.com',
  'google.com'
];

/**
 * Check if a URL is allowed by our extension
 * @param url - The URL to validate
 * @returns true if the URL is on an allowed domain, false otherwise
 */
export function isAllowedDomain(url: string | undefined): boolean {
  if (!url) return false;
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    return ALLOWED_DOMAINS.some(domain => {
      // Check exact match or subdomain match
      return hostname === domain || 
             hostname.endsWith(`.${domain}`) ||
             (domain === 'google.com' && hostname.includes('google'));
    });
  } catch {
    return false;
  }
}

/**
 * Get a user-friendly error message for domain restrictions
 * @returns Error message explaining allowed domains
 */
export function getDomainRestrictionMessage(): string {
  return `Extension is not allowed on this domain. Allowed domains: ${ALLOWED_DOMAINS.join(', ')}`;
}

/**
 * Check if a tab has our content script based on URL
 * @param tab - Chrome tab object
 * @returns true if the tab can have our content script
 */
export function canAccessTab(tab: chrome.tabs.Tab | undefined): boolean {
  if (!tab || !tab.url) return false;
  return isAllowedDomain(tab.url);
}