import React, { useState } from 'react';
import { AlertTriangle, Copy, Check, X } from 'lucide-react';

export function ErrorModal({ errorInfo, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!errorInfo) return null;

  const { title = 'Application Error', message = '', stack = '', context = '' } = errorInfo;

  const fullReport = `=== PDF Editor Error Report ===
Time: ${new Date().toISOString()}
Context: ${context || 'N/A'}
Error: ${message || 'Unknown error'}
Stack:
${stack || 'No stack trace available'}
================================`;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(fullReport);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = fullReport;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (e) {
      console.warn('Copy to clipboard failed:', e);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-container" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 640, width: '92%' }}
      >
        <div className="modal-header" style={{ borderBottom: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={18} style={{ color: '#ef4444' }} />
            <span style={{ fontWeight: 600, color: '#f87171' }}>{title}</span>
          </div>
          <button className="tool-btn" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {context && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              <strong>Action:</strong> {context}
            </div>
          )}

          <div style={{
            padding: '10px 12px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 'var(--radius-sm)',
            color: '#fca5a5',
            fontSize: 13,
            fontWeight: 500,
            wordBreak: 'break-word',
          }}>
            {message || 'An unexpected error occurred.'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-subtle)', fontWeight: 600, textTransform: 'uppercase' }}>
              Full Error Details & Stack Trace:
            </span>
            <pre style={{
              margin: 0,
              padding: 10,
              backgroundColor: '#0f1113',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 11,
              fontFamily: 'Consolas, monospace',
              color: '#94a3b8',
              maxHeight: 180,
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              userSelect: 'text',
            }}>
              {stack || message || 'No detailed stack trace'}
            </pre>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button
            className="tool-btn primary"
            onClick={handleCopy}
            style={{ 
              backgroundColor: copied ? '#15803d' : '#2563eb',
              borderColor: copied ? '#16a34a' : '#1d4ed8',
              padding: '0 14px' 
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span style={{ fontWeight: 600 }}>
              {copied ? '✓ Copied to Clipboard!' : 'Copy Error Details'}
            </span>
          </button>

          <button className="tool-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
