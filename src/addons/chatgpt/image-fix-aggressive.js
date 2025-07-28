// AGGRESSIVE FIX for image download issues
console.log('🚨 AGGRESSIVE IMAGE FIX LOADED');

// Override the monitoring timeout globally
if (window.chatGPTImageDownloader) {
  const originalStart = window.chatGPTImageDownloader.startImageMonitoring;
  
  window.chatGPTImageDownloader.startImageMonitoring = function() {
    console.log('🚨 AGGRESSIVE FIX: Intercepting startImageMonitoring');
    
    // Clear any existing timeouts
    if (window._imageMonitoringTimeout) {
      clearTimeout(window._imageMonitoringTimeout);
    }
    
    // Call original function
    const result = originalStart.call(this);
    
    // Override timeout to 3 minutes (180000ms)
    window._imageMonitoringTimeout = setTimeout(() => {
      console.log('⏱️ AGGRESSIVE FIX: Stopping after 3 minutes');
      window.chatGPTImageDownloader.stopImageMonitoring();
    }, 180000); // 3 minutes
    
    return result;
  };
}

// Also fix the initial image capture
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚨 AGGRESSIVE FIX: Clearing any pre-existing image tracking');
  
  // Wait for page to fully load
  setTimeout(() => {
    if (window.chatGPTImageDownloader && window.chatGPTImageDownloader.clearDownloadedImages) {
      window.chatGPTImageDownloader.clearDownloadedImages();
      console.log('✅ Cleared downloaded images cache');
    }
  }, 2000);
});

console.log('🚨 AGGRESSIVE FIX READY');