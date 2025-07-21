# Permission Justifications for Chrome Web Store

## Frontend Analysis of Required Permissions

### 1. **scripting** Permission
**Why we need it:**
- Inject content scripts to detect ChatGPT UI elements
- Enable project dropdown overlay on ChatGPT pages
- Capture user selections for custom instructions
- Monitor ChatGPT page state changes for connection status

**User-facing features:**
- Project management dropdown
- Custom instruction injection
- Quick prompt functionality
- Real-time connection status

### 2. **downloads** Permission  
**Why we need it:**
- Download chat history as markdown files (Screenshot 5 shows this)
- Export project data for backup
- Save conversation templates
- Batch download multiple conversations

**User-facing features:**
- "Download Chat History" with progress bar
- Export conversations as .md files
- Backup project settings
- Download conversation archives

### 3. **notifications** Permission
**Why we need it:**
- Alert when long downloads complete
- Notify connection status changes
- Inform about project sync status
- Alert on errors requiring user action

**User-facing features:**
- Download completion notifications
- Connection lost/restored alerts
- Project sync confirmations
- Error notifications for failed operations

### 4. **activeTab** Permission
**Why we need it:**
- Access current ChatGPT tab only when user clicks extension
- Read page content to determine ChatGPT state
- Inject UI overlays for project selection

**User-facing features:**
- Detect active ChatGPT conversation
- Show relevant project context
- Enable quick actions on current chat

### 5. **storage** Permission
**Why we need it:**
- Save user's projects and colors
- Store custom instructions per project
- Remember theme preference (light/dark)
- Cache frequently used prompts

**User-facing features:**
- Persistent project list
- Saved custom instructions (1500 char limit)
- Theme preference persistence
- Quick prompt history

## Chrome Web Store Justification Summary

Each permission directly enables user-visible features:
- **scripting**: Makes the extension work on ChatGPT pages
- **downloads**: Enables the export/download functionality 
- **notifications**: Keeps users informed of async operations
- **activeTab**: Ensures privacy by only accessing current tab
- **storage**: Provides persistent user preferences

All permissions are essential for core functionality and cannot be removed without breaking user features.