# Project Folder Structure: Enterprise Offline PDF Editor

This document outlines the directory structure and responsibilities of each module in the project.

```text
PDF-Editor/
│
├── Agents/                               # Project governance & documentation
│   ├── context.md                        # Problem statement, constraints, specs
│   └── folder_structure.md               # Architecture & codebase layout (this file)
│
├── public/                               # Static assets & bundled offline workers
│   └── pdf.worker.min.mjs                # Bundled local PDF.js worker (zero network CDN dependency)
│
├── src/                                  # React application source code
│   │
│   ├── assets/                           # Local icons, default stamps, fonts
│   │
│   ├── components/                       # UI components
│   │   ├── Header/                       # Top menubar & quick status
│   │   │   ├── MenuBar.jsx               # File (Open, Save, Export, Close), Edit, View menus
│   │   │   └── DocumentTitle.jsx         # Filename, dirty state indicator, save status
│   │   │
│   │   ├── Toolbar/                      # High-density primary tool buttons
│   │   │   ├── PrimaryToolbar.jsx        # Hand, Select, Edit Text, Add Text, Sign, Highlight, Redact, Stamp
│   │   │   ├── ToolPropertyBar.jsx       # Contextual secondary bar (Font, Size, Color, Stroke, Opacity)
│   │   │   └── ZoomControls.jsx          # Zoom in, Zoom out, Fit Width, Fit Page, % input
│   │   │
│   │   ├── Sidebar/                      # Left-hand navigation & document organizer
│   │   │   ├── ThumbnailPanel.jsx        # Drag-and-drop page list with live previews
│   │   │   ├── ThumbnailCard.jsx         # Single page card with rotate/delete/reorder actions
│   │   │   └── PageActionsModal.jsx      # Merge PDFs, Split, Extract ranges dialogs
│   │   │
│   │   ├── Viewport/                     # Main PDF canvas workspace
│   │   │   ├── DocumentViewer.jsx        # Virtualized/continuous page container
│   │   │   ├── PageCanvas.jsx            # PDF.js canvas renderer + interaction overlays
│   │   │   ├── TextOverlay.jsx           # Text layer for selecting, detecting, and in-place editing
│   │   │   └── AnnotationLayer.jsx       # Render signatures, shapes, highlights, redactions
│   │   │
│   │   └── Modals/                       # Dialogs for tools
│   │       ├── SignatureModal.jsx        # Draw canvas, type signature, or upload image
│   │       ├── StampModal.jsx            # Standard office stamps (Approved, Confidential, etc.)
│   │       └── MergeModal.jsx            # Select and append secondary PDF files
│   │
│   ├── hooks/                            # Custom React hooks
│   │   ├── useFileSystem.js              # File System Access API (showOpenFilePicker, save in-place)
│   │   ├── usePdfDocument.js             # Loading, caching, and state of active PDF
│   │   ├── useTextEditor.js              # Detection of text spans, click-to-edit, overlay sync
│   │   ├── useAnnotations.js             # Adding, updating, deleting annotations/shapes
│   │   └── useKeyboardShortcuts.js       # Ctrl+S (Save), Ctrl+Z (Undo), Ctrl+Y (Redo), Delete, Zoom
│   │
│   ├── services/                         # PDF & file processing logic
│   │   ├── pdfRenderer.js                # PDF.js wrappers for page & thumbnail rendering
│   │   ├── pdfExporter.js                # pdf-lib backend: writes text patches, signatures, saves bytes
│   │   ├── textMatcher.js                # Matches PDF text bounding boxes to screen coordinates
│   │   └── fontHelper.js                 # Standard PDF fonts (Helvetica, Times, Courier) & metrics
│   │
│   ├── types/                            # Type definitions / shape contracts
│   │   └── document.js                   # Schema for document, pages, annotations, text patches
│   │
│   ├── styles/                           # Enterprise design system
│   │   ├── tokens.css                    # Professional dark/light slate color variables, typography
│   │   └── enterprise.css                # Toolbars, buttons, panels, high-density layout styles
│   │
│   ├── App.jsx                           # Root application layout coordinator
│   ├── App.css                           # App frame styling
│   ├── index.css                         # Global CSS resets & root variables
│   └── main.jsx                          # React application entry point
│
├── package.json                          # Project scripts and dependencies
├── vite.config.js                        # Vite bundler configuration
└── README.md                             # User instructions for running offline
```
