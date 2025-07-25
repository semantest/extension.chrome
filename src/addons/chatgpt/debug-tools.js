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
  console.log('
🔍 Looking for tools/menu buttons...');
  
  // Look for buttons with SVG icons that might be the tools menu
  const allButtons = [...document.querySelectorAll('button')];
  const menuButtons = allButtons.filter(btn => {
    // Check if button has an SVG child
    const hasSvg = btn.querySelector('svg') !== null;
    // Check if it's visible
    const isVisible = btn.offsetParent !== null;
    // Check if it has menu attributes
    const hasMenuAttrs = btn.getAttribute('aria-haspopup') === 'menu' || 
                        btn.getAttribute('data-state') === 'closed' ||
                        btn.getAttribute('data-state') === 'open';
    
    return isVisible && (hasSvg || hasMenuAttrs);
  });
  
  console.log(`Found ${menuButtons.length} potential menu buttons:`);
  menuButtons.forEach((btn, idx) => {
    const svgPath = btn.querySelector('svg path')?.getAttribute('d')?.substring(0, 50) || 'no path';
    console.log(`  ${idx + 1}. ID: "${btn.id}"`,
                `| Class: "${btn.className}"`,
                `| Aria-haspopup: "${btn.getAttribute('aria-haspopup')}"`,
                `| SVG path: "${svgPath}..."`);
  });
  
  // Check for the specific button found
  const toolsButton = document.querySelector('button[id^="radix-"][aria-haspopup="menu"]');
  console.log('
🔧 Tools menu button:', toolsButton ? 'FOUND' : 'NOT FOUND');
  if (toolsButton) {
    console.log('   Button ID:', toolsButton.id);
    console.log('   Has SVG:', toolsButton.querySelector('svg') !== null);
    console.log('   Is expanded:', toolsButton.getAttribute('aria-expanded'));
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
  
  // 4. Check for "Create image" in the current interface
  console.log('\n🌟 Looking for "Create image" tool...');
  
  // Sometimes the tool is already in the interface as a button
  const createImageButtons = allButtons.filter(btn => {
    const text = btn.textContent?.toLowerCase() || '';
    const aria = btn.getAttribute('aria-label')?.toLowerCase() || '';
    return (text.includes('create image') || aria.includes('create image')) && 
           btn.offsetParent;
  });
  
  if (createImageButtons.length > 0) {
    console.log(`✅ Found ${createImageButtons.length} "Create image" buttons:`);
    createImageButtons.forEach((btn, idx) => {
      console.log(`  ${idx + 1}. Text: "${btn.textContent?.trim()}"`,
                  `| Visible: ${btn.offsetParent !== null}`);
    });
  } else {
    console.log('❌ No "Create image" buttons found in current interface');
  }
  
  // 5. Instructions
  console.log('\n📚 Instructions:');
  
  if (toolsButton) {
    console.log(`1. Click the tools menu button: document.querySelector('#${toolsButton.id}').click()`);
    console.log('2. Look for "Create image" or "DALL-E" in the menu that appears');
    console.log('3. Enable it by clicking on it');
    console.log('4. Then try: window.chatGPTImageGenerator.generateImage("test prompt")');
  } else {
    console.log('1. Look for a button with a sparkle icon (✨) or menu icon');
    console.log('2. Click it to open the tools menu');
    console.log('3. Enable "Create image" from the tools list');
    console.log('4. Then try: window.chatGPTImageGenerator.generateImage("test prompt")');
  }
  
  console.log('\n💁 Quick test: Try typing "/imagine" in the input field');
  console.log('\n===============================\n');
}

// Auto-run debug on load
debugChatGPTInterface();

// Export for manual use
window.debugChatGPT = debugChatGPTInterface;

console.log('💡 Run window.debugChatGPT() to check interface status');