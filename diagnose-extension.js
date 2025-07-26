// Diagnostic script for Semantest extension
// Run this in Chrome DevTools console on ChatGPT page

console.log('🔍 Semantest Extension Diagnostics');
console.log('==================================');

// 1. Check URL
console.log('\n📍 Current Page:');
console.log('URL:', window.location.href);
console.log('Is ChatGPT:', window.location.hostname.includes('chat.openai.com') || window.location.hostname.includes('chatgpt.com'));

// 2. Check Bridge
console.log('\n🌉 Bridge Status:');
console.log('semantestBridge exists:', typeof window.semantestBridge !== 'undefined');
if (window.semantestBridge) {
  console.log('Bridge methods:', Object.keys(window.semantestBridge));
}

// 3. Check Image Generator
console.log('\n🎨 Image Generator Status:');
console.log('chatGPTImageGenerator exists:', typeof window.chatGPTImageGenerator !== 'undefined');
if (window.chatGPTImageGenerator) {
  console.log('Available methods:', Object.keys(window.chatGPTImageGenerator));
}

// 4. Check Addon
console.log('\n📦 Addon Status:');
console.log('chatgptAddon exists:', typeof window.chatgptAddon !== 'undefined');
if (window.chatgptAddon) {
  console.log('Addon version:', window.chatgptAddon.version);
  console.log('Addon methods:', Object.keys(window.chatgptAddon));
}

// 5. Check Event Listeners
console.log('\n👂 Event Listeners:');
const hasSemantest = window._addEventListener ? 
  window._addEventListener.toString().includes('semantest') : 
  'Cannot determine';
console.log('Semantest listeners:', hasSemantest);

// 6. Check ChatGPT UI
console.log('\n🖥️ ChatGPT UI Elements:');
const elements = {
  'Prompt textarea': document.querySelector('#prompt-textarea'),
  'Send button': document.querySelector('button[data-testid="send-button"]'),
  'Tools button': document.querySelector('button[aria-haspopup="menu"]'),
  'Form': document.querySelector('form')
};

Object.entries(elements).forEach(([name, elem]) => {
  console.log(`${name}:`, elem ? '✅ Found' : '❌ Not found');
});

// 7. Test function
window.diagnoseSemantest = function() {
  console.log('\n🧪 Running full diagnostic...');
  
  // Test message dispatch
  try {
    window.dispatchEvent(new CustomEvent('semantest-message', {
      detail: { type: 'test', payload: 'diagnostic' }
    }));
    console.log('✅ Message dispatch successful');
  } catch (e) {
    console.error('❌ Message dispatch failed:', e);
  }
  
  // Test direct generation if available
  if (window.chatGPTImageGenerator?.generateImage) {
    console.log('🎨 Testing image generator...');
    window.chatGPTImageGenerator.generateImage('DIAGNOSTIC TEST')
      .then(r => console.log('✅ Generator test passed:', r))
      .catch(e => console.error('❌ Generator test failed:', e));
  }
  
  return {
    bridge: !!window.semantestBridge,
    generator: !!window.chatGPTImageGenerator,
    addon: !!window.chatgptAddon,
    ui: Object.entries(elements).filter(([,e]) => e).length
  };
};

console.log('\n💡 Run window.diagnoseSemantest() for full diagnostic');