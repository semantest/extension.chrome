// Debug script to analyze all buttons near the input
console.log('🔍 Analyzing all buttons near input...');

const input = document.querySelector('#prompt-textarea') || 
             document.querySelector('[contenteditable="true"]');

if (input) {
  const form = input.closest('form') || input.parentElement?.parentElement;
  if (form) {
    const buttons = form.querySelectorAll('button:not([disabled])');
    
    console.log(`Found ${buttons.length} buttons:`);
    
    buttons.forEach((btn, idx) => {
      const ariaLabel = btn.getAttribute('aria-label') || '';
      const title = btn.getAttribute('title') || '';
      const svgPaths = Array.from(btn.querySelectorAll('svg path')).map(p => {
        const d = p.getAttribute('d') || '';
        return d.substring(0, 30) + '...'; // First 30 chars of path
      });
      
      console.log(`\nButton ${idx}:`, {
        id: btn.id,
        className: btn.className.substring(0, 50),
        ariaLabel: ariaLabel,
        title: title,
        type: btn.type,
        visible: btn.offsetParent !== null,
        svgPaths: svgPaths,
        innerHTML: btn.innerHTML.substring(0, 100)
      });
    });
  }
}

// Export function to run the check
window.debugButtons = function() {
  console.log('🔍 Running button debug...');
  const form = document.querySelector('#prompt-textarea')?.closest('form');
  if (form) {
    const buttons = form.querySelectorAll('button');
    return Array.from(buttons).map(btn => ({
      id: btn.id,
      ariaLabel: btn.getAttribute('aria-label'),
      visible: btn.offsetParent !== null,
      disabled: btn.disabled
    }));
  }
  return [];
};