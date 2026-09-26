import React, { useRef, useState, useEffect } from 'react';
import { Eraser, Check, X } from 'lucide-react';

export function SignatureModal({ isOpen, onClose, onSaveSignature }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [isOpen]);

  if (!isOpen) return null;

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleApply = () => {
    if (!canvasRef.current || !hasDrawn) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    onSaveSignature(dataUrl);
    clearCanvas();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>Create Digital Signature</span>
          <button className="thumbnail-action-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Draw your signature with your mouse, trackpad, or pen:
          </p>

          <div
            style={{
              background: '#ffffff',
              border: '1px solid var(--border-medium)',
              borderRadius: 4,
              overflow: 'hidden',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <canvas
              ref={canvasRef}
              width={480}
              height={180}
              style={{ cursor: 'crosshair', touchAction: 'none' }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              className="tool-btn"
              onClick={clearCanvas}
              title="Clear canvas"
              style={{ fontSize: 11 }}
            >
              <Eraser size={13} />
              <span>Clear</span>
            </button>
            <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>
              Transparent PNG signature
            </span>
          </div>
        </div>

        <div className="modal-footer">
          <button className="tool-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="tool-btn primary"
            onClick={handleApply}
            disabled={!hasDrawn}
          >
            <Check size={14} />
            <span>Place Signature</span>
          </button>
        </div>
      </div>
    </div>
  );
}
