import React from 'react';
import { Bold, Palette } from 'lucide-react';

export function ToolPropertyBar({
  activeTool,
  textProps,
  setTextProps,
  redactColor,
  setRedactColor,
}) {
  if (activeTool !== 'editText' && activeTool !== 'addText' && activeTool !== 'redact') {
    return null;
  }

  return (
    <div className="secondary-propbar">
      {(activeTool === 'editText' || activeTool === 'addText') && (
        <>
          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Text Properties:</span>
          
          {/* Font Family */}
          <select
            style={{
              background: 'var(--bg-input)',
              color: 'var(--text-main)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-xs)',
              padding: '3px 8px',
              fontSize: 12,
            }}
            value={textProps.fontFamily}
            onChange={(e) => setTextProps({ ...textProps, fontFamily: e.target.value })}
          >
            <option value="Helvetica">Helvetica (Standard)</option>
            <option value="TimesRoman">Times New Roman (Serif)</option>
            <option value="Courier">Courier (Monospace)</option>
          </select>

          {/* Font Size */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: 'var(--text-subtle)' }}>Size:</span>
            <input
              type="number"
              min="8"
              max="72"
              value={textProps.fontSize}
              onChange={(e) => setTextProps({ ...textProps, fontSize: Number(e.target.value) })}
              style={{
                width: 48,
                background: 'var(--bg-input)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-xs)',
                padding: '3px 6px',
                fontSize: 12,
              }}
            />
          </div>

          {/* Bold Toggle */}
          <button
            className={`tool-btn ${textProps.isBold ? 'active' : ''}`}
            onClick={() => setTextProps({ ...textProps, isBold: !textProps.isBold })}
            style={{ height: 26, padding: '0 6px' }}
            title="Toggle Bold"
          >
            <Bold size={13} />
          </button>

          {/* Text Color */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--text-subtle)' }}>Text Color:</span>
            <input
              type="color"
              value={textProps.textColor}
              onChange={(e) => setTextProps({ ...textProps, textColor: e.target.value })}
              style={{
                width: 24,
                height: 24,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
              }}
              title="Pick Text Color"
            />
          </div>

          {/* Background Patch Color (For Seamless Whiteout) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--text-subtle)' }}>Patch Color:</span>
            <input
              type="color"
              value={textProps.backgroundColor}
              onChange={(e) => setTextProps({ ...textProps, backgroundColor: e.target.value })}
              style={{
                width: 24,
                height: 24,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
              }}
              title="Patch Background Color (Default is White)"
            />
          </div>

          {activeTool === 'editText' && (
            <span style={{ color: 'var(--accent-active)', fontSize: 11, marginLeft: 'auto' }}>
              Click any text block on the page to edit it directly
            </span>
          )}
        </>
      )}

      {activeTool === 'redact' && (
        <>
          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Redaction Tool:</span>
          <span style={{ color: 'var(--text-subtle)' }}>Mode:</span>
          <select
            style={{
              background: 'var(--bg-input)',
              color: 'var(--text-main)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-xs)',
              padding: '3px 8px',
              fontSize: 12,
            }}
            value={redactColor}
            onChange={(e) => setRedactColor(e.target.value)}
          >
            <option value="#000000">Solid Blackout (#000000)</option>
            <option value="#ffffff">Clean Whiteout (#ffffff)</option>
          </select>
          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
            Drag a rectangle over sensitive details to permanently cover them
          </span>
        </>
      )}
    </div>
  );
}
