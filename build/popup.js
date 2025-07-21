// Semantest Extension Popup Script
// Manages project selection, custom instructions, and ChatGPT integration

class SemantestPopup {
  constructor() {
    this.currentProject = null;
    this.projects = [];
    this.theme = 'light';
    this.initializeElements();
    this.bindEvents();
    this.loadData();
  }

  initializeElements() {
    // Header elements
    this.themeToggle = document.getElementById('theme-toggle');
    this.sunIcon = document.getElementById('sun-icon');
    this.moonIcon = document.getElementById('moon-icon');
    
    // Project elements
    this.projectDropdown = document.getElementById('project-select');
    this.projectName = document.getElementById('project-name');
    this.projectColor = document.getElementById('project-color');
    this.projectDropdownIcon = document.getElementById('dropdown-icon');
    
    // Custom instructions
    this.instructionsTextarea = document.getElementById('custom-instructions');
    this.charCount = document.getElementById('char-count');
    this.charCountCurrent = document.getElementById('char-count-current');
    
    // Quick prompt
    this.promptInput = document.getElementById('quick-prompt');
    
    // Action buttons
    this.newChatBtn = document.getElementById('new-chat-btn');
    this.continueBtn = document.getElementById('continue-btn');
    this.historyBtn = document.getElementById('history-btn');
    
    // Status bar
    this.statusIndicator = document.getElementById('status-indicator');
    this.statusText = document.getElementById('status-text');
    this.chatCount = document.getElementById('chat-count');
    
    // Project management modal
    this.projectModal = document.getElementById('project-modal');
    this.newProjectBtn = document.getElementById('new-project-btn');
    this.projectModalClose = document.getElementById('project-modal-close');
    this.projectNameInput = document.getElementById('project-name-input');
    this.colorOptions = document.querySelectorAll('.color-option');
    this.saveProjectBtn = document.getElementById('save-project-btn');
    this.cancelProjectBtn = document.getElementById('cancel-project-btn');
  }

  bindEvents() {
    // Theme toggle
    this.themeToggle.addEventListener('click', () => this.toggleTheme());
    
    // Project dropdown
    this.projectDropdown.addEventListener('click', () => this.toggleProjectMenu());
    
    // Custom instructions
    this.instructionsTextarea.addEventListener('input', () => this.updateCharCount());
    this.instructionsTextarea.addEventListener('change', () => this.saveInstructions());
    
    // Action buttons
    this.newChatBtn.addEventListener('click', () => this.createNewChat());
    this.continueBtn.addEventListener('click', () => this.continueChat());
    this.historyBtn.addEventListener('click', () => this.showHistory());
    
    // Quick prompt enter key
    this.promptInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendQuickPrompt();
      }
    });
    
    // Project modal
    if (this.newProjectBtn) {
      this.newProjectBtn.addEventListener('click', () => this.showProjectModal());
    }
    if (this.projectModalClose) {
      this.projectModalClose.addEventListener('click', () => this.hideProjectModal());
    }
    if (this.saveProjectBtn) {
      this.saveProjectBtn.addEventListener('click', () => this.saveNewProject());
    }
    if (this.cancelProjectBtn) {
      this.cancelProjectBtn.addEventListener('click', () => this.hideProjectModal());
    }
    
    // Color options
    this.colorOptions.forEach(option => {
      option.addEventListener('click', () => this.selectColor(option));
    });
    
    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'sync' && changes.projects) {
        this.projects = changes.projects.newValue || [];
        this.updateProjectUI();
      }
    });
  }

  async loadData() {
    try {
      // Load saved data
      const data = await chrome.storage.sync.get([
        'projects',
        'currentProjectId',
        'theme',
        'customInstructions'
      ]);
      
      this.projects = data.projects || this.getDefaultProjects();
      this.theme = data.theme || 'light';
      
      // Set theme
      document.documentElement.setAttribute('data-theme', this.theme);
      this.updateThemeIcon();
      
      // Load current project
      if (data.currentProjectId) {
        this.currentProject = this.projects.find(p => p.id === data.currentProjectId);
      }
      if (!this.currentProject && this.projects.length > 0) {
        this.currentProject = this.projects[0];
      }
      
      // Update UI
      this.updateProjectUI();
      this.updateInstructions();
      this.updateStatus();
      
      // Get today's chat count
      const today = new Date().toDateString();
      const chatData = await chrome.storage.local.get(['chatHistory']);
      const todayChats = (chatData.chatHistory || [])
        .filter(chat => new Date(chat.timestamp).toDateString() === today);
      this.chatCount.textContent = `${todayChats.length} chats today`;
      
    } catch (error) {
      console.error('Error loading data:', error);
      this.showError('Failed to load data');
    }
  }

  getDefaultProjects() {
    return [
      { id: 'default', name: 'General', color: '#10a37f' }
    ];
  }

  toggleTheme() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', this.theme);
    this.updateThemeIcon();
    chrome.storage.sync.set({ theme: this.theme });
  }

  updateThemeIcon() {
    if (this.theme === 'light') {
      this.sunIcon.style.display = 'block';
      this.moonIcon.style.display = 'none';
    } else {
      this.sunIcon.style.display = 'none';
      this.moonIcon.style.display = 'block';
    }
  }

  toggleProjectMenu() {
    // Simple implementation - in real app would show dropdown menu
    this.showProjectModal();
  }

  updateProjectUI() {
    if (this.currentProject) {
      this.projectName.textContent = this.currentProject.name;
      this.projectColor.style.backgroundColor = this.currentProject.color;
    }
  }

  updateInstructions() {
    if (this.currentProject) {
      const instructions = this.currentProject.instructions || '';
      this.instructionsTextarea.value = instructions;
      this.updateCharCount();
    }
  }

  updateCharCount() {
    const length = this.instructionsTextarea.value.length;
    this.charCountCurrent.textContent = length;
    
    if (length > 1400) {
      this.charCount.style.color = '#ff6b6b';
    } else if (length > 1200) {
      this.charCount.style.color = '#f59e0b';
    } else {
      this.charCount.style.color = '#6b7280';
    }
  }

  async saveInstructions() {
    if (!this.currentProject) return;
    
    this.currentProject.instructions = this.instructionsTextarea.value;
    
    // Update in storage
    const projectIndex = this.projects.findIndex(p => p.id === this.currentProject.id);
    if (projectIndex !== -1) {
      this.projects[projectIndex] = this.currentProject;
      await chrome.storage.sync.set({ projects: this.projects });
      
      // Show saved indicator
      this.charCount.style.color = '#10a37f';
      this.charCount.innerHTML = `${this.charCountCurrent.textContent} / 1500 ✓ Saved`;
      
      setTimeout(() => {
        this.updateCharCount();
      }, 2000);
    }
  }

  async createNewChat() {
    try {
      // Send message to content script
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab && (tab.url.includes('chat.openai.com') || tab.url.includes('chatgpt.com'))) {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'CREATE_NEW_CHAT',
          project: this.currentProject,
          prompt: this.promptInput.value
        });
        
        // Clear prompt
        this.promptInput.value = '';
        
        // Close popup
        window.close();
      } else {
        // Open ChatGPT in new tab
        chrome.tabs.create({ url: 'https://chat.openai.com' });
      }
    } catch (error) {
      console.error('Error creating new chat:', error);
      this.showError('Failed to create new chat');
    }
  }

  async continueChat() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab && (tab.url.includes('chat.openai.com') || tab.url.includes('chatgpt.com'))) {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'CONTINUE_CHAT',
          project: this.currentProject,
          prompt: this.promptInput.value
        });
        
        this.promptInput.value = '';
        window.close();
      } else {
        chrome.tabs.create({ url: 'https://chat.openai.com' });
      }
    } catch (error) {
      console.error('Error continuing chat:', error);
    }
  }

  showHistory() {
    // Open history page
    chrome.tabs.create({ url: chrome.runtime.getURL('history.html') });
  }

  async sendQuickPrompt() {
    const prompt = this.promptInput.value.trim();
    if (!prompt) return;
    
    await this.continueChat();
  }

  async updateStatus() {
    try {
      // Check connection to ChatGPT
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab && (tab.url.includes('chat.openai.com') || tab.url.includes('chatgpt.com'))) {
        this.statusIndicator.style.backgroundColor = '#10a37f';
        this.statusText.textContent = 'Connected';
      } else {
        this.statusIndicator.style.backgroundColor = '#6b7280';
        this.statusText.textContent = 'Not on ChatGPT';
      }
    } catch (error) {
      this.statusIndicator.style.backgroundColor = '#ff6b6b';
      this.statusText.textContent = 'Error';
    }
  }

  showProjectModal() {
    if (this.projectModal) {
      this.projectModal.style.display = 'flex';
      this.projectNameInput.focus();
    }
  }

  hideProjectModal() {
    if (this.projectModal) {
      this.projectModal.style.display = 'none';
      this.projectNameInput.value = '';
      this.colorOptions.forEach(opt => opt.classList.remove('selected'));
    }
  }

  selectColor(option) {
    this.colorOptions.forEach(opt => opt.classList.remove('selected'));
    option.classList.add('selected');
  }

  async saveNewProject() {
    const name = this.projectNameInput.value.trim();
    if (!name) return;
    
    const selectedColor = document.querySelector('.color-option.selected');
    const color = selectedColor ? selectedColor.dataset.color : '#10a37f';
    
    const newProject = {
      id: `project_${Date.now()}`,
      name,
      color,
      instructions: '',
      created: new Date().toISOString()
    };
    
    this.projects.push(newProject);
    this.currentProject = newProject;
    
    await chrome.storage.sync.set({
      projects: this.projects,
      currentProjectId: newProject.id
    });
    
    this.updateProjectUI();
    this.updateInstructions();
    this.hideProjectModal();
  }

  showError(message) {
    // Simple error display
    console.error(message);
    this.statusText.textContent = message;
    this.statusIndicator.style.backgroundColor = '#ff6b6b';
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new SemantestPopup();
});