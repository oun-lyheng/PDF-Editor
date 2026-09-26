import React from 'react';
import { X } from 'lucide-react';

const OFFICE_STAMPS = [
  { id: 'approved', label: 'APPROVED', color: '#16a34a', borderStyle: 'solid' },
  { id: 'confidential', label: 'CONFIDENTIAL', color: '#dc2626', borderStyle: 'solid' },
  { id: 'draft', label: 'DRAFT', color: '#d97706', borderStyle: 'dashed' },
  { id: 'paid', label: 'PAID', color: '#2563eb', borderStyle: 'solid' },
  { id: 'rejected', label: 'REJECTED', color: '#991b1b', borderStyle: 'solid' },
  { id: 'reviewed', label: 'REVIEWED', color: '#0d9488', borderStyle: 'solid' },
];

export function StampModal({ isOpen, onClose, onSelectStamp }) {
  if (!isOpen) return null;

  const generateStampImage = (stamp) => {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');

    // 1. Solid Clean White Card (100% opaque, prevents colliding with document text)
    ctx.fillStyle = '#ffffff';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(1, 1, 238, 78, 6);
      ctx.fill();
    } else {
      ctx.fillRect(0, 0, 240, 80);
    }

    // 2. Outer Border
    ctx.strokeStyle = stamp.color;
    ctx.lineWidth = 3;
    if (stamp.borderStyle === 'dashed') {
      ctx.setLineDash([8, 5]);
    } else {
      ctx.setLineDash([]);
    }
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(5, 5, 230, 70, 5);
      ctx.stroke();
    } else {
      ctx.strokeRect(5, 5, 230, 70);
    }

    // 3. Subtle Inner Border for Authentic Official Stamp look
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(10, 10, 220, 60, 3);
      ctx.stroke();
    } else {
      ctx.strokeRect(10, 10, 220, 60);
    }

    // 4. Main Stamp Label
    ctx.fillStyle = stamp.color;
    ctx.font = '900 23px "Inter", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(stamp.label, 120, 34);

    // 5. Clean Formatted Date Subtitle
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).toUpperCase();
    ctx.font = '700 11px "Inter", Arial, sans-serif';
    ctx.fillText(today, 120, 55);

    const dataUrl = canvas.toDataURL('image/png');
    onSelectStamp(dataUrl);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>Choose Office Stamp</span>
          <button className="thumbnail-action-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Select an official stamp to stamp onto your document:
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 12,
              marginTop: 6,
            }}
          >
            {OFFICE_STAMPS.map((stamp) => (
              <div
                key={stamp.id}
                onClick={() => generateStampImage(stamp)}
                style={{
                  border: `2px ${stamp.borderStyle} ${stamp.color}`,
                  color: stamp.color,
                  padding: '16px 8px',
                  borderRadius: 6,
                  textAlign: 'center',
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: 14,
                  letterSpacing: 1.5,
                  background: '#ffffff',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
                }}
              >
                <div>{stamp.label}</div>
                <div style={{ fontSize: 11, marginTop: 4, opacity: 0.85, fontWeight: 600 }}>
                  {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button className="tool-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
