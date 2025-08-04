// Semantest Storage Manager
// Provides persistent storage for ChatGPT interactions and settings

(function() {
  'use strict';

  class SemantestStorage {
    constructor() {
      this.storageKey = 'semantest_data';
      this.init();
    }

    async init() {
      // Initialize with default values if needed
      const data = await this.getAll();
      if (!data.initialized) {
        await this.setDefaults();
      }
    }

    async setDefaults() {
      const defaults = {
        initialized: true,
        projects: {},
        customInstructions: {},
        chatHistory: [],
        settings: {
          theme: 'light',
          autoSave: true,
          notifications: true
        }
      };
      
      await chrome.storage.local.set({ [this.storageKey]: defaults });
    }

    async getAll() {
      const result = await chrome.storage.local.get(this.storageKey);
      return result[this.storageKey] || {};
    }

    async get(key) {
      const data = await this.getAll();
      return data[key];
    }

    async set(key, value) {
      const data = await this.getAll();
      data[key] = value;
      await chrome.storage.local.set({ [this.storageKey]: data });
    }

    async addProject(project) {
      const data = await this.getAll();
      if (!data.projects) data.projects = {};
      data.projects[project.id] = project;
      await chrome.storage.local.set({ [this.storageKey]: data });
    }

    async getProjects() {
      const data = await this.getAll();
      return data.projects || {};
    }

    async saveCustomInstructions(projectId, instructions) {
      const data = await this.getAll();
      if (!data.customInstructions) data.customInstructions = {};
      data.customInstructions[projectId] = instructions;
      await chrome.storage.local.set({ [this.storageKey]: data });
    }

    async getCustomInstructions(projectId) {
      const data = await this.getAll();
      return data.customInstructions?.[projectId] || '';
    }

    async addChatHistoryEntry(entry) {
      const data = await this.getAll();
      if (!data.chatHistory) data.chatHistory = [];
      data.chatHistory.push({
        ...entry,
        timestamp: new Date().toISOString()
      });
      
      // Keep only last 100 entries
      if (data.chatHistory.length > 100) {
        data.chatHistory = data.chatHistory.slice(-100);
      }
      
      await chrome.storage.local.set({ [this.storageKey]: data });
    }

    async getChatHistory(limit = 50) {
      const data = await this.getAll();
      const history = data.chatHistory || [];
      return history.slice(-limit);
    }

    async updateSettings(newSettings) {
      const data = await this.getAll();
      data.settings = { ...data.settings, ...newSettings };
      await chrome.storage.local.set({ [this.storageKey]: data });
    }

    async getSettings() {
      const data = await this.getAll();
      return data.settings || {};
    }

    async clearAll() {
      await chrome.storage.local.remove(this.storageKey);
      await this.setDefaults();
    }
  }

  // Make storage available globally
  window.semantestStorage = new SemantestStorage();
})();