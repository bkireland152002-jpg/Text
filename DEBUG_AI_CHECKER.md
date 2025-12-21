# Debug Checklist: AI Checker UI Reliability

This document explains the common pitfalls with PDF viewer UIs and how the new Sidebar integration ensures a reliable experience.

## 🛠️ Why Modals Fail in PDF Editors
1.  **Stacking Contexts**: PDF viewers (like those using `react-pdf`) often create new stacking contexts through `will-change: transform`, `opacity`, or `filter`. Standard `z-index` rules only apply within the same stacking context. A modal at the bottom of the DOM might still render "under" a specialized layer.
2.  **Parent Clipping**: Many PDF viewer containers use `overflow: hidden`. If a modal is rendered as a child of such a container (even deeply nested), it will be clipped.
3.  **Positioning Conflicts**: Absolute-positioned overlays can conflict with the absolute positioning used by the PDF's text and annotation layers, leading to "ghosting" or hover issues.

## ✅ Why the Sidebar integration Works
1.  **Flexbox Layout**: By using a top-level `flex-row` in `Editor.tsx`, the sidebar and the PDF area are sibling blocks. They don't overlap, which removes the need for complex z-index management.
2.  **Persistent Visibility**: Because the sidebar is always rendered (even if empty or idle), the React state machine (`extracting` -> `scanning` -> `done`) is always visible to the user.
3.  **State Persistence**: The AI Checker state lives in the global `zustand` store (`usePDFStore.ts`), ensuring that results aren't lost if the user switches sidebar tabs or scrolls away.

## 🔍 How to Debug Future Issues
- **Is the panel blank?**: Check `sidebarTab` and `aiCheckResults.status` in the dev tools.
- **Is the highlight missing?**: Ensure the `activeAIHighlight` object in the store has the correct `pageIndex` and `rect`.
- **Is extraction stuck?**: Check the console for PDF.js extraction errors (e.g., password-protected files).
