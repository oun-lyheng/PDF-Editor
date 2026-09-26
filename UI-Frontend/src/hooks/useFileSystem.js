import { useState, useCallback, useEffect } from 'react';
import {
  checkBackendHealth,
  openDocumentViaNativeDialog,
  saveDocumentInPlace,
  saveDocumentAsDialog,
} from '../services/backendApi';

/**
 * Unified File System Hook
 * Prioritizes Local Feature-Based Node Backend for 100% reliable direct in-place disk overwrites
 * Gracefully falls back to browser File System Access API / downloads if backend is ever offline
 */
export function useFileSystem() {
  const [filePath, setFilePath] = useState(null); // Real Windows absolute path (e.g. D:\...)
  const [fileHandle, setFileHandle] = useState(null);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isBackendOnline, setIsBackendOnline] = useState(false);

  // Poll / check backend connection on load
  useEffect(() => {
    let isCancelled = false;

    async function checkHealth() {
      const isUp = await checkBackendHealth();
      if (!isCancelled) {
        setIsBackendOnline(isUp);
      }
    }

    checkHealth();
    const interval = setInterval(checkHealth, 8000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, []);

  /**
   * Open file via native Windows File Explorer (Backend) or browser fallback
   */
  const openFile = useCallback(async () => {
    // 1. Try local Node Backend (Native Windows Explorer dialog + real Windows disk path)
    try {
      const isUp = await checkBackendHealth();
      if (isUp) {
        setIsBackendOnline(true);
        const doc = await openDocumentViaNativeDialog();
        if (!doc) {
          return null; // User cancelled Windows dialog
        }

        setFilePath(doc.filePath);
        setFileName(doc.fileName);
        setFileSize(doc.fileSize);
        setFileHandle(null);
        setIsDirty(false);
        setSaveStatus('idle');
        setErrorMessage('');
        setStatusMessage(`Opened ${doc.fileName}`);

        return {
          buffer: doc.buffer,
          name: doc.fileName,
          path: doc.filePath,
          size: doc.fileSize,
          handle: null,
        };
      }
    } catch (backendErr) {
      console.warn('Backend open failed or unavailable, falling back to browser API:', backendErr);
    }

    // 2. Fallback: Browser File System Access API
    if (window.showOpenFilePicker) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [
            {
              description: 'PDF Documents (*.pdf)',
              accept: { 'application/pdf': ['.pdf'] },
            },
          ],
          multiple: false,
        });

        const file = await handle.getFile();
        const buffer = await file.arrayBuffer();

        setFilePath(null);
        setFileHandle(handle);
        setFileName(file.name);
        setFileSize(file.size);
        setIsDirty(false);
        setSaveStatus('idle');
        setErrorMessage('');
        setStatusMessage(`Opened ${file.name}`);

        return {
          buffer,
          name: file.name,
          path: null,
          size: file.size,
          handle,
        };
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Error opening file via File System API:', err);
        }
        return null;
      }
    }

    // 3. Fallback: Standard file input element
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) {
          resolve(null);
          return;
        }
        const buffer = await file.arrayBuffer();
        setFilePath(null);
        setFileHandle(null);
        setFileName(file.name);
        setFileSize(file.size);
        setIsDirty(false);
        setSaveStatus('idle');
        setErrorMessage('');
        setStatusMessage(`Opened ${file.name}`);
        resolve({
          buffer,
          name: file.name,
          path: null,
          size: file.size,
          handle: null,
        });
      };
      input.click();
    });
  }, []);

  /**
   * Load from a File object (e.g. from Drag & Drop)
   */
  const loadFromFileObject = useCallback(async (file) => {
    const buffer = await file.arrayBuffer();
    setFilePath(null);
    setFileHandle(null);
    setFileName(file.name);
    setFileSize(file.size);
    setIsDirty(false);
    setSaveStatus('idle');
    setErrorMessage('');
    setStatusMessage(`Loaded ${file.name}`);
    return {
      buffer,
      name: file.name,
      path: null,
      size: file.size,
    };
  }, []);

  /**
   * Pick an external PDF file to append/merge WITHOUT replacing the current active document path or name
   */
  const pickFileToAppend = useCallback(async () => {
    try {
      const isUp = await checkBackendHealth();
      if (isUp) {
        setIsBackendOnline(true);
        const doc = await openDocumentViaNativeDialog();
        if (!doc) return null;
        return {
          buffer: doc.buffer,
          name: doc.fileName,
          path: doc.filePath,
          size: doc.fileSize,
        };
      }
    } catch (e) {}

    if (window.showOpenFilePicker) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{ description: 'PDF Documents (*.pdf)', accept: { 'application/pdf': ['.pdf'] } }],
          multiple: false,
        });
        const file = await handle.getFile();
        const buffer = await file.arrayBuffer();
        return { buffer, name: file.name, path: null, size: file.size };
      } catch (e) {
        return null;
      }
    }

    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return resolve(null);
        const buffer = await file.arrayBuffer();
        resolve({ buffer, name: file.name, path: null, size: file.size });
      };
      input.click();
    });
  }, []);

  /**
   * Save / Overwrite file back to disk (Ctrl + S)
   * 1. If backend is online and filePath is known: 100% direct in-place overwrite on disk
   * 2. If browser fileHandle is held: overwrites via FileSystemFileHandle
   * 3. Fallback: instant browser download
   */
  const saveFile = useCallback(
    async (pdfBytes, targetName = fileName || 'document.pdf', isExportCopy = false) => {
      setIsSaving(true);
      setSaveStatus('saving');
      setStatusMessage('Saving document to disk...');
      setErrorMessage('');

      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      try {
        // 1. Local Node Backend In-Place Overwrite (Fastest, zero permissions, 100% reliable)
        const isUp = await checkBackendHealth();

        if (isUp && !isExportCopy) {
          if (filePath) {
            console.log(`[useFileSystem] Overwriting directly on disk via Backend: ${filePath}`);
            await saveDocumentInPlace(filePath, pdfBytes);

            setIsDirty(false);
            setSaveStatus('saved');
            setLastSavedTime(nowStr);
            setStatusMessage(`Overwritten directly to ${filePath}`);
            setIsSaving(false);

            setTimeout(() => {
              setSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev));
            }, 4000);

            return { success: true, filePath };
          } else {
            // No filePath bound yet (e.g. loaded from drag-and-drop or restored session):
            // Prompt native Windows dialog to choose / confirm the file on disk
            console.log('[useFileSystem] Prompting native Windows file dialog to choose target on disk...');
            const result = await saveDocumentAsDialog(targetName, pdfBytes);
            if (!result) {
              // User cancelled dialog
              setIsSaving(false);
              setSaveStatus('idle');
              return { success: false, cancelled: true };
            }

            setFilePath(result.filePath);
            setFileName(result.fileName);
            setIsDirty(false);
            setSaveStatus('saved');
            setLastSavedTime(nowStr);
            setStatusMessage(`Saved directly to ${result.filePath}`);
            setIsSaving(false);

            setTimeout(() => {
              setSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev));
            }, 4000);

            return { success: true, filePath: result.filePath };
          }
        }

        // 2. Direct overwrite using active FileHandle (Browser File System Access API)
        if (fileHandle && !isExportCopy) {
          try {
            if (fileHandle.queryPermission) {
              const qStatus = await fileHandle.queryPermission({ mode: 'readwrite' });
              if (qStatus !== 'granted' && fileHandle.requestPermission) {
                const reqStatus = await fileHandle.requestPermission({ mode: 'readwrite' });
                if (reqStatus !== 'granted') {
                  throw new Error('Permission to overwrite file denied');
                }
              }
            }

            const writable = await fileHandle.createWritable({ keepExistingData: false });
            await writable.write(pdfBytes);
            await writable.close();

            try {
              await fileHandle.getFile();
            } catch (syncErr) {}

            setIsDirty(false);
            setSaveStatus('saved');
            setLastSavedTime(nowStr);
            setStatusMessage(`Saved directly to ${fileHandle.name}`);
            setIsSaving(false);

            setTimeout(() => {
              setSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev));
            }, 4000);

            return { success: true };
          } catch (handleErr) {
            console.warn('Direct fileHandle write failed:', handleErr);
            if (handleErr.name === 'AbortError') {
              setIsSaving(false);
              setSaveStatus('idle');
              return { success: false, cancelled: true };
            }
          }
        }

        // 3. Fallback: Browser download
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = targetName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setIsDirty(false);
        setSaveStatus('saved');
        setLastSavedTime(nowStr);
        setStatusMessage(`Saved ${targetName}`);
        setIsSaving(false);

        setTimeout(() => {
          setSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev));
        }, 4000);

        return { success: true };
      } catch (err) {
        console.error('Failed to save file:', err);
        const msg = err.message || 'Unknown save error';
        setStatusMessage(`Error saving: ${msg}`);
        setErrorMessage(msg);
        setSaveStatus('error');
        setIsSaving(false);
        throw err;
      }
    },
    [filePath, fileHandle, fileName]
  );

  /**
   * Direct instant browser download
   */
  const downloadFile = useCallback(
    (pdfBytes, targetName = fileName || 'document.pdf') => {
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = targetName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setIsDirty(false);
      setSaveStatus('saved');
      setLastSavedTime(nowStr);
      setStatusMessage(`Downloaded ${targetName}`);
      setIsSaving(false);

      setTimeout(() => {
        setSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev));
      }, 4000);

      return true;
    },
    [fileName]
  );

  const resetFile = useCallback(() => {
    setFilePath(null);
    setFileName('');
    setFileSize(0);
    setFileHandle(null);
    setIsDirty(false);
    setSaveStatus('idle');
    setErrorMessage('');
    setStatusMessage('');
  }, []);

  return {
    filePath,
    setFilePath,
    fileHandle,
    setFileHandle,
    fileName,
    setFileName,
    fileSize,
    isDirty,
    setIsDirty,
    isSaving,
    setIsSaving,
    saveStatus,
    setSaveStatus,
    lastSavedTime,
    setLastSavedTime,
    errorMessage,
    setErrorMessage,
    statusMessage,
    setStatusMessage,
    isBackendOnline,
    openFile,
    pickFileToAppend,
    loadFromFileObject,
    saveFile,
    downloadFile,
    resetFile,
  };
}
