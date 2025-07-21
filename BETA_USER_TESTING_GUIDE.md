# Beta User Testing Guide - ChatGPT Extension

**Version**: 1.0.0-beta  
**Welcome Beta Tester!** 🎉

Thank you for helping us test the ChatGPT Extension. This guide will walk you through testing all 6 core features with real-world scenarios.

## Getting Started

### Installation
1. Download the extension package
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" and select the `build` folder
5. Pin the extension to your toolbar for easy access

### First Launch
1. Click the extension icon in your toolbar
2. You should see the Semantest popup
3. The status indicator should show "Ready"
4. Navigate to https://chatgpt.com
5. Wait for the extension to initialize (3-5 seconds)

---

## Feature Test Scenarios

### 📁 Feature 1: Project Creation & Management

**Scenario A: Basic Project Creation**
1. On ChatGPT, look for the "New Project" button
2. Click it and enter name: "Beta Test Project 1"
3. Click "Create"
4. ✅ Success: Project appears in left sidebar

**Scenario B: Multiple Projects**
1. Create 3 more projects:
   - "Work Tasks"
   - "Personal Assistant"
   - "Code Helper"
2. Switch between projects by clicking them
3. ✅ Success: Each project maintains separate chat history

**Scenario C: Project with Special Characters**
1. Try creating: "Test-Project_2024 (Beta)"
2. ✅ Success: Project created (may show minor display issues)

**What to Report**:
- [ ] Projects appear in sidebar?
- [ ] Can switch between projects?
- [ ] Project names display correctly?

---

### 💬 Feature 2: Custom Instructions

**Scenario A: Professional Context**
1. Click your profile picture → "Custom Instructions"
2. Set instructions:
   - **About You**: "I'm a software developer working on web applications. I prefer practical examples with code."
   - **How to Respond**: "Be concise and technical. Always include code examples. Skip lengthy explanations."
3. Save and start a new chat
4. Ask: "How do I center a div?"
5. ✅ Success: Response is technical with CSS code

**Scenario B: Creative Writing Mode**
1. Change instructions:
   - **About You**: "I'm a creative writer working on science fiction stories."
   - **How to Respond**: "Be creative and descriptive. Use metaphors and vivid language."
2. Ask: "Describe a futuristic city"
3. ✅ Success: Response is creative and descriptive

**Scenario C: Language Preference**
1. Set instruction: "Always respond in bullet points"
2. Ask any question
3. ✅ Success: Response formatted as bullet points

**What to Report**:
- [ ] Instructions dialog opens?
- [ ] Settings save successfully?
- [ ] ChatGPT follows your instructions?

---

### 🆕 Feature 3: Automated Chat Creation

**Scenario A: Quick New Chat**
1. In an existing conversation
2. Use extension to create new chat (without clicking ChatGPT's button)
3. ✅ Success: New blank chat appears instantly

**Scenario B: Project-Specific New Chat**
1. Select a project first
2. Create new chat via extension
3. ✅ Success: New chat created within that project

**Scenario C: Rapid Chat Creation**
1. Create 5 new chats in quick succession
2. ✅ Success: All chats created without errors

**What to Report**:
- [ ] New chats created instantly?
- [ ] Previous chat saved properly?
- [ ] Chat input ready immediately?

---

### 📤 Feature 4: Automated Prompt Sending

**Scenario A: Simple Prompt**
1. Use extension to send: "What is 2+2?"
2. ✅ Success: Prompt sent, answer received

**Scenario B: Code Generation**
1. Send: "Write a Python function to reverse a string"
2. ✅ Success: Code block appears in response

**Scenario C: Multi-line Prompt**
1. Send a complex prompt:
   ```
   Create a todo list app with:
   - Add items
   - Delete items  
   - Mark complete
   Use React and modern hooks
   ```
2. ✅ Success: Full prompt sent correctly

**Scenario D: Rapid Fire Testing**
1. Send 5 prompts quickly:
   - "Tell me a joke"
   - "What's the weather like?"
   - "Explain quantum computing"
   - "Write a haiku"
   - "List 5 programming languages"
2. ✅ Success: All prompts queued and answered

**What to Report**:
- [ ] Prompts sent automatically?
- [ ] Responses received properly?
- [ ] Long prompts handled correctly?

---

### 🖼️ Feature 5: Image Generation & Download

**Scenario A: Simple Image Request**
1. Send: "Create a simple smiley face emoji"
2. Wait for image (30-60 seconds)
3. Use extension to download
4. ✅ Success: Image saved to Downloads folder

**Scenario B: Complex Image Generation**
1. Send: "Generate a cyberpunk cityscape at night with neon lights and flying cars"
2. Wait for generation
3. Download the image
4. Check filename includes timestamp
5. ✅ Success: High-quality image downloaded

**Scenario C: Multiple Images**
1. Send: "Create 4 different geometric patterns"
2. Wait for all images
3. Use extension to download all
4. ✅ Success: All images downloaded with unique names

**Scenario D: Image Formats**
1. After generating any image
2. Check download format (should be PNG)
3. Verify image opens correctly
4. ✅ Success: Image quality preserved

**What to Report**:
- [ ] Images detected correctly?
- [ ] Downloads work smoothly?
- [ ] Filenames are descriptive?
- [ ] All images saved properly?

---

### ⚡ Feature 6: Performance & Stability

**Scenario A: Extended Session**
1. Use extension continuously for 30 minutes
2. Create projects, send prompts, download images
3. ✅ Success: No crashes or freezes

**Scenario B: Multi-Tab Stress Test**
1. Open 5 ChatGPT tabs
2. Use extension features in each tab
3. Switch between tabs rapidly
4. ✅ Success: Extension remains responsive

**Scenario C: Memory Test**
1. Check Chrome Task Manager (Shift+Esc)
2. Note extension memory usage
3. Use for 1 hour
4. Check memory again
5. ✅ Success: Memory usage reasonable (<200MB)

**Scenario D: Recovery Test**
1. Reload ChatGPT page mid-conversation
2. Use extension features immediately
3. ✅ Success: Extension reconnects automatically

**What to Report**:
- [ ] Extension stays responsive?
- [ ] Memory usage acceptable?
- [ ] No crashes during testing?
- [ ] Recovery works properly?

---

## Common Test Combinations

### 🔄 Workflow Test 1: Project-Based Development
1. Create project "Python Development"
2. Set instructions: "I'm learning Python, explain simply"
3. Create new chat
4. Send: "How do I read a CSV file?"
5. Get response with code
6. Create another chat in same project
7. Send: "How do I write to CSV?"

### 🔄 Workflow Test 2: Creative Design Session
1. Create project "Logo Design"
2. Set instructions: "I need creative visual designs"
3. Send: "Design a minimalist logo for a coffee shop"
4. Download generated image
5. Send: "Make 3 variations"
6. Download all variations

### 🔄 Workflow Test 3: Research Assistant
1. Create project "Research Notes"
2. Set instructions: "Provide academic-style responses with sources"
3. Send multiple research questions
4. Create new chats for different topics
5. Test switching between research threads

---

## Reporting Issues

### 🐛 When You Find a Bug

**Critical Issues** (Report Immediately):
- Extension crashes Chrome
- Data loss (projects disappear)
- Cannot send any prompts
- Security warnings appear

**Major Issues** (Report within 24h):
- Feature completely broken
- Frequent errors (>3 times)
- Performance severely degraded
- UI elements missing

**Minor Issues** (Report in feedback):
- Cosmetic problems
- Occasional delays
- Non-blocking errors
- Feature improvements

### 📝 How to Report

Include in your report:
1. **What happened**: Describe the issue
2. **Steps to reproduce**: Exact steps to trigger
3. **Expected behavior**: What should happen
4. **Actual behavior**: What actually happened
5. **Screenshots**: If UI-related
6. **Error messages**: Copy any errors
7. **Environment**:
   - Chrome version
   - OS (Windows/Mac/Linux)
   - ChatGPT account type (Free/Plus)

### 📊 Feedback Template

```
Feature: [Which of the 6 features]
Severity: [Critical/Major/Minor]
Frequency: [Always/Sometimes/Once]

Description:
[What went wrong]

Steps to Reproduce:
1. [First step]
2. [Second step]
3. [Error occurs]

Expected Result:
[What should happen]

Actual Result:
[What happened instead]

Additional Info:
- Chrome Version: 
- OS: 
- Time of occurrence:
- Screenshot attached: Yes/No
```

---

## Beta Tester Checklist

Before submitting feedback, please complete:

- [ ] Tested all 6 core features
- [ ] Tried at least 3 workflow combinations
- [ ] Used extension for minimum 1 hour total
- [ ] Tested with both simple and complex prompts
- [ ] Generated and downloaded at least 3 images
- [ ] Created at least 3 different projects
- [ ] Experienced a full ChatGPT session with extension

---

## Thank You!

Your testing helps make this extension better for everyone. We appreciate your time and detailed feedback!

**Questions?** Reach out to beta@semantest.com

**Found something awesome?** Share it! We love success stories too.

Happy Testing! 🚀