# Figma Design System & UI Specification — AI Lesson Planner

> **Document Status**: Approved Specification for Design & AI Development  
> **Target Audience**: UI/UX Designers, Frontend Engineers, AI Coding Agents  
> **Target Canvas Resolution**: Desktop 1440px × 1024px (Responsive Layout down to 768px Tablet)  
> **Theme Mode**: Dual-Theme (Light Mode & Dark Mode with design tokens)  

---

## 1. Design System Tokens (Dual-Theme System)

### 1.1 Color Palette Tokens

```json
{
  "tokens": {
    "color": {
      "light": {
        "bg-app": "#F8FAFC",
        "surface-glass": "rgba(255, 255, 255, 0.75)",
        "surface-card": "#FFFFFF",
        "border-subtle": "rgba(226, 232, 240, 0.8)",
        "border-focus": "#6366F1",
        "text-primary": "#0F172A",
        "text-secondary": "#475569",
        "text-muted": "#94A3B8",
        "brand-primary": "#6366F1",
        "brand-primary-hover": "#4F46E5",
        "brand-accent": "#8B5CF6",
        "tag-worksheet-bg": "#E0E7FF",
        "tag-worksheet-text": "#3730A3",
        "tag-quiz-bg": "#FEF3C7",
        "tag-quiz-text": "#92400E",
        "tag-ppt-bg": "#E0F2FE",
        "tag-ppt-text": "#075985",
        "tag-hands-on-bg": "#DCFCE7",
        "tag-hands-on-text": "#166534"
      },
      "dark": {
        "bg-app": "#0F172A",
        "surface-glass": "rgba(30, 41, 59, 0.75)",
        "surface-card": "#1E293B",
        "border-subtle": "rgba(255, 255, 255, 0.12)",
        "border-focus": "#818CF8",
        "text-primary": "#F8FAFC",
        "text-secondary": "#CBD5E1",
        "text-muted": "#64748B",
        "brand-primary": "#818CF8",
        "brand-primary-hover": "#6366F1",
        "brand-accent": "#A78BFA",
        "tag-worksheet-bg": "rgba(99, 102, 241, 0.2)",
        "tag-worksheet-text": "#C7D2FE",
        "tag-quiz-bg": "rgba(245, 158, 11, 0.2)",
        "tag-quiz-text": "#FDE68A",
        "tag-ppt-bg": "rgba(14, 165, 233, 0.2)",
        "tag-ppt-text": "#BAE6FD",
        "tag-hands-on-bg": "rgba(34, 197, 94, 0.2)",
        "tag-hands-on-text": "#BBF7D0"
      }
    }
  }
}
```

### 1.2 Typography Tokens (Font Family: `Geist` / `Inter`)

| Style Name | Size / Line Height | Weight | Usage |
| :--- | :--- | :--- | :--- |
| **Display Header** | 32px / 40px | Bold (700) | App Header Title |
| **Section Title (H1)** | 24px / 32px | SemiBold (600) | Canvas H1, Modal Headers |
| **Subsection (H2)** | 20px / 28px | SemiBold (600) | Section Titles inside Canvas |
| **Card Title (H3)** | 16px / 24px | Medium (500) | Sidebar Items, Input Group Labels |
| **Body Large** | 16px / 24px | Regular (400) | Streaming Canvas Body Text |
| **Body Regular** | 14px / 20px | Regular (400) | Inputs, Chat Messages, Descriptions |
| **Caption / Badge** | 12px / 16px | Medium (500) | Action Tag Pills (`[Worksheet Task]`) |

### 1.3 Glassmorphism & Elevation Tokens
- **Backdrop Blur**: `blur(12px)`
- **Border Radius**: `16px` (Cards/Panels), `8px` (Inputs/Buttons), `20px` (Pill Tags)
- **Shadow Light**: `0 8px 32px 0 rgba(31, 38, 135, 0.07)`
- **Shadow Dark**: `0 8px 32px 0 rgba(0, 0, 0, 0.35)`

---

## 2. Figma Canvas Structure & Frame Breakdown

The Figma file is organized into 2 main pages:

```
├── Page 1: 🎨 Design System & Component Library
│   ├── Tokens (Colors, Typography, Shadows, Spacing)
│   ├── Buttons & Inputs
│   ├── Badges & Banner Templates
│   └── Modal Templates
│
└── Page 2: 🖥 Desktop Screen Frames (1440px width)
    ├── Frame 01: Initial Form State (Default Light & Dark)
    ├── Frame 02: Clarification Modal Triggered State
    ├── Frame 03: Live Streaming Canvas State
    ├── Frame 04: Focus / Expanded Canvas Mode
    ├── Frame 05: Tiered Worksheet Generator Modal
    ├── Frame 06: In-Canvas Refinement Chat Drawer
    └── Frame 07: History Sidebar Open / Collapsed
```

---

## 3. Frame Layout Specifications & Wireframes

### 3.1 Frame 01: Main Generator Workspace (Default Layout)

```
+---------------------------------------------------------------------------------------------------+
| [Icon] AI Lesson Planner  |  [Toggle] Standard / RAG Mode  |  [Theme Toggle]  | [History Button]   |
+---------------------------------------------------------------------------------------------------+
| SIDEBAR (280px)           | MAIN WORKSPACE (Flexible Grid - 1160px)                              |
|---------------------------|-----------------------------------------------------------------------|
| 🕒 History Library        | 📝 LESSON CONFIGURATION                                              |
|                           | Grade Level:    [ Dropdown: e.g. Grade 7 ]                             |
| - Grade 8 Science (2h ago)| Subject:        [ Input: e.g. Photosynthesis & Energy Flow ]             |
| - Grade 5 Math (1d ago)   | Objectives:     [ Textarea: Students learn light reactions... ]        |
| - Grade 10 History        |                                                                       |
|                           | 📦 SELECT DELIVERABLES:                                               |
| [+ New Plan]              | [x] Lesson Plan    [x] Differentiated Worksheet & Quiz              |
|                           | [x] PPT Outline    [ ] Hands-On Activity Guide                         |
|                           |                                                                       |
|                           | [ 🚀 Generate Lesson Plan & Deliverable Pack ]                       |
|---------------------------|-----------------------------------------------------------------------|
|                           | 📄 OUTPUT CANVAS (Streaming Placeholder / Markdown View)             |
|                           | (Displays live markdown, visual banners, and refinement tools)        |
+---------------------------------------------------------------------------------------------------+
```

---

### 3.2 Frame 02: Interactive Clarification Modal (Vague Prompt Handling)

```
+-----------------------------------------------------------------------------------+
| OVERLAY BACKDROP (Black 50% opacity, backdrop-filter: blur(4px))                  |
|  +-----------------------------------------------------------------------------+  |
|  | 💡 Let's Refine Your Lesson Plan                                          |  |
|  |-----------------------------------------------------------------------------|  |
|  | Your objective "teach math" is broad. Please clarify to get better results: |  |
|  |                                                                             |  |
|  | ❓ Clarifying Questions:                                                    |  |
|  | • What specific math concept would you like to focus on (e.g. Fractions)?   |  |
|  |                                                                             |  |
|  | 🎯 Recommended Choices (Click to select):                                    |  |
|  | [ Option A: Introduction to Equivalent Fractions with Visual Models ]        |  |
|  | [ Option B: Solving 2-Step Algebraic Equations with Real-world Problems ]     |  |
|  |                                                                             |  |
|  | Or enter custom details:                                                    |  |
|  | [ Input field: e.g. Focus on adding fractions with unlike denominators ]   |  |
|  |                                                                             |  |
|  | [ Cancel ]                                         [ Proceed with Guidance ]|  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

### 3.3 Frame 03: Live Streaming Canvas Layout

```
+-----------------------------------------------------------------------------------+
| 📄 Generated Content Canvas                 [ Focus Mode ⛶ ] [ Copy 📋 ] [ PDF ⬇ ]|
+-----------------------------------------------------------------------------------+
| ![Header Banner - Unsplash Image](https://images.unsplash.com/...)                |
|                                                                                   |
| # Grade 7 Science: Photosynthesis & Energy Flow                                   |
| **Pedagogical Framework**: NEP 2020 Experiential Learning | **Mode**: Marble RAG   |
|                                                                                   |
| ## 1. Learning Objectives & Outcomes                                              |
| - Understand chloroplast function and light absorption.                           |
| - [Verbal Q&A] Ask students: "Why do plant leaves appear green?"                   |
|                                                                                   |
| ![Activity Banner](https://images.unsplash.com/...)                               |
|                                                                                   |
| ## 2. Hands-On Lab Activity [Hands-On Activity]                                   |
| **Title**: Leaf Stomata Observation under Microscope                              |
| ...                                                                               |
|                                                                                   |
| 💬 [ Open Refinement Chat ]       |       📝 [ Generate Worksheet for Section ]    |
+-----------------------------------------------------------------------------------+
```

---

## 4. Component Properties & AI Code Mapping Matrix

This matrix maps Figma component definitions directly to Next.js / React component props and CSS selectors in `src/app/page.tsx` and `src/app/globals.css`.

| Figma Component Name | Figma Variant / Props | React Code Component / State | CSS Class / Variables |
| :--- | :--- | :--- | :--- |
| `ModeSelector` | `mode`: `"standard"` \| `"marble_rag"` | `const [mode, setMode] = useState<"standard" \| "marble_rag">("standard")` | `.mode-toggle-pill`, `--primary` |
| `DeliverableCheckbox` | `label`: string, `checked`: boolean | `const [deliverables, setDeliverables] = useState<string[]>(...)` | `.deliverable-chip`, `--surface` |
| `ClarificationModal` | `open`: boolean, `questions`: string[], `suggestions`: string[] | `const [showClarification, setShowClarification] = useState(false)` | `.glass-panel`, `.modal-overlay` |
| `StreamingCanvas` | `isStreaming`: boolean, `content`: string, `expanded`: boolean | `outputRef`, `const [expandedCanvas, setExpandedCanvas]` | `.glass-panel`, `react-markdown` |
| `TagPill` | `type`: `"worksheet"` \| `"quiz"` \| `"ppt"` \| `"hands-on"` | Custom render inside `react-markdown` components | `.tag-pill-worksheet`, `.tag-pill-ppt` |
| `WorksheetModal` | `open`: boolean, `sectionText`: string, `generatedContent`: string | `const [showWorksheetModal, setShowWorksheetModal]` | `/api/generate-worksheet` |
| `RefinementChat` | `messages`: `{role, content}[]`, `isOpen`: boolean | `const [chatMessages, setChatMessages]` | `.chat-drawer`, `.input-field` |
| `HistorySidebar` | `isOpen`: boolean, `items`: `HistoryItem[]` | `const [sidebarOpen, setSidebarOpen]`, `history` | `.sidebar-drawer`, `/api/history` |

---

## 5. Developer & AI Agent Modification Guidelines

When an AI coding agent or developer is instructed to modify the project layout or add features:

1. **Adding New Deliverable Types**:
   - Add new checkbox option in `DeliverablesGroup` inside `src/app/page.tsx`.
   - Update prompt rules in `src/app/api/generate/route.ts` to output appropriate Markdown section headers and `[Action Tags]`.
   - Define token badge colors in `src/app/globals.css`.

2. **Modifying Dual Themes**:
   - Update CSS custom variables under `:root` (Light mode) and `@media (prefers-color-scheme: dark)` (Dark mode) in `src/app/globals.css`.
   - All glass panels must inherit `var(--surface)`, `var(--border)`, and `var(--shadow)`.

3. **Enhancing RAG Taxonomy**:
   - Modify `src/lib/rag/os-taxonomy.ts` to add new micro-topics or prerequisite dependency edges.
