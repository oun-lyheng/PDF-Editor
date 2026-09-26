import React, { useState } from 'react';
import { PageCanvas } from './PageCanvas';
import { FileUp } from 'lucide-react';

export function DocumentViewer({
  isInitializing,
  pdfDoc,
  pageOrder,
  zoom,
  rotations,
  activeTool,
  textProps,
  redactColor,
  textEdits,
  onUpsertTextEdit,
  onRemoveTextEdit,
  annotations,
  onAddAnnotation,
  onUpdateAnnotation,
  onRemoveAnnotation,
  onFileDrop,
  onOpenFilePicker,
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        onFileDrop(file);
      }
    }
  };

  return (
    <main
      className="app-viewport"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isInitializing ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-subtle)' }}>
          {/* Clean blank dark slate background during session restore - zero flash */}
        </div>
      ) : !pdfDoc ? (
        <div className="empty-viewport-zone">
          <div className={`drop-card ${isDragOver ? 'drag-over' : ''}`}>
            <div className="drop-icon-box">
              <img 
                src="/pdf-icon.png" 
                alt="PDF" 
                style={{ width: 44, height: 44, objectFit: 'contain' }} 
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-main)' }}>
                Drag & Drop your PDF here 
              </h2>
            </div>
            <button
              className="tool-btn primary"
              onClick={onOpenFilePicker}
              style={{ height: 36, padding: '0 18px', fontSize: 13, marginTop: 8 }}
            >
              Choose PDF File
            </button>
          </div>
        </div>
      ) : (
        <div className="viewport-pages-container">
          {pageOrder.map((pageNum) => (
            <PageCanvas
              key={pageNum}
              pdfDoc={pdfDoc}
              pageNumber={pageNum}
              zoom={zoom}
              rotation={rotations[pageNum] || 0}
              activeTool={activeTool}
              textProps={textProps}
              redactColor={redactColor}
              textEdits={textEdits}
              onUpsertTextEdit={onUpsertTextEdit}
              onRemoveTextEdit={onRemoveTextEdit}
              annotations={annotations}
              onAddAnnotation={onAddAnnotation}
              onUpdateAnnotation={onUpdateAnnotation}
              onRemoveAnnotation={onRemoveAnnotation}
            />
          ))}
        </div>
      )}
    </main>
  );
}
