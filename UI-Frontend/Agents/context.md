# Project Context: Offline Enterprise PDF Editor

## 1. Background & Problem Statement
- **User Role**: Intern at a corporate company.
- **Pain Point**: Company does not provide Adobe Acrobat Pro licenses to interns/temporary staff, yet everyday tasks require editing, modifying, signing, and reviewing PDF documents.
- **Corporate Environment Constraints**:
  - **Zero External Network / Strict Domain Whitelisting**: The corporate firewall and proxy block unauthorized external domains. Cloud PDF tools (ILovePDF, Smallpdf, Canva, etc.) or CDN scripts (`cdnjs`, `unpkg`, Google Fonts) cannot be reached.
  - **Confidentiality & Data Compliance**: Work documents (contracts, invoices, employee records, financial reports) must strictly remain on-premise/local. No document bytes can leave the computer.
  - **No Admin / No Software Installers**: Work laptops frequently block installing native `.exe` or `.msi` installers without IT privileges.

## 2. Solution Philosophy & Architecture
- **100% Client-Side Local Web Application**: Built with React + Vite, packaged to run completely standalone in Chrome / Microsoft Edge.
- **Zero Network Calls**: All dependencies (`pdf.js` worker, `pdf-lib`, icons, fonts) are bundled locally inside the project. Works 100% offline via `file:///` or local Vite server (`http://localhost:...`).
- **File System Access API (Native File Overwrite)**:
  - Users can open files using `window.showOpenFilePicker()`.
  - When saving via `Ctrl + S` or the Save button, the app uses `FileSystemFileHandle.createWritable()` to overwrite the file in-place directly on disk—exactly like Adobe Acrobat—with automatic fallback to file download if the API is unsupported or denied.
- **Native Enterprise Desktop Aesthetics (Anti-AI Slop)**:
  - High-density, professional, utilitarian workspace inspired by Adobe Acrobat Pro, Figma, and macOS Preview.
  - Dark/Light enterprise slate palette (#1e2022 / #f4f5f7), sharp borders, pixel-perfect tool buttons, readable zoom controls, and no purple/cyan AI glow gimmicks.

## 3. Core Feature Set (Everyday Office Essentials)

### Priority #1: In-Place Text Editing & Overwrite
- Detection and visual bounding of text elements on the PDF page.
- Direct click-to-edit: Covers old text with precise background color (whiteout/patch) and renders user-edited text in matching font, size, and styling.
- Arbitrary text insertion: Click anywhere to add new text blocks (notes, labels, dates).

### Priority #2: Direct File System Access & Effortless File Opening
- Direct "Open File" and "Save (`Ctrl + S`)" using the File System Access API.
- Global drag-and-drop: Drag any `.pdf` anywhere onto the app window to load instantly.
- Recent files list / tab switching.

### Priority #3: Page Management (Visual Organizer)
- Left sidebar with real page thumbnail rendering.
- Rotate pages (90° clockwise / counter-clockwise) to fix scanned sheets.
- Delete unnecessary or blank pages.
- Reorder pages via drag-and-drop.
- Merge external PDF documents into current document.
- Export selected page range.

### Priority #4: Signatures, Stamps & Fill Tools
- Digital signature pad: Draw signature with mouse/touch, or import signature PNG.
- Place signature anywhere, resize, and bake into PDF.
- Pre-made office stamps: *APPROVED*, *CONFIDENTIAL*, *DRAFT*, *PAID*, *VOID*, and current date stamps.
- Checkmark / Cross mark tools for forms.

### Priority #5: Markup, Highlight & Redaction
- Text highlight tool with adjustable opacity and color.
- Redaction box: True black-out / white-out over confidential numbers, salaries, or customer data.
- Freehand pen tool & geometric shapes (rectangles, arrows, lines).

## 4. Technical Stack
- **Framework**: React 19 + Vite (modern, fast HMR and optimized production build).
- **PDF Rendering & Text Extraction**: `pdfjs-dist` (local worker bundled, extracting viewport coordinates and text content).
- **PDF Modification & Generation**: `pdf-lib` (pure client-side byte manipulation for merging, page manipulation, text drawing, image embedding).
- **Icons**: `lucide-react` (clean, monochrome, vector icons).
- **Styling**: Tailored high-density Enterprise CSS (custom tokens, zero bloat).
