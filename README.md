# PDF Editor

A high-performance, local-first **desktop-grade PDF Editor** web application. Designed for direct in-place editing, byte-level PDF stream redaction, and direct disk overwriting—combining the speed of a modern web interface with the power of native desktop PDF software like Adobe Acrobat.

---

## Features

- **Direct Disk In-Place Overwriting**:
  - Open a file from your computer and press `Ctrl + S` to save directly back to the original file on disk—no repeated downloads or renamed duplicates required.
  - Optional **"Export Copy"** to save edited versions under a separate filename.
  - Built-in **"Discard Edits"** and **"Close"** safety mechanisms to keep your disk files untouched until confirmed.

- **True PDF Stream Editing (PyMuPDF Engine)**:
  - Uses a local **FastAPI + PyMuPDF (`fitz`)** backend to perform true byte-level text redaction and replacement in the PDF content stream.
  - Edits are permanently written into the PDF structure and display cleanly in Adobe Acrobat Reader and other external PDF viewers.

- **Adobe Acrobat-Style "Edit Text" Mode**:
  - Features intelligent **Paragraph Block Detection**—groups lines into clean dotted bounding boxes just like Adobe Acrobat.
  - Free of visual clutter: hover over any line to highlight it in Adobe blue, click to edit in-place.

- **Ultra-Sharp HiDPI Canvas**:
  - 2.5x Retina-grade rendering with sub-pixel font anti-aliasing. Text, barcodes, and logos stay razor-sharp at any zoom level.

- **Complete Annotation Suite**:
  - **Add Text**: Place custom text blocks anywhere on the page with font size, bold, and color controls.
  - **Signatures**: Draw digital signatures and stamp them onto documents.
  - **Highlight & Redact**: Mark critical sections or permanently redact sensitive content.
  - **Stamps**: Place preset or custom status stamps.

- **Document Management**:
  - **Combine / Merge PDFs**: Merge multiple PDF documents into one.
  - **Rotate Pages**: 90° view rotation.
  - **Auto Margin Trim**: Eliminates excess whitespace on thermal shipping labels and oversized documents.

---

## Architecture & Tech Stack

```
PDF-Editor/
├── Backend/              # FastAPI + PyMuPDF Python server
│   ├── src/
│   │   ├── api/          # Route handlers & endpoints
│   │   ├── features/     # Document & redaction services
│   │   └── utils/        # Native Windows dialog helpers
│   ├── main.py           # FastAPI entry point
│   ├── requirements.txt  # Python dependencies
│   ├── run.bat           # Auto-activating backend launcher
│   └── .gitignore
│
├── UI-Frontend/          # Modern React Single Page App
│   ├── src/
│   │   ├── components/   # Viewport, Toolbar, Header, Modals
│   │   ├── hooks/        # File system & PDF state hooks
│   │   ├── services/     # PDF.js renderer, pdf-lib exporter, backend API
│   │   └── styles/       # Enterprise dark-mode design system
│   ├── package.json      # Frontend dependencies
│   └── .gitignore
│
├── start.bat             # 1-Click All-in-One Launcher
└── README.md
```

### Technologies Used:
- **Frontend**: React 18, Vite, PDF.js (Mozilla), `pdf-lib`, Lucide React, Vanilla CSS Design System
- **Backend**: Python 3.10+, FastAPI, Uvicorn, PyMuPDF (`fitz`), Pydantic

---

## Quick Start

### Prerequisites
- **Node.js** 18+ (https://nodejs.org)
- **Python** 3.10+ (https://python.org - make sure to check *"Add Python to PATH"* during installation)

---

### Method 1: One-Click Launch (Recommended for Windows)

Simply double-click **`start.bat`** in the project root folder.

`start.bat` will automatically:
1. Detect and activate Python `venv` (creates it and installs requirements if it's the first time).
2. Start the FastAPI backend on `http://localhost:5000`.
3. Check and install frontend dependencies (`npm install` if needed).
4. Launch the frontend on `http://localhost:5173`.

---

### Method 2: Manual Setup

#### 1. Start Backend
```powershell
cd Backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 5000 --reload
```
*Backend runs on `http://localhost:5000` with interactive API docs at `http://localhost:5000/docs`.*

#### 2. Start Frontend (in a new terminal)
```powershell
cd UI-Frontend
npm install
npm run dev
```
*Frontend runs on `http://localhost:5173`.*

---

## Keyboard Shortcuts

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| **`Ctrl + S`** | Save in place | Overwrites active PDF directly on disk via PyMuPDF |
| **`Ctrl + O`** | Open File | Opens native file dialog to select a PDF |
| **`Esc`** | Cancel Edit | Exits active in-place text editor without applying changes |
| **`Enter`** | Commit Edit | Saves current text edit on the page |

---

## Security & Privacy

- **100% Local & Offline**: All processing occurs strictly on your local machine (`127.0.0.1`). 
- **Zero Cloud Uploads**: Documents are never transmitted to external servers or third-party APIs.
- **Safe State Handling**: Original disk files remain completely untouched until you explicitly hit Save (`Ctrl + S`).

---

## License

This project is licensed under the MIT License - feel free to use and adapt for personal or commercial projects.
