import React, { useEffect, useRef } from 'react';
import { RotateCw, Trash2, ArrowUp, ArrowDown, ChevronLeft } from 'lucide-react';
import { renderPdfPage } from '../../services/pdfRenderer';

export function ThumbnailCard({
  pageNumber,
  pdfDoc,
  isSelected,
  rotation,
  onSelect,
  onRotate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let isCancelled = false;

    async function drawThumbnail() {
      if (!pdfDoc || !canvasRef.current) return;
      try {
        // Thumbnail scale (around 0.22 for fast rendering) with native rotation
        await renderPdfPage(pdfDoc, pageNumber, canvasRef.current, 0.22, rotation || 0);
      } catch (e) {
        if (!isCancelled) {
          console.warn(`Error drawing thumbnail for page ${pageNumber}`, e);
        }
      }
    }

    drawThumbnail();

    return () => {
      isCancelled = true;
    };
  }, [pdfDoc, pageNumber, rotation]);

  return (
    <div
      className={`thumbnail-card ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <div className="thumbnail-preview-wrap">
        <canvas ref={canvasRef} />
      </div>

      <div className="thumbnail-footer">
        <span>Page {pageNumber}</span>
        
        <div className="thumbnail-actions" onClick={(e) => e.stopPropagation()}>
          {!isFirst && (
            <button 
              className="thumbnail-action-btn"
              onClick={onMoveUp}
              title="Move Page Up"
            >
              <ArrowUp size={12} />
            </button>
          )}

          {!isLast && (
            <button 
              className="thumbnail-action-btn"
              onClick={onMoveDown}
              title="Move Page Down"
            >
              <ArrowDown size={12} />
            </button>
          )}

          <button
            className="thumbnail-action-btn"
            onClick={onRotate}
            title="Rotate 90° Clockwise"
          >
            <RotateCw size={12} />
          </button>

          <button
            className="thumbnail-action-btn"
            onClick={onDelete}
            title="Delete this page"
            style={{ color: '#ef4444' }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function ThumbnailPanel({
  isOpen = true,
  pdfDoc,
  pageOrder,
  currentPage,
  rotations,
  onSelectPage,
  onRotatePage,
  onDeletePage,
  onReorderPages,
  onMergePdf,
  onCloseSidebar,
}) {
  const movePage = (index, delta) => {
    const newOrder = [...pageOrder];
    const targetIndex = index + delta;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;
    onReorderPages(newOrder);
  };

  return (
    <aside className={`app-sidebar ${isOpen ? '' : 'collapsed'}`}>
      <div className="sidebar-header">
        <span style={{ fontWeight: 600 }}>Pages ({pageOrder.length})</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            className="tool-btn"
            onClick={onMergePdf}
            title="Append pages from another PDF file"
            style={{ height: 24, padding: '0 6px', fontSize: 11 }}
          >
            + Merge
          </button>
          <button
            className="thumbnail-action-btn"
            onClick={onCloseSidebar}
            title="Collapse Sidebar"
            style={{ padding: '3px 4px' }}
          >
            <ChevronLeft size={15} />
          </button>
        </div>
      </div>

      <div className="thumbnail-list">
        {pageOrder.map((pageNum, index) => (
          <ThumbnailCard
            key={pageNum}
            pageNumber={pageNum}
            pdfDoc={pdfDoc}
            isSelected={currentPage === pageNum}
            rotation={rotations[pageNum] || 0}
            onSelect={() => onSelectPage(pageNum)}
            onRotate={() => onRotatePage(pageNum)}
            onDelete={() => onDeletePage(pageNum)}
            onMoveUp={() => movePage(index, -1)}
            onMoveDown={() => movePage(index, 1)}
            isFirst={index === 0}
            isLast={index === pageOrder.length - 1}
          />
        ))}
      </div>
    </aside>
  );
}
