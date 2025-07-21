# Changelog

All notable changes to the ChatGPT Browser Extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2024-01-20

### 🔒 Privacy & Security
- Added explicit telemetry consent popup on first install
- Implemented GDPR-compliant privacy controls
- Enhanced user data protection with encryption

### ✨ Added
- Telemetry consent modal with clear privacy choices
- 4 safety mechanisms to ensure consent popup always appears:
  - Consent pending flag tracking
  - Exponential backoff retry (up to 5 attempts)
  - Background monitoring (checks every 30s for 5 minutes)
  - Startup recovery for pending consent
- Anonymous error reporting system (opt-in only)
- Comprehensive privacy policy
- Automated consent popup tests

### 🐛 Fixed
- Chrome Web Store compliance issues with permissions
- Content Security Policy (CSP) violations
- Telemetry consent not appearing on first install
- Various UI/UX improvements

### 📚 Documentation
- Added detailed privacy policy (PRIVACY_POLICY.md)
- Enhanced README with privacy section
- Created QA testing guide for consent popup
- Added manual testing documentation

## [1.0.0] - 2024-01-19

### 🎉 Initial Release
- **Project Management**: Organize ChatGPT conversations by topic
- **Custom Instructions**: Set AI behavior preferences
- **Quick Actions**: One-click new chat, project switching
- **Image Management**: Download and organize DALL-E images
- **Keyboard Shortcuts**: Boost productivity with hotkeys
- **Auto-Sync**: Seamless synchronization across sessions

### 🔧 Technical
- Chrome Extension Manifest V3 compliance
- Secure storage using Chrome APIs
- Content script injection for ChatGPT interface
- Background service worker for lifecycle management

### 📋 Requirements
- Chrome/Chromium browser v110+
- Active ChatGPT account
- Permissions: activeTab, storage, notifications, downloads

---

## [Unreleased]

### 🚀 Planned Features
- Multi-language support
- Dark mode theme options
- Export conversations to various formats
- Advanced search within projects
- Team collaboration features
- API integration for automation

### 🔧 Technical Improvements
- Performance optimizations
- Reduced memory footprint
- Enhanced error handling
- Better offline support

---

For more details on each release, see the [GitHub Releases](https://github.com/semantest/extension.chrome/releases) page.