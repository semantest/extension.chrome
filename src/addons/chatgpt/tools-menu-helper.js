// Helper to work with ChatGPT Tools menu
console.log('🔧 Tools Menu Helper loaded');

async function openToolsMenu() {
  console.log('🔍 Looking for Tools menu button...');
  
  // Find the tools button - based on Rydnr's observation
  const toolsButton = document.querySelector('button[id^="radix-"][aria-haspopup="menu"]') ||
                     document.querySelector('button[aria-label="Tools"]') ||
                     document.querySelector('button[title="Tools"]') ||
                     // Look for any button with SVG that might be tools
                     Array.from(document.querySelectorAll('button')).find(btn => 
                       btn.querySelector('svg') && 
                       btn.getAttribute('aria-haspopup') === 'menu' &&
                       btn.offsetParent
                     );
  
  if (!toolsButton) {
    console.error('❌ Tools button not found');
    return false;
  }
  
  console.log('✅ Found tools button:', toolsButton.id || 'no-id');
  console.log('📍 Button state:', {
    expanded: toolsButton.getAttribute('aria-expanded'),
    disabled: toolsButton.disabled
  });
  
  // Check if menu is already open
  if (toolsButton.getAttribute('aria-expanded') === 'true') {
    console.log('📂 Tools menu already open');
    return true;
  }
  
  // Click the button
  console.log('🖱️ Clicking tools button...');
  toolsButton.click();
  
  // Wait for menu to appear
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Verify menu opened
  const menuOpened = toolsButton.getAttribute('aria-expanded') === 'true' ||
                    document.querySelector('[role="menu"]') !== null;
  
  if (menuOpened) {
    console.log('✅ Tools menu opened successfully');
    return true;
  } else {
    console.log('⚠️ Tools menu might not have opened, trying again...');
    toolsButton.focus();
    toolsButton.click();
    await new Promise(resolve => setTimeout(resolve, 500));
    return true;
  }
}

async function findAndClickCreateImage() {
  console.log('🎨 Looking for "Create image" option...');
  
  // First open the tools menu
  const menuOpened = await openToolsMenu();
  if (!menuOpened) {
    return { success: false, error: 'Could not open tools menu' };
  }
  
  // Wait a bit for menu items to load
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Find all potential menu items
  const menuItems = [
    ...document.querySelectorAll('[role="menuitem"]'),
    ...document.querySelectorAll('[role="option"]'),
    ...document.querySelectorAll('button[class*="menu"]'),
    ...document.querySelectorAll('div[class*="menu"]'),
    ...document.querySelectorAll('li button'),
    ...document.querySelectorAll('[data-radix-collection-item]')
  ];
  
  console.log(`📋 Found ${menuItems.length} menu items`);
  
  // Look for "Create image" option
  let createImageOption = null;
  
  for (const item of menuItems) {
    const text = item.textContent?.trim() || '';
    const ariaLabel = item.getAttribute('aria-label') || '';
    
    // Debug log
    if (text || ariaLabel) {
      console.log(`  - "${text}" (aria: "${ariaLabel}")`);
    }
    
    if (text.toLowerCase().includes('create image') || 
        text.toLowerCase().includes('dall') ||
        ariaLabel.toLowerCase().includes('create image') ||
        ariaLabel.toLowerCase().includes('dall')) {
      createImageOption = item;
      console.log('🎯 Found "Create image" option!');
      break;
    }
  }
  
  if (!createImageOption) {
    console.error('❌ "Create image" option not found in menu');
    console.log('💡 Make sure you have access to DALL-E (ChatGPT Plus)');
    return { success: false, error: 'Create image option not found in Tools menu' };
  }
  
  // Click the option
  console.log('🖱️ Clicking "Create image" option...');
  createImageOption.click();
  
  // Wait for image mode to activate
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Check if we're in image mode
  const placeholder = document.querySelector('#prompt-textarea')?.getAttribute('placeholder');
  const inImageMode = placeholder?.toLowerCase().includes('image');
  
  if (inImageMode) {
    console.log('✅ Successfully activated image mode!');
    return { success: true, message: 'Image mode activated' };
  } else {
    console.log('⚠️ Not sure if image mode activated');
    return { success: true, message: 'Clicked Create image option' };
  }
}

// Export functions
window.toolsMenuHelper = {
  openToolsMenu,
  findAndClickCreateImage
};

console.log('💡 Use window.toolsMenuHelper.openToolsMenu() to open the tools menu');
console.log('💡 Use window.toolsMenuHelper.findAndClickCreateImage() to activate image mode');