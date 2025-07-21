// Semantest Feedback System JavaScript

class FeedbackSystem {
    constructor() {
        this.currentTab = 'feedback';
        this.rating = 0;
        this.metrics = {
            totalChats: 0,
            activeProjects: 0,
            imagesSaved: 0,
            timeSaved: 0
        };
        this.initializeElements();
        this.bindEvents();
        this.loadData();
        this.checkForUpdates();
    }

    initializeElements() {
        // Navigation
        this.navTabs = document.querySelectorAll('.nav-tab');
        this.tabContents = document.querySelectorAll('.tab-content');
        
        // Feedback form
        this.stars = document.querySelectorAll('.star');
        this.feedbackType = document.getElementById('feedback-type');
        this.feedbackMessage = document.getElementById('feedback-message');
        this.feedbackEmail = document.getElementById('feedback-email');
        this.submitFeedback = document.getElementById('submit-feedback');
        this.charCount = document.querySelector('.char-count');
        
        // Issue form
        this.quickIssueBtns = document.querySelectorAll('.quick-issue-btn');
        this.issueCategory = document.getElementById('issue-category');
        this.issueDescription = document.getElementById('issue-description');
        this.stepsContainer = document.getElementById('steps-container');
        this.addStepBtn = document.querySelector('.add-step-btn');
        this.includeDiagnostics = document.getElementById('include-diagnostics');
        this.submitIssue = document.getElementById('submit-issue');
        
        // Updates
        this.updateNotification = document.getElementById('update-available');
        this.newVersion = document.getElementById('new-version');
        this.updateBtn = document.querySelector('.update-button');
        this.autoUpdate = document.getElementById('auto-update');
        this.updateNotifications = document.getElementById('update-notifications');
        
        // Metrics
        this.totalChatsEl = document.getElementById('total-chats');
        this.activeProjectsEl = document.getElementById('active-projects');
        this.imagesSavedEl = document.getElementById('images-saved');
        this.timeSavedEl = document.getElementById('time-saved');
        
        // Success message
        this.successMessage = document.getElementById('success-message');
        
        // Close button
        this.closeBtn = document.getElementById('close-feedback');
    }

    bindEvents() {
        // Navigation
        this.navTabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });
        
        // Close button
        this.closeBtn.addEventListener('click', () => this.close());
        
        // Star rating
        this.stars.forEach((star, index) => {
            star.addEventListener('click', () => this.setRating(index + 1));
            star.addEventListener('mouseenter', () => this.previewRating(index + 1));
        });
        
        document.querySelector('.star-rating').addEventListener('mouseleave', () => {
            this.updateStarDisplay(this.rating);
        });
        
        // Feedback form
        this.feedbackMessage.addEventListener('input', () => this.updateCharCount());
        this.submitFeedback.addEventListener('click', () => this.handleFeedbackSubmit());
        
        // Quick issues
        this.quickIssueBtns.forEach(btn => {
            btn.addEventListener('click', () => this.selectQuickIssue(btn));
        });
        
        // Add step button
        this.addStepBtn.addEventListener('click', () => this.addStep());
        
        // Issue form
        this.submitIssue.addEventListener('click', () => this.handleIssueSubmit());
        
        // Update button
        this.updateBtn.addEventListener('click', () => this.installUpdate());
        
        // Update preferences
        this.autoUpdate.addEventListener('change', () => this.saveUpdatePreferences());
        this.updateNotifications.addEventListener('change', () => this.saveUpdatePreferences());
    }

    async loadData() {
        try {
            // Load metrics
            const data = await chrome.storage.local.get([
                'chatHistory',
                'projects',
                'downloadedImages',
                'updatePreferences'
            ]);
            
            // Calculate metrics
            this.metrics.totalChats = (data.chatHistory || []).length;
            this.metrics.activeProjects = (data.projects || []).length;
            this.metrics.imagesSaved = (data.downloadedImages || []).length;
            this.metrics.timeSaved = Math.round(this.metrics.totalChats * 5 / 60); // 5 min per chat
            
            // Update UI
            this.updateMetricsDisplay();
            
            // Load update preferences
            if (data.updatePreferences) {
                this.autoUpdate.checked = data.updatePreferences.autoUpdate !== false;
                this.updateNotifications.checked = data.updatePreferences.notifications !== false;
            }
            
            // Generate activity chart
            this.generateActivityChart(data.chatHistory || []);
            
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    switchTab(tabName) {
        this.currentTab = tabName;
        
        // Update nav tabs
        this.navTabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        
        // Update content
        this.tabContents.forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });
        
        // Track tab switch
        this.trackEvent('tab_switch', { tab: tabName });
    }

    setRating(rating) {
        this.rating = rating;
        this.updateStarDisplay(rating);
    }

    previewRating(rating) {
        this.updateStarDisplay(rating);
    }

    updateStarDisplay(rating) {
        this.stars.forEach((star, index) => {
            star.classList.toggle('active', index < rating);
        });
    }

    updateCharCount() {
        const length = this.feedbackMessage.value.length;
        this.charCount.textContent = `${length} / 500`;
        
        if (length > 500) {
            this.feedbackMessage.value = this.feedbackMessage.value.substring(0, 500);
        }
    }

    async handleFeedbackSubmit() {
        const feedback = {
            rating: this.rating,
            type: this.feedbackType.value,
            message: this.feedbackMessage.value.trim(),
            email: this.feedbackEmail.value.trim(),
            timestamp: new Date().toISOString(),
            version: chrome.runtime.getManifest().version,
            browser: navigator.userAgent
        };
        
        // Validate
        if (!feedback.rating || !feedback.message) {
            this.showError('Please provide a rating and message');
            return;
        }
        
        // Disable button
        this.submitFeedback.disabled = true;
        this.submitFeedback.textContent = 'Sending...';
        
        try {
            // Send feedback
            await this.sendFeedback(feedback);
            
            // Show success
            this.showSuccess('Thank you! Your feedback has been sent.');
            
            // Reset form
            this.resetFeedbackForm();
            
            // Track event
            this.trackEvent('feedback_submitted', {
                rating: feedback.rating,
                type: feedback.type
            });
            
        } catch (error) {
            console.error('Error submitting feedback:', error);
            this.showError('Failed to send feedback. Please try again.');
        } finally {
            this.submitFeedback.disabled = false;
            this.submitFeedback.textContent = 'Send Feedback';
        }
    }

    async sendFeedback(feedback) {
        // In production, this would send to your API
        // For now, we'll store locally and could sync later
        const stored = await chrome.storage.local.get(['feedbackQueue']);
        const queue = stored.feedbackQueue || [];
        queue.push(feedback);
        await chrome.storage.local.set({ feedbackQueue: queue });
        
        // If online, try to sync
        if (navigator.onLine) {
            // await fetch('https://api.semantest.com/feedback', {...})
        }
    }

    resetFeedbackForm() {
        this.rating = 0;
        this.updateStarDisplay(0);
        this.feedbackType.value = '';
        this.feedbackMessage.value = '';
        this.feedbackEmail.value = '';
        this.updateCharCount();
    }

    selectQuickIssue(btn) {
        const issue = btn.dataset.issue;
        const descriptions = {
            'popup-not-opening': 'The extension popup is not opening when I click the icon.',
            'project-not-saving': 'My projects are not being saved or are disappearing.',
            'chatgpt-connection': 'The extension cannot connect to ChatGPT.',
            'download-failed': 'Image downloads are failing or not working properly.'
        };
        
        this.issueDescription.value = descriptions[issue] || '';
        
        // Set appropriate category
        const categories = {
            'popup-not-opening': 'popup',
            'project-not-saving': 'projects',
            'chatgpt-connection': 'other',
            'download-failed': 'downloads'
        };
        
        this.issueCategory.value = categories[issue] || '';
    }

    addStep() {
        const stepCount = this.stepsContainer.querySelectorAll('.step-input').length;
        const newStep = document.createElement('input');
        newStep.type = 'text';
        newStep.className = 'form-control step-input';
        newStep.placeholder = `Step ${stepCount + 1}: ...`;
        this.stepsContainer.appendChild(newStep);
    }

    async handleIssueSubmit() {
        const steps = Array.from(this.stepsContainer.querySelectorAll('.step-input'))
            .map(input => input.value.trim())
            .filter(step => step);
        
        const issue = {
            category: this.issueCategory.value,
            description: this.issueDescription.value.trim(),
            steps: steps,
            includeDiagnostics: this.includeDiagnostics.checked,
            timestamp: new Date().toISOString(),
            version: chrome.runtime.getManifest().version,
            browser: navigator.userAgent
        };
        
        // Add diagnostics if requested
        if (issue.includeDiagnostics) {
            issue.diagnostics = await this.collectDiagnostics();
        }
        
        // Validate
        if (!issue.category || !issue.description) {
            this.showError('Please select a category and describe the issue');
            return;
        }
        
        // Disable button
        this.submitIssue.disabled = true;
        this.submitIssue.textContent = 'Reporting...';
        
        try {
            // Send issue report
            await this.sendIssueReport(issue);
            
            // Show success
            this.showSuccess('Issue reported successfully. We\'ll look into it!');
            
            // Reset form
            this.resetIssueForm();
            
            // Track event
            this.trackEvent('issue_reported', {
                category: issue.category
            });
            
        } catch (error) {
            console.error('Error reporting issue:', error);
            this.showError('Failed to report issue. Please try again.');
        } finally {
            this.submitIssue.disabled = false;
            this.submitIssue.textContent = 'Report Issue';
        }
    }

    async collectDiagnostics() {
        const diagnostics = {
            extensionVersion: chrome.runtime.getManifest().version,
            browser: navigator.userAgent,
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            colorDepth: window.screen.colorDepth,
            language: navigator.language,
            platform: navigator.platform,
            memory: navigator.deviceMemory || 'unknown',
            onLine: navigator.onLine
        };
        
        // Get storage usage
        try {
            const storage = await chrome.storage.local.getBytesInUse();
            diagnostics.storageUsed = storage;
        } catch (error) {
            diagnostics.storageUsed = 'unknown';
        }
        
        return diagnostics;
    }

    async sendIssueReport(issue) {
        // Store locally and sync when possible
        const stored = await chrome.storage.local.get(['issueQueue']);
        const queue = stored.issueQueue || [];
        queue.push(issue);
        await chrome.storage.local.set({ issueQueue: queue });
    }

    resetIssueForm() {
        this.issueCategory.value = '';
        this.issueDescription.value = '';
        this.stepsContainer.innerHTML = '<input type="text" class="form-control step-input" placeholder="Step 1: Click on...">';
        this.includeDiagnostics.checked = false;
    }

    async checkForUpdates() {
        // In production, check for updates from server
        // For demo, we'll simulate
        const currentVersion = chrome.runtime.getManifest().version;
        
        // Simulated check
        setTimeout(() => {
            const hasUpdate = Math.random() > 0.7; // 30% chance of update
            if (hasUpdate) {
                this.showUpdateNotification('1.0.1');
            }
        }, 2000);
    }

    showUpdateNotification(version) {
        this.newVersion.textContent = version;
        this.updateNotification.style.display = 'block';
        
        // Also show a badge on the Updates tab
        const updatesTab = Array.from(this.navTabs).find(tab => tab.dataset.tab === 'updates');
        if (updatesTab && !updatesTab.querySelector('.badge')) {
            const badge = document.createElement('span');
            badge.className = 'badge';
            badge.textContent = '1';
            badge.style.cssText = `
                background: var(--error-red);
                color: white;
                font-size: 10px;
                padding: 2px 6px;
                border-radius: 10px;
                margin-left: 6px;
            `;
            updatesTab.appendChild(badge);
        }
    }

    async installUpdate() {
        this.updateBtn.disabled = true;
        this.updateBtn.textContent = 'Installing...';
        
        try {
            // Trigger Chrome extension update
            chrome.runtime.reload();
        } catch (error) {
            console.error('Update failed:', error);
            this.showError('Update failed. Please try again later.');
            this.updateBtn.disabled = false;
            this.updateBtn.textContent = 'Update Now';
        }
    }

    async saveUpdatePreferences() {
        const preferences = {
            autoUpdate: this.autoUpdate.checked,
            notifications: this.updateNotifications.checked
        };
        
        await chrome.storage.local.set({ updatePreferences: preferences });
    }

    updateMetricsDisplay() {
        // Animate number updates
        this.animateNumber(this.totalChatsEl, this.metrics.totalChats);
        this.animateNumber(this.activeProjectsEl, this.metrics.activeProjects);
        this.animateNumber(this.imagesSavedEl, this.metrics.imagesSaved);
        this.timeSavedEl.textContent = `${this.metrics.timeSaved}h`;
    }

    animateNumber(element, target) {
        const current = parseInt(element.textContent) || 0;
        const increment = Math.ceil((target - current) / 20);
        let value = current;
        
        const timer = setInterval(() => {
            value += increment;
            if (value >= target) {
                value = target;
                clearInterval(timer);
            }
            element.textContent = value;
        }, 50);
    }

    generateActivityChart(chatHistory) {
        // Group chats by day of week
        const dayActivity = new Array(7).fill(0);
        const today = new Date();
        const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        chatHistory.forEach(chat => {
            const chatDate = new Date(chat.timestamp);
            if (chatDate >= oneWeekAgo) {
                const dayOfWeek = chatDate.getDay();
                dayActivity[dayOfWeek]++;
            }
        });
        
        // Update chart bars
        const bars = document.querySelectorAll('.chart-placeholder .bar');
        const maxActivity = Math.max(...dayActivity, 1);
        
        bars.forEach((bar, index) => {
            const dayIndex = (index + 1) % 7; // Start from Monday
            const height = (dayActivity[dayIndex] / maxActivity) * 100;
            bar.style.height = `${height}%`;
            bar.title = `${dayActivity[dayIndex]} chats`;
        });
    }

    showSuccess(message) {
        const successText = this.successMessage.querySelector('.success-text');
        successText.textContent = message;
        this.successMessage.classList.add('show');
        
        setTimeout(() => {
            this.successMessage.classList.remove('show');
        }, 3000);
    }

    showError(message) {
        // Could implement a toast notification system
        alert(message);
    }

    trackEvent(eventName, properties = {}) {
        // Analytics tracking
        if (window.gtag) {
            gtag('event', eventName, {
                event_category: 'feedback_system',
                ...properties
            });
        }
    }

    close() {
        // If in popup, close window
        if (window.location.href.includes('popup.html')) {
            window.close();
        } else {
            // If in tab, navigate back or close tab
            window.history.back();
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new FeedbackSystem();
});