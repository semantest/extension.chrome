# Testing State Detection

To help debug why image generation isn't being detected properly, please run this in the ChatGPT console:

## 1. While ChatGPT is generating an IMAGE:
```javascript
window.checkState()
```

## 2. Look for these specific elements:
```javascript
// Check for DALL-E tool messages
console.log('Tool messages:', document.querySelectorAll('[data-message-author-role="tool"]').length);

// Check for image-related text
const divs = Array.from(document.querySelectorAll('div'));
const imageTexts = divs.filter(div => {
  const text = div.textContent || '';
  return text.includes('image') || text.includes('DALL') || text.includes('generat');
});
console.log('Image-related divs:', imageTexts.length);

// Check last assistant message
const lastMsg = document.querySelector('[data-message-author-role="assistant"]:last-child');
console.log('Last assistant message:', lastMsg?.textContent?.substring(0, 100));

// Look for any canvas or image elements
console.log('Canvas elements:', document.querySelectorAll('canvas').length);
console.log('Image elements in messages:', document.querySelectorAll('[data-message-id] img').length);
```

## 3. Check for the actual image generation UI:
```javascript
// Look for specific DALL-E UI elements
console.log('DALL-E elements:');
console.log('- Thinking indicators:', document.querySelectorAll('[class*="thinking"]').length);
console.log('- Tool use indicators:', document.querySelectorAll('[class*="tool"]').length);
console.log('- Loading spinners:', document.querySelectorAll('[class*="spinner"], [class*="loading"]').length);
```

This will help us identify the correct selectors for image generation detection!