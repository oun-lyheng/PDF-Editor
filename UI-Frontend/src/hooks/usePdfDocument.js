import { useState, useCallback, useRef, useEffect } from 'react';
import { loadPdfDocument } from '../services/pdfRenderer';
import { exportModifiedPdf } from '../services/pdfExporter';

export function usePdfDocument() {
  const [pdfBytes, setPdfBytes] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1.35);
  
  // Page Organization State
  const [rotations, setRotations] = useState({}); // { [pageNum]: degrees (90, 180, 270) }
  const [deletedPages, setDeletedPages] = useState([]); // array of original page numbers deleted
  const [pageOrder, setPageOrder] = useState([]); // [1, 2, 3...]
  
  // In-Place Text Edits & Overwrites
  const [textEdits, setTextEdits] = useState([]); 
  // Each edit: { id, pageNumber, x, y, width, height, text, originalText, fontSize, fontFamily, textColor, backgroundColor, canvasWidth, canvasHeight }
  
  // Annotations (Signatures, Stamps, Redactions, Highlights)
  const [annotations, setAnnotations] = useState([]);

  // Undo / Redo History Stacks
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  
  // Active Interactive Tool
  // 'select' | 'editText' | 'addText' | 'signature' | 'stamp' | 'highlight' | 'redact'
  const [activeTool, setActiveTool] = useState('select');

  // Ref to always maintain immediate, synchronous state for exportDocument & snapshot creation
  const stateRef = useRef({
    pdfBytes,
    rotations,
    deletedPages,
    pageOrder,
    textEdits,
    annotations,
  });

  useEffect(() => {
    stateRef.current = {
      pdfBytes,
      rotations,
      deletedPages,
      pageOrder,
      textEdits,
      annotations,
    };
  }, [pdfBytes, rotations, deletedPages, pageOrder, textEdits, annotations]);

  // Create clean snapshot of document state
  const getSnapshot = useCallback(() => ({
    textEdits: stateRef.current.textEdits ? JSON.parse(JSON.stringify(stateRef.current.textEdits)) : [],
    annotations: stateRef.current.annotations ? JSON.parse(JSON.stringify(stateRef.current.annotations)) : [],
    rotations: { ...stateRef.current.rotations },
    deletedPages: [...stateRef.current.deletedPages],
    pageOrder: [...stateRef.current.pageOrder],
  }), []);

  const pushToHistory = useCallback(() => {
    const snap = getSnapshot();
    setUndoStack((prev) => [...prev.slice(-30), snap]);
    setRedoStack([]); // New action invalidates redo history
  }, [getSnapshot]);

  // Load a new document
  const loadDocument = useCallback(async (data) => {
    try {
      if (!data) return false;

      // Extract raw bytes regardless of ArrayBuffer or Uint8Array
      let rawBytes;
      if (data instanceof Uint8Array) {
        rawBytes = data;
      } else if (data instanceof ArrayBuffer) {
        rawBytes = new Uint8Array(data);
      } else {
        rawBytes = new Uint8Array(data);
      }

      // 1. workerBytes: Independent copy passed to pdf.js (worker may detach its buffer)
      const workerBytes = new Uint8Array(rawBytes.slice().buffer);
      // 2. storedBytes: Clean, persistent Uint8Array kept in state for exportDocument
      const storedBytes = new Uint8Array(rawBytes.slice().buffer);

      const doc = await loadPdfDocument(workerBytes);
      setPdfBytes(storedBytes);
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setCurrentPage(1);
      setRotations({});
      setDeletedPages([]);
      setPageOrder(Array.from({ length: doc.numPages }, (_, i) => i + 1));
      setTextEdits([]);
      setAnnotations([]);
      setUndoStack([]);
      setRedoStack([]);
      setActiveTool('select');
      return true;
    } catch (err) {
      console.error('Error loading PDF:', err);
      return false;
    }
  }, []);

  // Rotate a page by 90 degrees
  const rotatePage = useCallback((pageNumber, delta = 90) => {
    pushToHistory();
    setRotations((prev) => {
      const current = prev[pageNumber] || 0;
      const next = (current + delta) % 360;
      const updated = { ...prev, [pageNumber]: next };
      stateRef.current.rotations = updated;
      return updated;
    });
  }, [pushToHistory]);

  // Delete a page
  const deletePage = useCallback((pageNumber) => {
    pushToHistory();
    setDeletedPages((prev) => [...prev, pageNumber]);
    setPageOrder((prev) => prev.filter((p) => p !== pageNumber));
  }, [pushToHistory]);

  // Add or update an in-place text edit
  const upsertTextEdit = useCallback((edit) => {
    pushToHistory();
    setTextEdits((prev) => {
      const existsIndex = prev.findIndex((e) => e.id === edit.id);
      let updated;
      if (existsIndex >= 0) {
        updated = [...prev];
        updated[existsIndex] = { ...updated[existsIndex], ...edit };
      } else {
        updated = [...prev, edit];
      }
      stateRef.current.textEdits = updated;
      return updated;
    });
  }, [pushToHistory]);

  // Remove a text edit
  const removeTextEdit = useCallback((id) => {
    pushToHistory();
    setTextEdits((prev) => {
      const updated = prev.filter((e) => e.id !== id);
      stateRef.current.textEdits = updated;
      return updated;
    });
  }, [pushToHistory]);

  // Add an annotation (signature, stamp, redaction, etc.)
  const addAnnotation = useCallback((annotation) => {
    pushToHistory();
    const newAnnot = { ...annotation, id: `annot-${Date.now()}-${Math.random().toString(36).substr(2, 4)}` };
    setAnnotations((prev) => {
      const updated = [...prev, newAnnot];
      stateRef.current.annotations = updated;
      return updated;
    });
  }, [pushToHistory]);

  // Update annotation position or size
  const updateAnnotation = useCallback((id, updates) => {
    pushToHistory();
    setAnnotations((prev) => {
      const updated = prev.map((a) => (a.id === id ? { ...a, ...updates } : a));
      stateRef.current.annotations = updated;
      return updated;
    });
  }, [pushToHistory]);

  // Remove an annotation
  const removeAnnotation = useCallback((id) => {
    pushToHistory();
    setAnnotations((prev) => {
      const updated = prev.filter((a) => a.id !== id);
      stateRef.current.annotations = updated;
      return updated;
    });
  }, [pushToHistory]);

  // Undo last action (Ctrl + Z)
  const undo = useCallback(() => {
    if (undoStack.length === 0) return false;

    const currentSnap = getSnapshot();
    const prevSnap = undoStack[undoStack.length - 1];

    setRedoStack((prev) => [...prev, currentSnap]);
    setUndoStack((prev) => prev.slice(0, -1));

    setTextEdits(prevSnap.textEdits || []);
    setAnnotations(prevSnap.annotations || []);
    setRotations(prevSnap.rotations || {});
    setDeletedPages(prevSnap.deletedPages || []);
    setPageOrder(prevSnap.pageOrder || []);

    stateRef.current.textEdits = prevSnap.textEdits || [];
    stateRef.current.annotations = prevSnap.annotations || [];
    stateRef.current.rotations = prevSnap.rotations || {};
    stateRef.current.deletedPages = prevSnap.deletedPages || [];
    stateRef.current.pageOrder = prevSnap.pageOrder || [];

    return true;
  }, [undoStack, getSnapshot]);

  // Redo action (Ctrl + Y)
  const redo = useCallback(() => {
    if (redoStack.length === 0) return false;

    const currentSnap = getSnapshot();
    const nextSnap = redoStack[redoStack.length - 1];

    setUndoStack((prev) => [...prev, currentSnap]);
    setRedoStack((prev) => prev.slice(0, -1));

    setTextEdits(nextSnap.textEdits || []);
    setAnnotations(nextSnap.annotations || []);
    setRotations(nextSnap.rotations || {});
    setDeletedPages(nextSnap.deletedPages || []);
    setPageOrder(nextSnap.pageOrder || []);

    stateRef.current.textEdits = nextSnap.textEdits || [];
    stateRef.current.annotations = nextSnap.annotations || [];
    stateRef.current.rotations = nextSnap.rotations || {};
    stateRef.current.deletedPages = nextSnap.deletedPages || [];
    stateRef.current.pageOrder = nextSnap.pageOrder || [];

    return true;
  }, [redoStack, getSnapshot]);

  // Export current modified PDF to Uint8Array
  const exportDocument = useCallback(async () => {
    const curr = stateRef.current;
    console.log('⚙️ [exportDocument] Snapshot of document state:', {
      pdfBytesSize: curr.pdfBytes?.byteLength,
      textEditsCount: curr.textEdits?.length,
      textEdits: curr.textEdits,
      annotationsCount: curr.annotations?.length,
      rotations: curr.rotations,
    });
    if (!curr.pdfBytes || curr.pdfBytes.byteLength === 0) {
      console.warn('⚠️ [exportDocument] Cannot export: pdfBytes is null or empty!');
      return null;
    }
    // Always pass an independent slice so pdfDoc.save / PDFDocument.load never invalidates state
    const cleanBytes = new Uint8Array(curr.pdfBytes.slice().buffer);
    const resultBytes = await exportModifiedPdf(cleanBytes, {
      rotations: curr.rotations,
      deletedPages: curr.deletedPages,
      pageOrder: curr.pageOrder,
      textEdits: curr.textEdits,
      annotations: curr.annotations,
    });
    console.log('✅ [exportDocument] Compilation complete! Output size:', resultBytes?.byteLength, 'bytes');
    return resultBytes;
  }, []);

  // Revert all edits and restore original document
  const revertDocument = useCallback(async () => {
    if (!pdfBytes) return;
    setTextEdits([]);
    setAnnotations([]);
    setRotations({});
    setDeletedPages([]);
    const cleanBytes = new Uint8Array(pdfBytes.slice().buffer);
    const doc = await loadPdfDocument(cleanBytes);
    setPdfDoc(doc);
    setNumPages(doc.numPages);
    setPageOrder(Array.from({ length: doc.numPages }, (_, i) => i + 1));
    setUndoStack([]);
    setRedoStack([]);
    setActiveTool('select');
  }, [pdfBytes]);

  // Close document completely
  const closeDocument = useCallback(() => {
    setPdfBytes(null);
    setPdfDoc(null);
    setNumPages(0);
    setCurrentPage(1);
    setRotations({});
    setDeletedPages([]);
    setPageOrder([]);
    setTextEdits([]);
    setAnnotations([]);
    setUndoStack([]);
    setRedoStack([]);
    setActiveTool('select');
  }, []);

  return {
    pdfBytes,
    pdfDoc,
    numPages,
    currentPage,
    setCurrentPage,
    zoom,
    setZoom,
    rotations,
    deletedPages,
    pageOrder,
    setPageOrder,
    textEdits,
    annotations,
    activeTool,
    setActiveTool,
    loadDocument,
    rotatePage,
    deletePage,
    upsertTextEdit,
    removeTextEdit,
    addAnnotation,
    updateAnnotation,
    removeAnnotation,
    exportDocument,
    revertDocument,
    closeDocument,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  };
}
