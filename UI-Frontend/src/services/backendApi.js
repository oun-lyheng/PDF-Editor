const CANDIDATE_PORTS = [5000, 8000];
let activeBaseUrl = typeof window !== 'undefined' && window.location.port !== '5173' && window.location.port !== ''
  ? window.location.origin
  : 'http://localhost:5000';

export function getBackendBaseUrl() {
  return `${activeBaseUrl}/api/documents`;
}

export function getHealthUrl() {
  return `${activeBaseUrl}/health`;
}

/**
 * Convert Uint8Array or ArrayBuffer to base64 string
 */
function uint8ArrayToBase64(uint8Array) {
  let binary = '';
  const len = uint8Array.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return window.btoa(binary);
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToUint8Array(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Check if local backend is online, auto-detecting port 5000 or 8000
 */
export async function checkBackendHealth() {
  // 1. Try activeBaseUrl first
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`${activeBaseUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.ok) return true;
  } catch (err) {}

  // 2. Probe candidate ports (5000, 8000)
  for (const port of CANDIDATE_PORTS) {
    const candidate = `http://localhost:${port}`;
    if (candidate === activeBaseUrl) continue;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(`${candidate}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        console.log(`📡 [backendApi] Switched active backend to ${candidate}`);
        activeBaseUrl = candidate;
        return true;
      }
    } catch (err) {}
  }

  return false;
}

/**
 * Open PDF via native Windows Open File Dialog
 * @returns {Promise<{ filePath: string, fileName: string, buffer: ArrayBuffer, fileSize: number } | null>}
 */
export async function openDocumentViaNativeDialog() {
  const res = await fetch(`${getBackendBaseUrl()}/open-dialog`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || 'Failed to open file via dialog');
  }

  const result = await res.json();
  if (result.status === 'cancelled' || !result.data) {
    return null; // User cancelled
  }

  const { filePath, fileName, fileSize, base64Data } = result.data;
  const bytes = base64ToUint8Array(base64Data);

  return {
    filePath,
    fileName,
    fileSize,
    buffer: bytes.buffer,
  };
}

/**
 * Read PDF directly from known disk path
 */
export async function readDocumentFromPath(filePath) {
  const res = await fetch(`${getBackendBaseUrl()}/open-path`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || 'Failed to load file from disk path');
  }

  const result = await res.json();
  const { fileName, fileSize, base64Data } = result.data;
  const bytes = base64ToUint8Array(base64Data);

  return {
    filePath,
    fileName,
    fileSize,
    buffer: bytes.buffer,
  };
}

/**
 * Overwrite PDF directly in-place on disk
 * @param {string} filePath - Absolute path on disk
 * @param {Uint8Array} pdfBytes - Modified PDF bytes
 */
export async function saveDocumentInPlace(filePath, pdfBytes) {
  const base64Data = uint8ArrayToBase64(pdfBytes);

  const res = await fetch(`${getBackendBaseUrl()}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath, base64Data }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || 'Failed to overwrite file on disk');
  }

  return await res.json();
}

/**
 * Save As via native Windows Save File Dialog
 */
export async function saveDocumentAsDialog(suggestedName, pdfBytes) {
  const base64Data = uint8ArrayToBase64(pdfBytes);

  const res = await fetch(`${getBackendBaseUrl()}/save-as`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ suggestedName, base64Data }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || 'Failed to save copy');
  }

  const result = await res.json();
  if (result.status === 'cancelled') {
    return null;
  }

  return result.data;
}

/**
 * Apply text edits directly to PDF stream using PyMuPDF backend.
 * Physically removes old text glyphs and writes clean replacement text.
 * @param {string} filePath - Absolute path on disk
 * @param {Array} textEdits - Array of text edit items with coordinates and texts
 * @param {string} [targetPath] - Optional custom target path
 * @returns {Promise<{ filePath: string, fileName: string, buffer: ArrayBuffer, fileSize: number, editsApplied: number }>}
 */
export async function applyEditsViaBackend(filePath, textEdits, targetPath = null, inputBase64Data = null) {
  const res = await fetch(`${getBackendBaseUrl()}/apply-edits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath, base64Data: inputBase64Data, textEdits, targetPath }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || errData.message || 'Failed to apply PyMuPDF text edits');
  }

  const result = await res.json();
  const { fileName, fileSize, base64Data, editsApplied } = result.data;
  const bytes = base64ToUint8Array(base64Data);

  return {
    filePath: result.data.filePath,
    fileName,
    fileSize,
    editsApplied,
    buffer: bytes.buffer,
  };
}
