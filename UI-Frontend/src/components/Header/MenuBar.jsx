import React from 'react';
import { 
  FolderOpen, 
  Save, 
  Download, 
  HardDrive,
  Check,
  AlertCircle,
  Loader2,
  RotateCcw,
  X
} from 'lucide-react';

export function MenuBar({ 
  fileName, 
  filePath,
  isDirty, 
  isSaving, 
  saveStatus = 'idle',
  lastSavedTime,
  errorMessage,
  hasFileHandle,
  isBackendOnline,
  onOpen, 
  onSave, 
  onSaveAs,
  onDiscardChanges,
  onCloseDocument,
}) {
  return (
    <header className="app-titlebar">
      <div className="titlebar-brand">
        <img 
          src="/pdf-icon.png" 
          alt="PDF" 
          style={{ width: 22, height: 22, objectFit: 'contain' }} 
        />
        <span className="brand-title">PDF Editor</span>
      </div>

      <div className="titlebar-doc-info">
        {fileName ? (
          <>
            <span 
              className="titlebar-filename" 
              title={filePath || fileName}
            >
              {fileName}
            </span>

            {/* Direct Disk Path / Handle status badge */}
            {(filePath || hasFileHandle) && (
              <span 
                className="titlebar-badge disk-link" 
                title={filePath ? `Direct Disk Overwrite: ${filePath}` : "Connected to original file on disk. Ctrl+S directly overwrites this file."}
              >
                <HardDrive size={11} /> Direct Disk Link
              </span>
            )}

            {/* Live Real-time Save & State Badge */}
            {saveStatus === 'saving' && (
              <span className="titlebar-badge saving">
                <Loader2 size={11} className="spin" /> Overwriting to disk...
              </span>
            )}

            {saveStatus === 'saved' && (
              <span className="titlebar-badge saved">
                <Check size={12} /> Overwritten to disk{lastSavedTime ? ` (${lastSavedTime})` : ''}
              </span>
            )}

            {saveStatus === 'idle' && isDirty && (
              <span className="titlebar-badge dirty" title="You have unsaved changes. Press Ctrl+S or click Save to overwrite the file on disk.">
                ● Unsaved edits (Ctrl+S to overwrite)
              </span>
            )}

            {saveStatus === 'idle' && !isDirty && lastSavedTime && (
              <span className="titlebar-badge clean">
                <Check size={11} /> Saved ({lastSavedTime})
              </span>
            )}
          </>
        ) : null}
      </div>

      <div className="titlebar-actions">
        <button 
          className="tool-btn" 
          onClick={onOpen}
          title="Open PDF from your computer (Ctrl + O)"
        >
          <FolderOpen size={15} />
          <span>Open File</span>
        </button>

        {/* Option when user does NOT want to save: Discard all edits */}
        {isDirty && (
          <button 
            className="tool-btn danger-subtle" 
            onClick={onDiscardChanges}
            title="Discard all changes and revert back to original PDF"
          >
            <RotateCcw size={14} />
            <span>Discard Edits</span>
          </button>
        )}

        <button 
          className={`tool-btn ${saveStatus === 'saved' ? 'success' : isDirty ? 'primary' : ''}`}
          onClick={onSave}
          disabled={!fileName || isSaving}
          title={hasFileHandle ? "Directly overwrite original PDF on disk (Ctrl + S)" : "Save / Export PDF (Ctrl + S)"}
        >
          {isSaving ? (
            <>
              <Loader2 size={15} className="spin" />
              <span>Saving...</span>
            </>
          ) : saveStatus === 'saved' ? (
            <>
              <Check size={15} />
              <span>Saved!</span>
            </>
          ) : (
            <>
              <Save size={15} />
              <span>{hasFileHandle ? 'Save (Ctrl+S)' : 'Save PDF'}</span>
            </>
          )}
        </button>

        <button 
          className="tool-btn" 
          onClick={onSaveAs}
          disabled={!fileName || isSaving}
          title="Export a separate copy as a new PDF file without modifying original"
        >
          <Download size={15} />
          <span>Export Copy</span>
        </button>

        {fileName && (
          <button 
            className="tool-btn" 
            onClick={onCloseDocument}
            title="Close this document"
            style={{ padding: '0 8px', marginLeft: 4 }}
          >
            <X size={15} />
          </button>
        )}
      </div>
    </header>
  );
}
