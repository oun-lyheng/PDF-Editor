import React, { useState, useEffect, useCallback } from 'react';
import { useFileSystem } from './hooks/useFileSystem';
import { usePdfDocument } from './hooks/usePdfDocument';
import { mergePdfDocuments, exportModifiedPdf } from './services/pdfExporter';
import { applyEditsViaBackend } from './services/backendApi';

import { MenuBar } from './components/Header/MenuBar';
import { PrimaryToolbar } from './components/Toolbar/PrimaryToolbar';
import { ToolPropertyBar } from './components/Toolbar/ToolPropertyBar';
import { ThumbnailPanel } from './components/Sidebar/ThumbnailPanel';
import { DocumentViewer } from './components/Viewport/DocumentViewer';
import { SignatureModal } from './components/Modals/SignatureModal';
import { ErrorModal } from './components/Modals/ErrorModal';
import { saveActiveSession, loadActiveSession, clearActiveSession } from './services/sessionStorage';

import './styles/enterprise.css';

export function App() {
  const fileSystem = useFileSystem();
  const pdfDocState = usePdfDocument();

  // Modals state
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [errorModalInfo, setErrorModalInfo] = useState(null);

  // Secondary property state
  const [textProps, setTextProps] = useState({
    fontFamily: 'Helvetica',
    fontSize: 14,
    isBold: false,
    textColor: '#000000',
    backgroundColor: '#ffffff',
  });
  const [redactColor, setRedactColor] = useState('#000000');

  // Loading / initialization state to eliminate background flash on refresh
  const [isInitializing, setIsInitializing] = useState(true);

  // Toast notification for user confirmation
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  }, []);

  // Helper to trigger copyable error modal
  const triggerErrorReport = useCallback((title, error, context = '') => {
    console.error(`[PDF-Editor Error] ${title}:`, error);
    const message = error?.message || (typeof error === 'string' ? error : 'An unexpected error occurred');
    const stack = error?.stack || (new Error().stack) || 'No stack trace available';
    setErrorModalInfo({
      title,
      message,
      stack,
      context,
    });
  }, []);

  // Global error interception (catches unhandled exceptions & promise rejections)
  useEffect(() => {
    const handleWindowError = (event) => {
      console.error('[Global Window Error]', event.error || event.message);
      triggerErrorReport(
        'Runtime Error',
        event.error || new Error(event.message || 'Window error'),
        `At ${event.filename || 'unknown'}:${event.lineno || 0}:${event.colno || 0}`
      );
    };

    const handleUnhandledRejection = (event) => {
      console.error('[Unhandled Promise Rejection]', event.reason);
      const err = event.reason instanceof Error 
        ? event.reason 
        : new Error(String(event.reason || 'Promise rejected without error object'));
      triggerErrorReport(
        'Unhandled Asynchronous Error',
        err,
        'An asynchronous task failed without being caught'
      );
    };

    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [triggerErrorReport]);

  // Auto-restore document session on page load / refresh
  useEffect(() => {
    let isCancelled = false;

    async function restoreSession() {
      try {
        const session = await loadActiveSession();
        if (session && session.buffer && !isCancelled) {
          const success = await pdfDocState.loadDocument(session.buffer);
          if (success && !isCancelled) {
            fileSystem.setFileName(session.fileName || 'document.pdf');
            if (session.filePath) {
              console.log('🔗 Restored filePath from session:', session.filePath);
              fileSystem.setFilePath(session.filePath);
            }
            if (session.handle) {
              console.log('🔗 Restored FileSystemFileHandle from session:', session.handle.name);
              fileSystem.setFileHandle(session.handle);
            }
          }
        }
      } catch (err) {
        console.error('Session restore failed:', err);
      } finally {
        if (!isCancelled) {
          setIsInitializing(false);
        }
      }
    }

    restoreSession();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Open file handler (Native Windows Dialog via Backend or Browser picker fallback)
  const handleOpenFile = async () => {
    try {
      const fileResult = await fileSystem.openFile();
      if (fileResult && fileResult.buffer) {
        await pdfDocState.loadDocument(fileResult.buffer);
        saveActiveSession(
          fileResult.name,
          fileResult.buffer,
          fileResult.handle || null,
          {},
          fileResult.path || null
        );
      }
    } catch (err) {
      triggerErrorReport('Open File Failed', err, 'Opening PDF file from local disk');
    }
  };

  // Drag & drop file handler
  const handleFileDrop = async (file) => {
    try {
      const fileResult = await fileSystem.loadFromFileObject(file);
      if (fileResult && fileResult.buffer) {
        await pdfDocState.loadDocument(fileResult.buffer);
        saveActiveSession(fileResult.name, fileResult.buffer, null, {}, null);
      }
    } catch (err) {
      triggerErrorReport('File Drop Failed', err, `Reading dropped file: ${file?.name || 'unknown'}`);
    }
  };

  // Save & Replace file on disk (Direct in-place overwrite via Backend or Handle)
  const handleSave = useCallback(async () => {
    console.log('🚀 [SAVE Step 1] handleSave invoked', {
      hasPdfBytes: Boolean(pdfDocState.pdfBytes),
      byteLength: pdfDocState.pdfBytes?.byteLength,
      fileName: fileSystem.fileName,
      filePath: fileSystem.filePath,
      hasFileHandle: Boolean(fileSystem.fileHandle),
      isDirty: fileSystem.isDirty,
    });

    if (!pdfDocState.pdfBytes) {
      console.warn('⚠️ [SAVE] Aborting: No PDF document loaded in memory!');
      return;
    }

    try {
      fileSystem.setIsSaving(true);
      fileSystem.setSaveStatus('saving');

      let modifiedBytes = null;
      let activeDiskPath = fileSystem.filePath;

      // 1. If backend is online and we have text edits, use PyMuPDF for TRUE stream redaction
      if (fileSystem.isBackendOnline && fileSystem.filePath && pdfDocState.textEdits?.length > 0) {
        console.log(`⚡ [SAVE Step 2] Using PyMuPDF true stream redaction for ${pdfDocState.textEdits.length} text edit(s)...`);
        const pymupdfResult = await applyEditsViaBackend(fileSystem.filePath, pdfDocState.textEdits);
        modifiedBytes = new Uint8Array(pymupdfResult.buffer);
        activeDiskPath = pymupdfResult.filePath;
        console.log(`✅ [SAVE Step 3] PyMuPDF cleanly sanitized & replaced ${pymupdfResult.editsApplied} text items in-place!`);

        // If annotations (stamps, signatures, redactions) also exist, compile them onto the sanitized PDF
        if (pdfDocState.annotations?.length > 0 || Object.keys(pdfDocState.rotations || {}).length > 0) {
          console.log(`📑 [SAVE Step 3.1] Compiling ${pdfDocState.annotations?.length || 0} annotation(s) onto sanitized PDF...`);
          modifiedBytes = await exportModifiedPdf(modifiedBytes, {
            rotations: pdfDocState.rotations,
            deletedPages: pdfDocState.deletedPages,
            pageOrder: pdfDocState.pageOrder,
            textEdits: [], // already sanitized by PyMuPDF
            annotations: pdfDocState.annotations,
          });
          await fileSystem.saveFile(modifiedBytes, fileSystem.fileName || 'document.pdf');
        }
      } else {
        // Standard path: compile via pdf-lib and overwrite
        console.log('⚙️ [SAVE Step 2] Compiling document edits via pdfDocState.exportDocument()...');
        modifiedBytes = await pdfDocState.exportDocument();

        if (!modifiedBytes) {
          fileSystem.setIsSaving(false);
          fileSystem.setSaveStatus('idle');
          triggerErrorReport('PDF Export Empty', new Error('exportDocument() returned null or empty bytes'), 'Verifying compiled PDF output');
          return;
        }

        console.log('📦 [SAVE Step 2.1] Compilation finished. Output bytes length:', modifiedBytes.byteLength);

        console.log('💾 [SAVE Step 3] Overwriting directly on disk via fileSystem.saveFile()...');
        const saveResult = await fileSystem.saveFile(modifiedBytes, fileSystem.fileName || 'document.pdf');

        if (saveResult && saveResult.cancelled) {
          return;
        }

        activeDiskPath = saveResult?.filePath || fileSystem.filePath || null;
      }

      // 3. Update active session in IndexedDB
      saveActiveSession(
        fileSystem.fileName || 'document.pdf',
        modifiedBytes.slice(),
        fileSystem.fileHandle || null,
        {},
        activeDiskPath
      );

      // 4. Reload baseline document in memory so future edits build on this version
      await pdfDocState.loadDocument(modifiedBytes.slice());

      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      fileSystem.setLastSavedTime(nowTime);
      fileSystem.setIsSaving(false);
      fileSystem.setSaveStatus('saved');
      fileSystem.setIsDirty(false);
      setTimeout(() => {
        fileSystem.setSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev));
      }, 3500);
      showToast(`✓ Overwritten ${fileSystem.fileName || 'document.pdf'} directly on disk!`, 'success');
    } catch (err) {
      console.error('❌ [SAVE Critical Error]:', err);
      fileSystem.setIsSaving(false);
      fileSystem.setSaveStatus('idle');
      triggerErrorReport('Save Operation Error', err, 'Executing handleSave');
      showToast(`⚠ Save failed: ${err.message}`, 'error');
    }
  }, [pdfDocState, fileSystem, showToast, triggerErrorReport]);

  // Export copy as new PDF
  const handleSaveAs = useCallback(async () => {
    if (!pdfDocState.pdfBytes) return;
    try {
      fileSystem.setIsSaving(true);
      const baseName = fileSystem.fileName ? fileSystem.fileName.replace('.pdf', '') : 'document';
      const targetName = `${baseName}-edited.pdf`;

      const modifiedBytes = await pdfDocState.exportDocument();
      if (!modifiedBytes) {
        fileSystem.setIsSaving(false);
        showToast('Failed to compile document', 'error');
        return;
      }

      const saveResult = await fileSystem.saveFile(modifiedBytes, targetName, true);
      if (saveResult && saveResult.cancelled) {
        return;
      }

      showToast(`✓ Exported copy as ${targetName}!`, 'success');
    } catch (err) {
      console.error('Export copy error:', err);
      fileSystem.setIsSaving(false);
      showToast(`⚠ Error exporting copy: ${err.message}`, 'error');
    }
  }, [pdfDocState, fileSystem, showToast]);

  // Merge another PDF file into the active document (Adobe Acrobat Combine Files pattern)
  const handleMergePdf = async () => {
    try {
      const fileResult = await fileSystem.pickFileToAppend();
      if (fileResult && fileResult.buffer && pdfDocState.pdfBytes) {
        const mergedBytes = await mergePdfDocuments([pdfDocState.pdfBytes, fileResult.buffer]);
        await pdfDocState.loadDocument(mergedBytes);
        // Like Adobe Acrobat: preserve original files, name new combined document, and prompt Save As on save
        const base = fileSystem.fileName ? fileSystem.fileName.replace('.pdf', '') : 'document';
        fileSystem.setFileName(`${base}-merged.pdf`);
        fileSystem.setFilePath(null); // Clear original disk path so File 1 is never accidentally overwritten
        fileSystem.setIsDirty(true);
        showToast(`✓ Combined ${fileResult.name} into document (${pdfDocState.numPages + 1} pages total)`, 'success');
      }
    } catch (err) {
      triggerErrorReport('PDF Merge Failed', err, 'Merging PDF documents together');
    }
  };

  // Rotate current page view (View-Only, does not mark document dirty)
  const handleRotateCurrentPage = () => {
    pdfDocState.rotatePage(pdfDocState.currentPage, 90);
  };

  // Place digital signature on current page
  const handleSaveSignature = (imageDataUrl) => {
    pdfDocState.addAnnotation({
      pageNumber: pdfDocState.currentPage,
      type: 'signature',
      imageDataUrl,
      x: 100,
      y: 150,
      width: 180,
      height: 70,
    });
    fileSystem.setIsDirty(true);
  };

  // Global Keyboard Shortcuts (Ctrl+S, Ctrl+O)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl + S: Save in place
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
      // Ctrl + O: Open file
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handleOpenFile();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleOpenFile]);

  // Listen for changes to mark dirty
  const handleUpsertTextEdit = (edit) => {
    pdfDocState.upsertTextEdit(edit);
    fileSystem.setIsDirty(true);
  };

  const handleRemoveTextEdit = (id) => {
    pdfDocState.removeTextEdit(id);
    fileSystem.setIsDirty(true);
  };

  const handleAddAnnotation = (annot) => {
    pdfDocState.addAnnotation(annot);
    fileSystem.setIsDirty(true);
  };

  const handleUpdateAnnotation = (id, updates) => {
    pdfDocState.updateAnnotation(id, updates);
    fileSystem.setIsDirty(true);
  };

  const handleRemoveAnnotation = (id) => {
    pdfDocState.removeAnnotation(id);
    fileSystem.setIsDirty(true);
  };

  // Discard all unsaved changes and revert back to clean original document
  const handleDiscardChanges = useCallback(async () => {
    if (!window.confirm('Discard all unsaved edits and revert back to the original PDF?')) {
      return;
    }
    await pdfDocState.revertDocument();
    fileSystem.setIsDirty(false);
    showToast('✓ All unsaved edits discarded. Reverted to original PDF.', 'info');
  }, [pdfDocState, fileSystem, showToast]);

  // Close the current document
  const handleCloseDocument = useCallback(async () => {
    if (fileSystem.isDirty) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to close without saving?')) {
        return;
      }
    }
    pdfDocState.closeDocument();
    fileSystem.resetFile();
    await clearActiveSession();
    showToast('Document closed.', 'info');
  }, [fileSystem, pdfDocState, showToast]);

  // Sidebar visibility toggle
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="pdf-app-container">
      {/* 1. Header / Menubar */}
      <MenuBar
        fileName={fileSystem.fileName}
        filePath={fileSystem.filePath}
        isDirty={fileSystem.isDirty}
        isSaving={fileSystem.isSaving}
        saveStatus={fileSystem.saveStatus}
        lastSavedTime={fileSystem.lastSavedTime}
        errorMessage={fileSystem.errorMessage}
        hasFileHandle={Boolean(fileSystem.filePath || fileSystem.fileHandle)}
        isBackendOnline={fileSystem.isBackendOnline}
        onOpen={handleOpenFile}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onDiscardChanges={handleDiscardChanges}
        onCloseDocument={handleCloseDocument}
      />

      {/* 2. Primary Toolset Bar */}
      <PrimaryToolbar
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        activeTool={pdfDocState.activeTool}
        setActiveTool={pdfDocState.setActiveTool}
        zoom={pdfDocState.zoom}
        setZoom={pdfDocState.setZoom}
        onRotateCurrentPage={handleRotateCurrentPage}
        hasDocument={Boolean(pdfDocState.pdfDoc)}
        onOpenSignatureModal={() => setIsSignatureModalOpen(true)}
      />

      {/* 3. Secondary Property Inspector Bar */}
      <ToolPropertyBar
        activeTool={pdfDocState.activeTool}
        textProps={textProps}
        setTextProps={setTextProps}
        redactColor={redactColor}
        setRedactColor={setRedactColor}
      />

      {/* 4. Main 2-Pane Workstation Workspace */}
      <div className="app-workspace">
        {pdfDocState.pdfDoc && (
          <ThumbnailPanel
            isOpen={isSidebarOpen}
            pdfDoc={pdfDocState.pdfDoc}
            pageOrder={pdfDocState.pageOrder}
            currentPage={pdfDocState.currentPage}
            rotations={pdfDocState.rotations}
            onSelectPage={(num) => {
              pdfDocState.setCurrentPage(num);
              const targetEl = document.getElementById(`page-wrapper-${num}`);
              if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }}
            onRotatePage={(num) => {
              pdfDocState.rotatePage(num, 90);
            }}
            onDeletePage={(num) => {
              pdfDocState.deletePage(num);
              fileSystem.setIsDirty(true);
            }}
            onReorderPages={(newOrder) => {
              pdfDocState.setPageOrder(newOrder);
              fileSystem.setIsDirty(true);
            }}
            onMergePdf={handleMergePdf}
            onCloseSidebar={() => setIsSidebarOpen(false)}
          />
        )}

        <DocumentViewer
          isInitializing={isInitializing}
          pdfDoc={pdfDocState.pdfDoc}
          pageOrder={pdfDocState.pageOrder}
          zoom={pdfDocState.zoom}
          rotations={pdfDocState.rotations}
          activeTool={pdfDocState.activeTool}
          textProps={textProps}
          redactColor={redactColor}
          textEdits={pdfDocState.textEdits}
          onUpsertTextEdit={handleUpsertTextEdit}
          onRemoveTextEdit={handleRemoveTextEdit}
          annotations={pdfDocState.annotations}
          onAddAnnotation={handleAddAnnotation}
          onUpdateAnnotation={handleUpdateAnnotation}
          onRemoveAnnotation={handleRemoveAnnotation}
          onFileDrop={handleFileDrop}
          onOpenFilePicker={handleOpenFile}
        />
      </div>

      {/* 5. Modals */}
      <SignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onSaveSignature={handleSaveSignature}
      />

      <ErrorModal
        errorInfo={errorModalInfo}
        onClose={() => setErrorModalInfo(null)}
      />

      {/* 6. Save Toast Confirmation Pill */}
      {toast && (
        <div className={`save-toast ${toast.type === 'error' ? 'error' : ''}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default App;
