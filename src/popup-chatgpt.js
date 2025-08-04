// ChatGPT Extension Popup Script
// Provides UI for ChatGPT automation and project management

class ChatGPTPopupController {
  constructor() {
    this.state = {
      activeProject: 'Marketing Campaign',
      customInstructions: 'You are a helpful marketing assistant focused on creating engaging content that drives conversions.',
      connectionStatus: 'connected',
      chatCount: 15,
      theme: 'light'
    };

    this.initializeElements();
    this.bindEvents();
    this.loadState();
    this.updateUI();
  }

  initializeElements() {
    // Theme
    this.popupContainer = document.querySelector('.popup-container');
    this.themeToggle = document.getElementById('themeToggle');

    // Project
    this.projectDropdown = document.getElementById('projectDropdown');
    this.projectMenu = document.getElementById('projectMenu');
    this.projectName = document.querySelector('.project-name');
    this.newProjectBtn = document.getElementById('newProjectBtn');

    // Instructions
    this.instructionsTextarea = document.getElementById('instructionsTextarea');
    this.charCount = document.getElementById('charCount');
    this.saveInstructionsBtn = document.getElementById('saveInstructionsBtn');
    this.templateBtn = document.getElementById('templateBtn');

    // Prompt
    this.promptTextarea = document.getElementById('promptTextarea');
    this.clearPromptBtn = document.getElementById('clearPromptBtn');
    this.sendPromptBtn = document.getElementById('sendPromptBtn');

    // Actions
    this.newChatBtn = document.getElementById('newChatBtn');
    this.continueBtn = document.getElementById('continueBtn');
    this.historyBtn = document.getElementById('historyBtn');

    // Status
    this.statusDot = document.querySelector('.status-dot');
    this.statusText = document.querySelector('.status-text');
    this.chatCountElement = document.querySelector('.status-item:nth-child(3) .status-text');
  }

  bindEvents() {
    // Theme toggle
    this.themeToggle.addEventListener('click', () => this.toggleTheme());

    // Project dropdown
    this.projectDropdown.addEventListener('click', () => this.toggleProjectMenu());
    document.addEventListener('click', (e) => {
      if (!this.projectDropdown.contains(e.target) && !this.projectMenu.contains(e.target)) {
        this.projectMenu.classList.add('hidden');
      }
    });

    // Project selection
    this.projectMenu.querySelectorAll('.project-item:not(.new-project)').forEach(item => {
      item.addEventListener('click', () => this.selectProject(item));
    });

    // New project
    this.newProjectBtn.addEventListener('click', () => this.createNewProject());
    this.projectMenu.querySelector('.new-project').addEventListener('click', () => this.createNewProject());

    // Instructions
    this.instructionsTextarea.addEventListener('input', () => this.updateCharCount());
    this.saveInstructionsBtn.addEventListener('click', () => this.saveInstructions());
    this.templateBtn.addEventListener('click', () => this.showTemplates());

    // Prompt actions
    this.clearPromptBtn.addEventListener('click', () => this.clearPrompt());
    this.sendPromptBtn.addEventListener('click', () => this.sendPrompt());
    this.promptTextarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        this.sendPrompt();
      }
    });

    // Main actions
    this.newChatBtn.addEventListener('click', () => this.createNewChat());
    this.continueBtn.addEventListener('click', () => this.continueChat());
    this.historyBtn.addEventListener('click', () => this.openHistory());
  }

  async loadState() {
    try {
      // Load saved state from chrome.storage
      const result = await chrome.storage.sync.get([
        'activeProject',
        'customInstructions',
        'theme',
        'projects'
      ]);

      if (result.activeProject) {
        this.state.activeProject = result.activeProject;
        this.projectName.textContent = result.activeProject;
      }

      if (result.customInstructions) {
        this.state.customInstructions = result.customInstructions;
        this.instructionsTextarea.value = result.customInstructions;
      }

      if (result.theme) {
        this.state.theme = result.theme;
        this.popupContainer.setAttribute('data-theme', result.theme);
      }

      // Update character count
      this.updateCharCount();

      // Check connection status
      await this.checkConnectionStatus();

    } catch (error) {
      console.error('Failed to load state:', error);
    }
  }

  async checkConnectionStatus() {
    try {
      // Send message to background script to check if ChatGPT tab is available
      const response = await chrome.runtime.sendMessage({ 
        action: 'GET_EXTENSION_STATE' 
      });

      if (response && response.state) {
        const hasActiveTab = response.state.activeChatGPTTab !== null;
        this.updateConnectionStatus(hasActiveTab);
        
        // Update chat count if available
        if (response.state.chatGPTTabsCount) {
          this.chatCountElement.textContent = `${response.state.chatGPTTabsCount} tabs open`;
        }
      }
    } catch (error) {
      console.error('Failed to check connection status:', error);
      this.updateConnectionStatus(false);
    }
  }

  updateConnectionStatus(connected) {
    this.state.connectionStatus = connected ? 'connected' : 'disconnected';
    
    if (connected) {
      this.statusDot.classList.remove('disconnected');
      this.statusDot.classList.add('active');
      this.statusText.textContent = 'Connected';
    } else {
      this.statusDot.classList.remove('active');
      this.statusDot.classList.add('disconnected');
      this.statusText.textContent = 'No ChatGPT tab';
    }

    // Enable/disable action buttons based on connection
    const actionButtons = [this.sendPromptBtn, this.newChatBtn, this.continueBtn];
    actionButtons.forEach(btn => {
      btn.disabled = !connected;
      if (!connected) {
        btn.classList.add('disabled');
      } else {
        btn.classList.remove('disabled');
      }
    });
  }

  toggleTheme() {
    this.state.theme = this.state.theme === 'light' ? 'dark' : 'light';
    this.popupContainer.setAttribute('data-theme', this.state.theme);
    chrome.storage.sync.set({ theme: this.state.theme });
  }

  toggleProjectMenu() {
    this.projectMenu.classList.toggle('hidden');
  }

  selectProject(item) {
    // Remove active state from all items
    this.projectMenu.querySelectorAll('.project-item').forEach(i => {
      i.classList.remove('active');
    });

    // Add active state to selected item
    item.classList.add('active');

    // Update project name
    const projectName = item.querySelector('span').textContent;
    this.state.activeProject = projectName;
    this.projectName.textContent = projectName;

    // Save to storage
    chrome.storage.sync.set({ activeProject: projectName });

    // Hide menu
    this.projectMenu.classList.add('hidden');

    // Load project-specific instructions if available
    this.loadProjectInstructions(projectName);
  }

  async loadProjectInstructions(projectName) {
    try {
      const result = await chrome.storage.sync.get(['projectInstructions']);
      if (result.projectInstructions && result.projectInstructions[projectName]) {
        this.instructionsTextarea.value = result.projectInstructions[projectName];
        this.updateCharCount();
      }
    } catch (error) {
      console.error('Failed to load project instructions:', error);
    }
  }

  async createNewProject() {
    const projectName = prompt('Enter project name:');
    if (!projectName) return;

    try {
      // Send message to background script
      const response = await chrome.runtime.sendMessage({
        action: 'CREATE_PROJECT',
        data: { name: projectName }
      });

      if (response && response.success) {
        // Add to UI
        const newItem = document.createElement('div');
        newItem.className = 'project-item';
        newItem.innerHTML = `
          <div class="project-indicator indicator-primary"></div>
          <span>${projectName}</span>
        `;
        
        // Insert before the divider
        const divider = this.projectMenu.querySelector('.menu-divider');
        divider.parentNode.insertBefore(newItem, divider);

        // Bind click event
        newItem.addEventListener('click', () => this.selectProject(newItem));

        // Select the new project
        this.selectProject(newItem);
      }
    } catch (error) {
      console.error('Failed to create project:', error);
      alert('Failed to create project. Please make sure ChatGPT is open.');
    }
  }

  updateCharCount() {
    const length = this.instructionsTextarea.value.length;
    this.charCount.textContent = `${length} / 1500`;
    
    if (length > 1500) {
      this.charCount.classList.add('error');
    } else {
      this.charCount.classList.remove('error');
    }
  }

  async saveInstructions() {
    const instructions = this.instructionsTextarea.value;
    
    try {
      // Save general instructions
      await chrome.storage.sync.set({ customInstructions: instructions });
      
      // Save project-specific instructions
      const result = await chrome.storage.sync.get(['projectInstructions']);
      const projectInstructions = result.projectInstructions || {};
      projectInstructions[this.state.activeProject] = instructions;
      await chrome.storage.sync.set({ projectInstructions });

      // Visual feedback
      this.saveInstructionsBtn.classList.add('success');
      setTimeout(() => {
        this.saveInstructionsBtn.classList.remove('success');
      }, 2000);

    } catch (error) {
      console.error('Failed to save instructions:', error);
    }
  }

  showTemplates() {
    // TODO: Implement template selection UI
    alert('Template selection coming soon!');
  }

  clearPrompt() {
    this.promptTextarea.value = '';
    this.promptTextarea.focus();
  }

  async sendPrompt() {
    const prompt = this.promptTextarea.value.trim();
    if (!prompt) return;

    try {
      // Send to ChatGPT via background script
      const response = await chrome.runtime.sendMessage({
        action: 'EXECUTE_COMMAND',
        command: 'SEND_PROMPT',
        data: { 
          text: prompt,
          customInstructions: this.instructionsTextarea.value,
          project: this.state.activeProject
        }
      });

      if (response && response.success) {
        // Clear prompt after sending
        this.clearPrompt();
        
        // Close popup
        window.close();
      } else {
        throw new Error(response?.error || 'Failed to send prompt');
      }
    } catch (error) {
      console.error('Failed to send prompt:', error);
      alert('Failed to send prompt. Please make sure ChatGPT is open and try again.');
    }
  }

  async createNewChat() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'EXECUTE_COMMAND',
        command: 'CREATE_NEW_CHAT',
        data: {
          project: this.state.activeProject,
          customInstructions: this.instructionsTextarea.value
        }
      });

      if (response && response.success) {
        window.close();
      }
    } catch (error) {
      console.error('Failed to create new chat:', error);
      alert('Failed to create new chat. Please make sure ChatGPT is open.');
    }
  }

  async continueChat() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'EXECUTE_COMMAND',
        command: 'CONTINUE_CHAT',
        data: {}
      });

      if (response && response.success) {
        window.close();
      }
    } catch (error) {
      console.error('Failed to continue chat:', error);
    }
  }

  async openHistory() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'EXECUTE_COMMAND',
        command: 'OPEN_HISTORY',
        data: {}
      });

      if (response && response.success) {
        window.close();
      }
    } catch (error) {
      console.error('Failed to open history:', error);
    }
  }

  updateUI() {
    // Set initial theme
    this.popupContainer.setAttribute('data-theme', this.state.theme);
    
    // Update character count
    this.updateCharCount();
    
    // Check connection status periodically
    setInterval(() => {
      this.checkConnectionStatus();
    }, 2000);
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ChatGPTPopupController();
});