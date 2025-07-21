# Privacy Policy - Semantest ChatGPT Extension

**Last Updated**: January 21, 2025  
**Version**: 1.0.1

## Overview

Semantest ChatGPT Extension ("we", "our", or "the extension") is committed to protecting your privacy. This privacy policy explains what data we collect, how we use it, and your rights regarding your data.

## What We Collect

### Error Telemetry Only
We collect **only** anonymous error telemetry data to improve the extension's reliability:

- **Error Information**: JavaScript errors, unhandled rejections, and extension errors
- **Technical Context**: Error messages, stack traces, and error types
- **Browser Information**: Browser version, platform, and language (no unique identifiers)
- **Session Data**: Anonymous session ID (randomly generated, not linked to you)
- **Page Context**: Sanitized URLs (query parameters and personal data removed)

### What We DO NOT Collect
- ❌ Personal information (name, email, etc.)
- ❌ ChatGPT conversations or chat content
- ❌ Passwords or authentication tokens
- ❌ Browsing history outside ChatGPT
- ❌ Cookies or tracking identifiers
- ❌ IP addresses or location data

## Consent Required

### Opt-In by Default
- **No data collection without consent**: Telemetry is disabled until you explicitly allow it
- **Clear consent request**: On first install, we ask for your permission
- **Transparent purpose**: We explain that data helps us fix bugs and improve the extension

### Consent Dialog
When you first install the extension, you'll see:
```
"Help Improve ChatGPT Extension
Send anonymous error reports to help us fix bugs faster? 
No personal data is collected."

[Deny] [Allow]
```

## Consent Mechanism Details

### How Our Consent System Works
Our consent mechanism is designed with privacy and user control at its core:

#### Bulletproof Consent Features
1. **Consent Pending State**: While waiting for your decision, all telemetry is blocked
2. **5-Minute Timeout**: The consent dialog won't pressure you - it times out after 5 minutes
3. **Exponential Backoff**: If you dismiss the dialog, we wait progressively longer before asking again
4. **Session Persistence**: Your choice is remembered across browser sessions
5. **No Default Consent**: We never assume consent - explicit user action required

#### Technical Safeguards
- **telemetryConsentPending flag**: Blocks all data collection during consent flow
- **Synchronous consent check**: Ensures no data leaks before consent verification
- **Chrome Storage Sync**: Your choice syncs across all your devices
- **Fail-safe design**: Any error in consent system = no data collection

#### GDPR Compliance Features
- **Freely given**: No feature restrictions based on consent choice
- **Specific**: Clear explanation of what data is collected and why
- **Informed**: Transparent about data use before asking for consent
- **Withdrawable**: Multiple easy methods to revoke consent anytime

## How to Opt-Out

### Method 1: Initial Installation
Simply click "Deny" when the consent dialog appears on first install.

### Method 2: Extension Settings
1. Click the Semantest extension icon
2. Go to Settings
3. Toggle "Error Telemetry" to OFF
4. Your choice is saved immediately

### Method 3: Chrome Storage
Your consent is stored in Chrome's sync storage. You can revoke it anytime:
1. The extension respects your choice across all devices
2. Disabling telemetry stops all data collection immediately
3. Previously collected anonymous data cannot be linked back to you

### What Happens When You Opt-Out
- All error reporting stops immediately
- No data is collected or transmitted
- The extension continues to work normally
- You can re-enable telemetry anytime

## Data Retention

### 30-Day Retention Policy
- **Automatic deletion**: All telemetry data is automatically deleted after 30 days
- **No long-term storage**: We don't keep historical data beyond the retention period
- **Anonymous data**: Even during the 30-day period, data cannot be linked to you

### Data Storage
- **Secure transmission**: Data is sent securely to our telemetry endpoint
- **Anonymous storage**: No personal identifiers are stored with error data
- **Limited access**: Only used for debugging and improving the extension

## Your Rights

### Under GDPR and Privacy Laws
You have the right to:
- **Access**: Request what data we have (Note: it's anonymous and can't be linked to you)
- **Opt-out**: Disable telemetry at any time
- **Deletion**: Data auto-deletes after 30 days
- **Portability**: Export your consent preference
- **Transparency**: This policy explains all data practices

## Data Security

### How We Protect Data
- **Encryption in transit**: Secure HTTPS transmission
- **Anonymous by design**: No personal identifiers collected
- **Rate limiting**: Prevents excessive data collection
- **Minimal collection**: Only error data, nothing else

## Children's Privacy

The extension is not intended for children under 13. We do not knowingly collect data from children.

## Changes to This Policy

We may update this privacy policy to reflect changes in our practices. We will notify users of any material changes through the extension update notes.

## Third-Party Services

### ChatGPT/OpenAI
- This extension works with ChatGPT but is not affiliated with OpenAI
- We don't access or collect your ChatGPT conversations
- Your ChatGPT data is governed by OpenAI's privacy policy

### Chrome/Browser
- Your consent preference is stored in Chrome's sync storage
- No data is shared with Chrome beyond normal extension operation

## Contact Information

For privacy concerns or questions about this policy:
- **GitHub Issues**: https://github.com/semantest/chrome-extension/issues
- **Email**: privacy@semantest.com (privacy inquiries only)

## Summary for Chrome Web Store

**Data Collection**: Anonymous error telemetry only (with consent)  
**Personal Data**: None collected  
**Consent**: Required before any collection  
**Opt-out**: Available anytime through extension settings  
**Retention**: 30 days automatic deletion  
**Purpose**: Bug fixing and reliability improvements only  

---

## Compliance Statement

This extension complies with:
- ✅ GDPR (General Data Protection Regulation)
- ✅ CCPA (California Consumer Privacy Act)
- ✅ Chrome Web Store Developer Program Policies
- ✅ Privacy by Design principles

**Privacy-First Commitment**: Your privacy is our priority. We collect the absolute minimum data needed to maintain a reliable extension, and only with your explicit consent.

---

*This privacy policy is effective for Semantest ChatGPT Extension version 1.0.1 and later.*