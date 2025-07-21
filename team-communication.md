# Team Communication Log

## Frontend to UX (semantest:8)
**Topic**: Need design specs for dark mode
**Message**: "Hi UX! Frontend here. I need the final design specs for dark mode implementation. Specifically: 1) Color values for dark theme components, 2) Toggle animation behavior, 3) Should theme preference persist across sessions? The CSS variables are ready but need your guidance on the final look."

## Frontend to Engineer (semantest:2)
**Topic**: API integration and popup.js functionality
**Message**: "Hi Engineer! Found that popup.js has Web-Buddy code instead of Semantest. Need to understand: 1) What API endpoints should popup.js connect to? 2) Project creation/management functionality specs? 3) Is there a build script to copy CSS files to build/? Currently popup.css is missing from build directory."

## Frontend to DevOps (semantest:7)
**Topic**: Build process and deployment
**Message**: "Hi DevOps! Frontend here with build issues: 1) CSS files not copying from src/ to build/, 2) Need to push BETA badge fixes, 3) Dark mode toggle implementation ready. Can you help with the build process? Ready to push fixes once we resolve the popup.js issue."

## Frontend to QA
**Status**: Cannot test in Chrome directly, but found these issues:
1. popup.js contains wrong project code (Web-Buddy)
2. popup.css missing from build directory
3. Version is correct: v1.0.0-beta ✅
4. BETA badge implemented in build/popup.html ✅
5. Dark mode CSS ready, JS not connected

## CC: PM
**Blockers**: 
- Wrong JavaScript file blocking all functionality
- Missing CSS in build will break styling
- Need UX specs for dark mode final design
- Need Engineer guidance on API integration