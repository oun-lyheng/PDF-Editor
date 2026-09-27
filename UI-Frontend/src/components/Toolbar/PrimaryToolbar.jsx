import React from 'react';
import { 
  MousePointer, 
  Type, 
  Edit3, 
  PenTool, 
  Highlighter, 
  ShieldAlert, 
  RotateCw, 
  ZoomIn, 
  ZoomOut, 
  Maximize2,
  PanelLeftClose,
  PanelLeft,
  Undo2,
  Redo2
} from 'lucide-react';

export function PrimaryToolbar({
  isSidebarOpen,
  onToggleSidebar,
  activeTool,
  setActiveTool,
  zoom,
  setZoom,
  onRotateCurrentPage,
  hasDocument,
  onOpenSignatureModal,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}) {
  return (
    <div className="primary-toolbar">
      {/* Interaction Mode Tools */}
      <div className="toolbar-group">
        <button
          className={`tool-btn ${isSidebarOpen ? 'active' : ''}`}
          onClick={onToggleSidebar}
          disabled={!hasDocument}
          title={isSidebarOpen ? "Hide Pages Sidebar" : "Show Pages Sidebar"}
        >
          {isSidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeft size={15} />}
          <span>{isSidebarOpen ? 'Hide Pages' : 'Pages'}</span>
        </button>

        <div className="toolbar-divider" />

        <button
          className="tool-btn"
          onClick={onUndo}
          disabled={!hasDocument || !canUndo}
          title="Undo last action (Ctrl + Z)"
          style={{ opacity: !canUndo ? 0.35 : 1 }}
        >
          <Undo2 size={15} />
        </button>

        <button
          className="tool-btn"
          onClick={onRedo}
          disabled={!hasDocument || !canRedo}
          title="Redo action (Ctrl + Y or Ctrl + Shift + Z)"
          style={{ opacity: !canRedo ? 0.35 : 1 }}
        >
          <Redo2 size={15} />
        </button>

        <div className="toolbar-divider" />

        <button
          className={`tool-btn ${activeTool === 'select' ? 'active' : ''}`}
          onClick={() => setActiveTool('select')}
          disabled={!hasDocument}
          title="Select & Pan Document (V)"
        >
          <MousePointer size={15} />
          <span>Select</span>
        </button>

        <button
          className={`tool-btn ${activeTool === 'editText' ? 'active' : ''}`}
          onClick={() => setActiveTool('editText')}
          disabled={!hasDocument}
          title="Click any text on the page to edit / overwrite it"
          style={activeTool === 'editText' ? { backgroundColor: '#2563eb', color: '#fff' } : {}}
        >
          <Edit3 size={15} />
          <span style={{ fontWeight: 600 }}>Edit Text</span>
        </button>

        <button
          className={`tool-btn ${activeTool === 'addText' ? 'active' : ''}`}
          onClick={() => setActiveTool('addText')}
          disabled={!hasDocument}
          title="Click anywhere to type new text"
        >
          <Type size={15} />
          <span>Add Text</span>
        </button>

        <div className="toolbar-divider" />

        <button
          className="tool-btn"
          onClick={onOpenSignatureModal}
          disabled={!hasDocument}
          title="Draw or import digital signature"
        >
          <PenTool size={15} />
          <span>Sign</span>
        </button>

        <div className="toolbar-divider" />

        <button
          className={`tool-btn ${activeTool === 'highlight' ? 'active' : ''}`}
          onClick={() => setActiveTool(activeTool === 'highlight' ? 'select' : 'highlight')}
          disabled={!hasDocument}
          title="Highlight area or text"
        >
          <Highlighter size={15} />
          <span>Highlight</span>
        </button>

        <button
          className={`tool-btn ${activeTool === 'redact' ? 'active' : ''}`}
          onClick={() => setActiveTool(activeTool === 'redact' ? 'select' : 'redact')}
          disabled={!hasDocument}
          title="Black-out / Redact confidential information"
        >
          <ShieldAlert size={15} />
          <span>Redact</span>
        </button>
      </div>

      {/* Page Actions & Zoom Controls */}
      <div className="toolbar-group">

        <button
          className="tool-btn"
          onClick={onRotateCurrentPage}
          disabled={!hasDocument}
          title="Rotate view 90° clockwise (View-Only)"
        >
          <RotateCw size={15} />
          <span>Rotate</span>
        </button>

        <div className="toolbar-divider" />

        <button
          className="tool-btn"
          onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.15).toFixed(2))))}
          disabled={!hasDocument || zoom <= 0.4}
          title="Zoom Out"
        >
          <ZoomOut size={15} />
        </button>

        <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 42, textAlign: 'center' }}>
          {Math.round(zoom * 100)}%
        </span>

        <button
          className="tool-btn"
          onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.15).toFixed(2))))}
          disabled={!hasDocument || zoom >= 2.5}
          title="Zoom In"
        >
          <ZoomIn size={15} />
        </button>

        <button
          className="tool-btn"
          onClick={() => setZoom(1.0)}
          disabled={!hasDocument}
          title="100% Zoom"
        >
          100%
        </button>

        <button
          className="tool-btn"
          onClick={() => setZoom(1.4)}
          disabled={!hasDocument}
          title="Fit Width (Comfortable Reading)"
          style={{ fontSize: 11 }}
        >
          <Maximize2 size={13} />
          <span>Fit Width</span>
        </button>
      </div>
    </div>
  );
}
