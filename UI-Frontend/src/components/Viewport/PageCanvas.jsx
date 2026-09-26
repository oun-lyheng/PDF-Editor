import React, { useState, useEffect, useRef } from 'react';
import { renderPdfPage, extractPageTextItems } from '../../services/pdfRenderer';
import { Trash2 } from 'lucide-react';

export function PageCanvas({
  pdfDoc,
  pageNumber,
  zoom,
  rotation,
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
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [pageDimensions, setPageDimensions] = useState({ width: 600, height: 800 });
  const [detectedTextItems, setDetectedTextItems] = useState([]);
  const [detectedTextBlocks, setDetectedTextBlocks] = useState([]);
  const [editingTextId, setEditingTextId] = useState(null);
  const [editingTextValue, setEditingTextValue] = useState('');
  
  // Drawing rects for Redaction / Highlight
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [currentBox, setCurrentBox] = useState(null);

  // Dragging annotations (stamps, signatures, redactions)
  const [draggingAnnotId, setDraggingAnnotId] = useState(null);
  const dragRef = useRef(null);

  // Render PDF Page to Canvas & Extract Text Items
  useEffect(() => {
    let isCancelled = false;

    async function loadPage() {
      if (!pdfDoc || !canvasRef.current) return;
      try {
        const dim = await renderPdfPage(pdfDoc, pageNumber, canvasRef.current, zoom, rotation || 0);
        if (!isCancelled) {
          setPageDimensions({ width: dim.width, height: dim.height, fullWidth: dim.fullWidth || dim.width });
        }

        // Extract clickable text items & paragraph blocks for "Edit Text"
        const textResult = await extractPageTextItems(pdfDoc, pageNumber, zoom, rotation || 0);
        if (!isCancelled) {
          setDetectedTextItems(textResult.items || textResult);
          setDetectedTextBlocks(textResult.blocks || []);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error(`Error rendering page ${pageNumber}:`, err);
        }
      }
    }

    loadPage();

    return () => {
      isCancelled = true;
    };
  }, [pdfDoc, pageNumber, zoom, rotation]);

  // Handle clicking on an existing text block to edit it
  const handleTextSpanClick = (item, e) => {
    if (activeTool !== 'editText') return;
    e.stopPropagation();

    // Check if there is already an existing edit on this item
    const existingEdit = textEdits.find(
      (edit) => edit.pageNumber === pageNumber && edit.originalItemId === item.id
    );

    setEditingTextId(item.id);
    setEditingTextValue(existingEdit ? existingEdit.text : item.text);
  };

  // Commit text edit on blur or Enter
  const handleCommitTextEdit = (item) => {
    if (!editingTextId) return;

    const originalText = item.originalText || item.text;
    
    // If text is unchanged from original PDF, remove any active edit so original is preserved
    if (editingTextValue === originalText) {
      const existingEdit = textEdits.find(
        (edit) => edit.pageNumber === pageNumber && edit.originalItemId === item.id
      );
      if (existingEdit) {
        onRemoveTextEdit(existingEdit.id);
      }
      setEditingTextId(null);
      return;
    }

    // Only upsert when text is actually modified
    onUpsertTextEdit({
      id: `edit-${pageNumber}-${item.id}`,
      originalItemId: item.id,
      pageNumber,
      x: item.x,
      y: item.y,
      width: Math.max(item.width, editingTextValue.length * (item.fontSize * 0.6)),
      height: item.height,
      pdfX: item.pdfX,
      pdfY: item.pdfY,
      pdfWidth: item.pdfWidth,
      pdfHeight: item.pdfHeight,
      pdfFontSize: item.pdfFontSize,
      text: editingTextValue,
      originalText: originalText,
      fontSize: item.fontSize,
      fontFamily: textProps.fontFamily,
      isBold: textProps.isBold,
      textColor: textProps.textColor,
      backgroundColor: textProps.backgroundColor || '#ffffff',
      canvasWidth: pageDimensions.width,
      canvasHeight: pageDimensions.height,
      canvasFullWidth: pageDimensions.fullWidth || pageDimensions.width,
      canvasFullHeight: pageDimensions.height,
    });

    setEditingTextId(null);
  };

  // Click anywhere to add a new text box
  const handleContainerClick = (e) => {
    if (activeTool !== 'addText') return;
    if (e.target.closest('.text-patch-box') || e.target.closest('.in-place-text-editor') || e.target.closest('.annotation-element')) {
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const clickX = Math.round(e.clientX - rect.left);
    const clickY = Math.round(e.clientY - rect.top);

    const newId = `custom-text-${Date.now()}`;
    const initialText = '';

    onUpsertTextEdit({
      id: newId,
      pageNumber,
      x: clickX,
      y: clickY,
      width: 140,
      height: Math.max(24, Math.round((textProps.fontSize || 14) * 1.5)),
      text: initialText,
      originalText: '',
      fontSize: textProps.fontSize || 14,
      fontFamily: textProps.fontFamily || 'Helvetica',
      isBold: Boolean(textProps.isBold),
      textColor: textProps.textColor || '#000000',
      backgroundColor: textProps.backgroundColor || '#ffffff',
      canvasWidth: pageDimensions.width,
      canvasHeight: pageDimensions.height,
      canvasFullWidth: pageDimensions.fullWidth || pageDimensions.width,
      canvasFullHeight: pageDimensions.height,
    });

    setEditingTextId(newId);
    setEditingTextValue('');
  };

  // Drag to draw Redaction or Highlight box
  const handleMouseDown = (e) => {
    if (activeTool !== 'redact' && activeTool !== 'highlight') return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    setDrawStart({ x, y });
    setCurrentBox({ x, y, width: 0, height: 0 });
  };

  const handleMouseMove = (e) => {
    if (!isDrawing) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentX = Math.max(0, Math.min(e.clientX - rect.left, pageDimensions.width));
    const currentY = Math.max(0, Math.min(e.clientY - rect.top, pageDimensions.height));

    const x = Math.min(drawStart.x, currentX);
    const y = Math.min(drawStart.y, currentY);
    const width = Math.abs(currentX - drawStart.x);
    const height = Math.abs(currentY - drawStart.y);

    setCurrentBox({ x, y, width, height });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentBox) {
      setIsDrawing(false);
      return;
    }

    if (currentBox.width > 5 && currentBox.height > 5) {
      onAddAnnotation({
        pageNumber,
        type: activeTool,
        x: currentBox.x,
        y: currentBox.y,
        width: currentBox.width,
        height: currentBox.height,
        color: activeTool === 'redact' ? redactColor : undefined,
        canvasWidth: pageDimensions.width,
        canvasHeight: pageDimensions.height,
      });
    }

    setIsDrawing(false);
    setCurrentBox(null);
  };

  // Draggable Annotations (Stamps, Signatures, Redactions)
  const handleAnnotMouseDown = (annot, e) => {
    if (e.button !== 0) return; // Only primary mouse click
    if (e.target.closest('.annotation-delete-btn')) return; // Ignore delete button

    e.stopPropagation();
    e.preventDefault();

    setDraggingAnnotId(annot.id);
    dragRef.current = {
      id: annot.id,
      startX: e.clientX,
      startY: e.clientY,
      initialX: annot.x,
      initialY: annot.y,
      width: annot.width || 180,
      height: annot.height || 60,
    };
  };

  useEffect(() => {
    if (!draggingAnnotId) return;

    const handleWindowMouseMove = (e) => {
      if (!dragRef.current) return;
      const { id, startX, startY, initialX, initialY, width, height } = dragRef.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      const maxX = Math.max(0, pageDimensions.width - width);
      const maxY = Math.max(0, pageDimensions.height - height);

      const newX = Math.round(Math.max(0, Math.min(initialX + dx, maxX)));
      const newY = Math.round(Math.max(0, Math.min(initialY + dy, maxY)));

      if (onUpdateAnnotation) {
        onUpdateAnnotation(id, {
          x: newX,
          y: newY,
          canvasWidth: pageDimensions.width,
          canvasHeight: pageDimensions.height,
        });
      }
    };

    const handleWindowMouseUp = () => {
      setDraggingAnnotId(null);
      dragRef.current = null;
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [draggingAnnotId, onUpdateAnnotation, pageDimensions]);

  // Filter text edits & annotations strictly for this specific page number
  const pageEdits = textEdits.filter((e) => Number(e.pageNumber) === Number(pageNumber));
  const pageAnnotations = annotations.filter((a) => Number(a.pageNumber) === Number(pageNumber));

  return (
    <div
      ref={containerRef}
      id={`page-wrapper-${pageNumber}`}
      className="pdf-page-wrapper"
      style={{
        width: pageDimensions.width,
        height: pageDimensions.height,
      }}
      onClick={handleContainerClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* 1. Underlying PDF Rendered Canvas */}
      <canvas ref={canvasRef} className="pdf-canvas-layer" />

      {/* 2. Interactive Layer */}
      <div className="pdf-interaction-layer">
        {/* A1. Adobe Acrobat-style clean paragraph bounding boxes */}
        {activeTool === 'editText' &&
          detectedTextBlocks.map((block) => (
            <div
              key={block.id}
              className="adobe-block-box"
              style={{
                left: block.x - 2,
                top: block.y - 2,
                width: block.width + 4,
                height: block.height + 4,
              }}
            />
          ))}

        {/* A2. Detected Clickable Text Spans */}
        {activeTool === 'editText' &&
          detectedTextItems.map((item) => {
            const isEditing = editingTextId === item.id;
            if (isEditing) return null; // Render textarea instead

            return (
              <div
                key={item.id}
                className="detected-text-span"
                style={{
                  left: item.x,
                  top: item.y,
                  width: item.width,
                  height: item.height,
                }}
                onClick={(e) => handleTextSpanClick(item, e)}
                title={`Click to edit: "${item.text}"`}
              />
            );
          })}

        {/* B. Active In-Place Text Editor Input (For both PDF text & newly added text) */}
        {editingTextId && (() => {
          const detectedItem = detectedTextItems.find((i) => i.id === editingTextId);
          const customEdit = pageEdits.find((e) => e.id === editingTextId);

          if (detectedItem) {
            return (
              <input
                autoFocus
                type="text"
                className="in-place-text-editor"
                style={{
                  left: detectedItem.x,
                  top: detectedItem.y,
                  minWidth: Math.max(detectedItem.width, 60),
                  height: detectedItem.height + 4,
                  fontSize: detectedItem.fontSize,
                  fontFamily: textProps.fontFamily,
                  color: textProps.textColor,
                  backgroundColor: textProps.backgroundColor || '#ffffff',
                }}
                value={editingTextValue}
                onChange={(e) => {
                  const newVal = e.target.value;
                  setEditingTextValue(newVal);
                  const originalText = detectedItem.originalText || detectedItem.text;
                  const editId = `edit-${pageNumber}-${detectedItem.id}`;
                  if (newVal === originalText) {
                    onRemoveTextEdit(editId);
                  } else {
                    onUpsertTextEdit({
                      id: editId,
                      originalItemId: detectedItem.id,
                      pageNumber,
                      x: detectedItem.x,
                      y: detectedItem.y,
                      width: Math.max(detectedItem.width, newVal.length * (detectedItem.fontSize * 0.6)),
                      height: detectedItem.height,
                      pdfX: detectedItem.pdfX,
                      pdfY: detectedItem.pdfY,
                      pdfWidth: detectedItem.pdfWidth,
                      pdfHeight: detectedItem.pdfHeight,
                      pdfFontSize: detectedItem.pdfFontSize,
                      text: newVal,
                      originalText: originalText,
                      fontSize: detectedItem.fontSize,
                      fontFamily: textProps.fontFamily,
                      isBold: textProps.isBold,
                      textColor: textProps.textColor,
                      backgroundColor: textProps.backgroundColor || '#ffffff',
                      canvasWidth: pageDimensions.width,
                      canvasHeight: pageDimensions.height,
                      canvasFullWidth: pageDimensions.fullWidth || pageDimensions.width,
                      canvasFullHeight: pageDimensions.height,
                    });
                  }
                }}
                onBlur={() => handleCommitTextEdit(detectedItem)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCommitTextEdit(detectedItem);
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    onRemoveTextEdit(`edit-${pageNumber}-${detectedItem.id}`);
                    setEditingTextId(null);
                  }
                }}
              />
            );
          }

          if (customEdit) {
            return (
              <input
                autoFocus
                type="text"
                className="in-place-text-editor custom-text-input"
                style={{
                  left: customEdit.x,
                  top: customEdit.y,
                  minWidth: Math.max(customEdit.width, 100),
                  height: Math.max(customEdit.height, 26),
                  fontSize: customEdit.fontSize || textProps.fontSize || 14,
                  fontFamily: customEdit.fontFamily || textProps.fontFamily || 'Helvetica',
                  fontWeight: customEdit.isBold ? 'bold' : 'normal',
                  color: customEdit.textColor || textProps.textColor || '#000000',
                  backgroundColor: customEdit.backgroundColor || textProps.backgroundColor || '#ffffff',
                  border: '1.5px solid #2563eb',
                  boxShadow: '0 0 0 2px rgba(37, 99, 235, 0.25)',
                  padding: '2px 6px',
                  borderRadius: 3,
                  outline: 'none',
                  zIndex: 150,
                }}
                value={editingTextValue}
                placeholder="Type text here..."
                onChange={(e) => {
                  const newVal = e.target.value;
                  setEditingTextValue(newVal);
                  onUpsertTextEdit({
                    ...customEdit,
                    text: newVal,
                    width: Math.max(80, newVal.length * ((customEdit.fontSize || 14) * 0.65) + 20),
                  });
                }}
                onBlur={() => {
                  if (!editingTextValue || editingTextValue.trim() === '') {
                    onRemoveTextEdit(customEdit.id);
                  }
                  setEditingTextId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!editingTextValue || editingTextValue.trim() === '') {
                      onRemoveTextEdit(customEdit.id);
                    }
                    setEditingTextId(null);
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    onRemoveTextEdit(customEdit.id);
                    setEditingTextId(null);
                  }
                }}
              />
            );
          }

          return null;
        })()}

        {/* C. Baked In-Place Text Edits & Patches (Whiteout + New Text) */}
        {pageEdits.map((edit) => {
          if (editingTextId === edit.id || (edit.originalItemId && editingTextId === edit.originalItemId)) {
            return null;
          }
          return (
            <div
              key={edit.id}
              className="text-patch-box"
              style={{
                left: edit.x,
                top: edit.y,
                minWidth: edit.width,
                height: edit.height,
                backgroundColor: edit.backgroundColor || '#ffffff',
                color: edit.textColor || '#000000',
                fontFamily: edit.fontFamily || 'Helvetica',
                fontWeight: edit.isBold ? 'bold' : 'normal',
                fontSize: edit.fontSize,
                lineHeight: `${edit.height}px`,
                padding: '0 4px',
              }}
              onClick={(e) => {
                e.stopPropagation();
                setEditingTextId(edit.id);
                setEditingTextValue(edit.text);
              }}
            >
              <span>{edit.text}</span>
              <button
                className="annotation-delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveTextEdit(edit.id);
                }}
                title="Remove text"
              >
                ×
              </button>
            </div>
          );
        })}

        {/* D. Annotations (Signatures, Stamps, Redactions, Highlights) */}
        {pageAnnotations.map((annot) => {
          const isDragging = draggingAnnotId === annot.id;
          return (
            <div
              key={annot.id}
              className={`annotation-element ${annot.type} ${isDragging ? 'is-dragging' : ''}`}
              style={{
                left: annot.x,
                top: annot.y,
                width: annot.width,
                height: annot.height,
                backgroundColor: annot.type === 'redact' ? annot.color || '#000000' : undefined,
              }}
              onMouseDown={(e) => handleAnnotMouseDown(annot, e)}
            >
              {annot.imageDataUrl && (
                <img
                  src={annot.imageDataUrl}
                  alt="annotation"
                  style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
                />
              )}
              <button
                className="annotation-delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveAnnotation(annot.id);
                }}
                title="Remove item"
              >
                ×
              </button>
            </div>
          );
        })}

        {/* E. Live Box Drawing Preview (Redaction or Highlight) */}
        {isDrawing && currentBox && (
          <div
            style={{
              position: 'absolute',
              left: currentBox.x,
              top: currentBox.y,
              width: currentBox.width,
              height: currentBox.height,
              backgroundColor: activeTool === 'redact' ? redactColor : 'rgba(250, 204, 21, 0.4)',
              border: '1px dashed #3b82f6',
              pointerEvents: 'none',
              zIndex: 50,
            }}
          />
        )}
      </div>
    </div>
  );
}
