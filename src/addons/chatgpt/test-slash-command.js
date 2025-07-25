// Test slash command for image generation
console.log('🎯 Testing slash command approach...');

async function testSlashCommand(prompt = "A beautiful sunset") {
  try {
    // Find the main input
    const input = document.querySelector('#prompt-textarea') || 
                 document.querySelector('[contenteditable="true"]');
    
    if (!input) {
      console.error('❌ No input field found');
      return;
    }
    
    console.log('📝 Found input field');
    
    // Focus and clear
    input.focus();
    input.click();
    
    // Try the /imagine command
    const slashCommand = `/imagine ${prompt}`;
    console.log(`💬 Entering: "${slashCommand}"`);
    
    if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
      input.value = slashCommand;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      // ContentEditable
      input.innerHTML = '';
      const paragraph = document.createElement('p');
      paragraph.textContent = slashCommand;
      input.appendChild(paragraph);
      
      input.dispatchEvent(new InputEvent('input', { 
        bubbles: true, 
        cancelable: true,
        data: slashCommand 
      }));
    }
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check if slash command menu appeared
    const slashMenu = document.querySelector('[role="menu"]') || 
                     document.querySelector('[class*="slash"]') ||
                     document.querySelector('[class*="command"]');
    
    if (slashMenu) {
      console.log('✅ Slash command menu appeared!');
      
      // Look for image option
      const imageOption = Array.from(slashMenu.querySelectorAll('*')).find(el => 
        el.textContent?.toLowerCase().includes('image') ||
        el.textContent?.toLowerCase().includes('dall')
      );
      
      if (imageOption) {
        console.log('🎨 Found image option, clicking...');
        imageOption.click();
      }
    } else {
      console.log('❌ No slash command menu found');
      console.log('💡 Try pressing Enter to send the command');
      
      // Try sending with Enter
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        bubbles: true,
        cancelable: true
      });
      input.dispatchEvent(enterEvent);
    }
    
    return { success: true, method: 'slash_command' };
    
  } catch (error) {
    console.error('❌ Error:', error);
    return { success: false, error: error.message };
  }
}

// Export for use
window.testSlashCommand = testSlashCommand;

console.log('💡 Use window.testSlashCommand("your prompt") to test slash commands');
console.log('💡 Or just type /imagine in the input field');