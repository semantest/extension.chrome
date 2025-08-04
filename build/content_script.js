// Semantest ChatGPT Content Script
// Handles automation and interaction with ChatGPT interface

(function() {
  'use strict';

  class SemantestChatGPTController {
    constructor() {
      this.isInitialized = false;
      this.currentProject = null;
      this.customInstructions = '';
      this.init();
    }

    async init() {
      console.log('🚀 Semantest ChatGPT Controller initializing...');
      
      // Wait for ChatGPT interface to load
      await this.waitForChatGPT();
      
      // Set up message listener
      this.setupMessageListener();
      
      // Notify background script that we're ready
      chrome.runtime.sendMessage({
        action: 'CONTROLLER_READY',
        data: { url: window.location.href }
      });
      
      this.isInitialized = true;
      console.log('✅ Semantest ChatGPT Controller ready');
    }

    async waitForChatGPT() {
      // Wait for ChatGPT's main input textarea to be available
      const maxAttempts = 50;
      let attempts = 0;
      
      while (attempts < maxAttempts) {
        const textarea = document.querySelector('textarea[data-id="root"]') || 
                        document.querySelector('textarea[placeholder*="Send a message"]') ||
                        document.querySelector('textarea[id="prompt-textarea"]');
        
        if (textarea) {
          console.log('✅ ChatGPT interface detected');
          return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }
      
      throw new Error('ChatGPT interface not found');
    }

    setupMessageListener() {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log('📨 Content script received message:', request);
        
        // Handle async operations
        (async () => {
          try {
            let response;
            
            switch (request.action) {
              case 'GET_STATUS':
                response = { 
                  success: true, 
                  isReady: this.isInitialized,
                  url: window.location.href
                };
                break;
                
              case 'SEND_PROMPT':
                response = await this.sendPrompt(request.data);
                break;
                
              case 'CREATE_NEW_CHAT':
                response = await this.createNewChat(request.data);
                break;
                
              case 'CREATE_PROJECT':
                response = await this.createProject(request.data);
                break;
                
              case 'CONTINUE_CHAT':
                response = await this.continueChat();
                break;
                
              case 'OPEN_HISTORY':
                response = await this.openHistory();
                break;
                
              case 'DOWNLOAD_IMAGE':
                response = await this.downloadImage(request.data);
                break;
                
              default:
                response = { success: false, error: 'Unknown action' };
            }
            
            sendResponse(response);
          } catch (error) {
            console.error('❌ Error handling message:', error);
            sendResponse({ success: false, error: error.message });
          }
        })();
        
        return true; // Keep message channel open for async response
      });
    }

    async sendPrompt(data) {
      try {
        const { text, customInstructions, project } = data;
        
        // Find the textarea
        const textarea = this.findTextarea();
        if (!textarea) {
          throw new Error('ChatGPT input not found');
        }
        
        // Build the full prompt
        let fullPrompt = '';
        if (customInstructions) {
          fullPrompt = `${customInstructions}\n\n${text}`;
        } else {
          fullPrompt = text;
        }
        
        // Set the value and trigger events
        textarea.value = fullPrompt;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Find and click the send button
        await new Promise(resolve => setTimeout(resolve, 100));
        const sendButton = this.findSendButton();
        if (sendButton) {
          sendButton.click();
        } else {
          // Try pressing Enter as fallback
          const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true
          });
          textarea.dispatchEvent(enterEvent);
        }
        
        return { success: true };
      } catch (error) {
        console.error('❌ Failed to send prompt:', error);
        return { success: false, error: error.message };
      }
    }

    async createNewChat(data) {
      try {
        // Click the New Chat button
        const newChatButton = document.querySelector('a[href="/"]') ||
                             document.querySelector('button:has(svg.icon-md)') ||
                             document.querySelector('[class*="new-chat"]');
        
        if (newChatButton) {
          newChatButton.click();
          
          // Wait for new chat to load
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // If custom instructions provided, send them
          if (data.customInstructions) {
            await this.sendPrompt({
              text: 'Starting new conversation',
              customInstructions: data.customInstructions
            });
          }
          
          return { success: true };
        } else {
          throw new Error('New chat button not found');
        }
      } catch (error) {
        console.error('❌ Failed to create new chat:', error);
        return { success: false, error: error.message };
      }
    }

    async createProject(data) {
      try {
        // ChatGPT doesn't have native project support, so we'll simulate it
        // by creating a new chat with project context
        const projectPrompt = `[Project: ${data.name}]\n\nThis conversation is part of the "${data.name}" project.`;
        
        await this.createNewChat({
          customInstructions: projectPrompt
        });
        
        return { success: true };
      } catch (error) {
        console.error('❌ Failed to create project:', error);
        return { success: false, error: error.message };
      }
    }

    async continueChat() {
      try {
        // Find the continue button if conversation was interrupted
        const continueButton = document.querySelector('button[class*="continue"]') ||
                              document.querySelector('button:contains("Continue generating")');
        
        if (continueButton) {
          continueButton.click();
          return { success: true };
        }
        
        // If no continue button, send a continuation prompt
        return await this.sendPrompt({ text: 'Please continue' });
      } catch (error) {
        console.error('❌ Failed to continue chat:', error);
        return { success: false, error: error.message };
      }
    }

    async openHistory() {
      try {
        // Try to find and click the history/sidebar button
        const historyButton = document.querySelector('button[aria-label*="history"]') ||
                             document.querySelector('button[aria-label*="sidebar"]') ||
                             document.querySelector('[class*="sidebar-toggle"]');
        
        if (historyButton) {
          historyButton.click();
          return { success: true };
        }
        
        // Fallback: navigate to the root URL which shows chat list
        window.location.href = 'https://chat.openai.com/';
        return { success: true };
      } catch (error) {
        console.error('❌ Failed to open history:', error);
        return { success: false, error: error.message };
      }
    }

    async downloadImage(data) {
      try {
        const { url, filename } = data;
        
        // Find images in the conversation
        const images = document.querySelectorAll('img[src*="dalle"], img[src*="openai"]');
        
        if (images.length === 0) {
          throw new Error('No images found in conversation');
        }
        
        // Create download link
        const link = document.createElement('a');
        link.href = url || images[0].src;
        link.download = filename || `chatgpt-image-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        return { success: true };
      } catch (error) {
        console.error('❌ Failed to download image:', error);
        return { success: false, error: error.message };
      }
    }

    // Helper methods
    findTextarea() {
      return document.querySelector('textarea[data-id="root"]') || 
             document.querySelector('textarea[placeholder*="Send a message"]') ||
             document.querySelector('textarea[id="prompt-textarea"]') ||
             document.querySelector('textarea');
    }

    findSendButton() {
      return document.querySelector('button[data-testid="send-button"]') ||
             document.querySelector('button[aria-label*="Send"]') ||
             document.querySelector('button:has(svg[class*="submit"])') ||
             document.querySelector('button[class*="send"]');
    }
  }

  // Initialize controller
  const controller = new SemantestChatGPTController();
  
  // Make it available globally for debugging
  window.semantestController = controller;
})();