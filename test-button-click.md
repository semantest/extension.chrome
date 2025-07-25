# Testing Button Click Manually

To test the button clicker directly in the ChatGPT console:

1. Open ChatGPT (chatgpt.com)
2. Open Chrome DevTools (F12)
3. Go to Console tab
4. Run this command:

```javascript
// Test clicking any button
window.clickChatGPTButton('any').then(console.log).catch(console.error);

// Or test specific buttons:
window.clickChatGPTButton('regenerate').then(console.log).catch(console.error);
window.clickChatGPTButton('new-chat').then(console.log).catch(console.error);
```

This will help us see:
1. If the button clicker function works correctly
2. What buttons are available on the page
3. Any errors that occur during clicking

## Expected Output

Success case:
```javascript
{
  success: true,
  message: "Successfully clicked any button",
  buttonInfo: {
    text: "Button text",
    ariaLabel: "Button label"
  }
}
```

Failure case:
```javascript
{
  success: false,
  error: "No any button found",
  availableButtons: [...]
}
```