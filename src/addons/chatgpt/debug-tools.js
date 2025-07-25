// Debug helper to check ChatGPT tools availability
console.log('🔧 ChatGPT Debug Tools loaded');

function debugChatGPTInterface() {
  console.log('\n=== ChatGPT Interface Debug ===\n');
  
  // 1. Check current mode
  const textarea = document.querySelector('#prompt-textarea');
  const placeholder = textarea?.getAttribute('placeholder');
  console.log('📝 Current placeholder:', placeholder);
  console.log('🎯 In image mode?', placeholder?.toLowerCase().includes('image') ? 'YES' : 'NO');
  
  // 2. Find tools menu button
  const toolsMenuSelectors = [
    'button[aria-label="Main menu"]',
    'button[aria-label="Tools"]',
    'button[id*="radix"]',
    'button svg path[d*="M12"]', // Sparkle icon
    'button:has(svg path[d*="M12"])'
  ];
  
  let toolsButton = null;
  for (const selector of toolsMenuSelectors) {
    try {
      const btn = document.querySelector(selector);
      if (btn?.offsetParent) {
        toolsButton = btn;
        break;
      }
    } catch (e) {}
  }
  
  console.log('🔧 Tools menu button:', toolsButton ? 'FOUND' : 'NOT FOUND');
  if (toolsButton) {
    console.log('   Button:', toolsButton);
    console.log('   Aria-label:', toolsButton.getAttribute('aria-label'));
  }
  
  // 3. Check for image-related buttons
  console.log('\n🔍 Searching for image-related elements...');
  
  const allButtons = [...document.querySelectorAll('button'), 
                     ...document.querySelectorAll('div[role="button"]')];
  
  const imageRelated = allButtons.filter(btn => {
    const text = btn.textContent?.toLowerCase() || '';
    const aria = btn.getAttribute('aria-label')?.toLowerCase() || '';
    return (text.includes('image') || text.includes('dall') || 
            aria.includes('image') || aria.includes('dall')) && 
           btn.offsetParent;
  });
  
  console.log(`Found ${imageRelated.length} image-related buttons:`);
  imageRelated.forEach((btn, idx) => {
    console.log(`  ${idx + 1}. Text: "${btn.textContent?.trim()}"`, 
                `| Aria: "${btn.getAttribute('aria-label')}"`,
                `| Visible:`, btn.offsetParent !== null);
  });
  
  // 4. Check sparkle/tools buttons
  console.log('\n🌟 Looking for sparkle/tools buttons...');
  const sparkleButtons = allButtons.filter(btn => {
    // Check for sparkle SVG path
    const hasSparklePath = btn.querySelector('svg path[d*="M12 2"]') || 
                          btn.querySelector('svg path[d*="m12 2"]');
    return hasSparklePath && btn.offsetParent;
  });
  
  console.log(`Found ${sparkleButtons.length} sparkle buttons:`);
  sparkleButtons.forEach((btn, idx) => {
    console.log(`  ${idx + 1}. ID: "${btn.id}"`, 
                `| Aria: "${btn.getAttribute('aria-label')}"`,
                `| Class: "${btn.className}"`);
  });
  
  // 5. Instructions
  console.log('\n📚 Instructions:');
  console.log('1. If no image tools found, click the sparkle button (tools menu)');
  console.log('2. Enable "Create image" from the tools list');
  console.log('3. Then try: window.chatGPTImageGenerator.generateImage("test prompt")');
  console.log('\n===============================\n');
}

// Auto-run debug on load
debugChatGPTInterface();

// Export for manual use
window.debugChatGPT = debugChatGPTInterface;

console.log('💡 Run window.debugChatGPT() to check interface status');