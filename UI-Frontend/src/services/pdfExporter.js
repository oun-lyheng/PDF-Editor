import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';

/**
 * Apply text edits, annotations, page rotations, and signatures into a new PDF
 * @param {ArrayBuffer|Uint8Array} originalPdfBytes
 * @param {Object} documentState - { rotations, deletedPages, pageOrder, textEdits, annotations }
 * @returns {Promise<Uint8Array>}
 */
export async function exportModifiedPdf(originalPdfBytes, documentState) {
  const {
    rotations = {},
    deletedPages = [],
    pageOrder = [],
    textEdits = [],
    annotations = [],
  } = documentState;

  console.log(`📑 [pdfExporter] Compiling PDF (Original size: ${originalPdfBytes?.byteLength} bytes, Edits count: ${textEdits.length}, Annotations: ${annotations.length})`);
  if (textEdits.length > 0) {
    textEdits.forEach((edit, idx) => {
      console.log(`  ✏️ [pdfExporter] Applying Edit #${idx + 1}: "${edit.originalText || ''}" -> "${edit.text}" (Page ${edit.pageNumber})`, {
        pdfX: edit.pdfX,
        pdfY: edit.pdfY,
        pdfFontSize: edit.pdfFontSize,
      });
    });
  } else {
    console.log('  ℹ️ [pdfExporter] Notice: textEdits array is currently empty []');
  }

  let pdfDoc;
  try {
    pdfDoc = await PDFDocument.load(originalPdfBytes, { ignoreEncryption: true });
  } catch (loadErr) {
    console.error('[Export Error] Failed to parse PDF bytes with pdf-lib:', loadErr);
    throw new Error(`Failed to load PDF for export: ${loadErr.message}`);
  }
  
  // Standard fonts for text overlays
  let helveticaFont, helveticaBold, timesFont, courierFont;
  try {
    helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    timesFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    courierFont = await pdfDoc.embedFont(StandardFonts.Courier);
  } catch (fontErr) {
    console.error('[Export Error] Failed to embed standard fonts:', fontErr);
    throw new Error(`Failed to embed standard fonts: ${fontErr.message}`);
  }

  const getFont = (family, isBold) => {
    if (family?.toLowerCase().includes('times')) return timesFont;
    if (family?.toLowerCase().includes('courier')) return courierFont;
    return isBold ? helveticaBold : helveticaFont;
  };

  const pages = pdfDoc.getPages();
  const numOriginalPages = pages.length;

  // 1. Apply Text Edits & In-Place Patches (Whiteout + New Text)
  for (const edit of textEdits) {
    const pageIndex = edit.pageNumber - 1;
    if (pageIndex < 0 || pageIndex >= numOriginalPages) continue;
    const page = pages[pageIndex];
    const { width: pageWidth, height: pageHeight } = page.getSize();
    const pageRotation = page.getRotation().angle;

    const font = getFont(edit.fontFamily, edit.isBold);
    const safeText = sanitizeForWinAnsi(edit.text);
    const textColor = hexToRgb(edit.textColor || '#000000');
    const bgColor = hexToRgb(edit.backgroundColor || '#ffffff');

    // Case 1: High-precision native PDF points from original document (extracted via pdfjs-dist)
    if (edit.pdfX !== undefined && edit.pdfY !== undefined && edit.pdfFontSize !== undefined) {
      const fontSize = edit.pdfFontSize;
      const baselineY = edit.pdfY;
      const pdfX = edit.pdfX;

      // Full typographical coverage:
      // descender ~ 28% of fontSize, ascenders/caps ~ 95% of fontSize
      const descender = fontSize * 0.28;
      const ascender = fontSize * 0.95;
      const boxY = baselineY - descender;
      const boxHeight = ascender + descender;

      let newTextWidth = 0;
      try {
        newTextWidth = font.widthOfTextAtSize(safeText, fontSize);
      } catch (e) {
        newTextWidth = edit.pdfWidth || 50;
      }

      // The white box MUST cover the original text width (edit.pdfWidth) AND any expanded new text
      const originalPdfWidth = edit.pdfWidth || 0;
      const boxWidth = Math.max(newTextWidth, originalPdfWidth) + 4;

      // 1. Draw solid white rectangle that exactly covers the old text
      page.drawRectangle({
        x: Math.max(0, pdfX - 1.5),
        y: boxY,
        width: boxWidth,
        height: boxHeight,
        color: rgb(bgColor.r, bgColor.g, bgColor.b),
        opacity: 1.0,
      });

      // 2. Draw new text precisely at the same position
      if (safeText.length > 0) {
        try {
          page.drawText(safeText, {
            x: pdfX,
            y: baselineY,
            size: fontSize,
            font: font,
            color: rgb(textColor.r, textColor.g, textColor.b),
          });
        } catch (err) {
          console.warn('Failed to draw text item with font:', err);
        }
      }
    } else {
      // Case 2: Custom added text box (from "Add Text" tool)
      const scaleX = pageWidth / (edit.canvasFullWidth || edit.canvasWidth || 1);
      const scaleY = pageHeight / (edit.canvasFullHeight || edit.canvasHeight || 1);

      const pdfX = edit.x * scaleX;
      const pdfW = Math.max(edit.width * scaleX, 10);
      const pdfH = Math.max(edit.height * scaleY, 8);
      const pdfY = pageHeight - (edit.y * scaleY) - pdfH;
      const scaledFontSize = Math.max(6, (edit.fontSize || 12) * scaleY);

      if (edit.backgroundColor && edit.backgroundColor !== 'transparent') {
        page.drawRectangle({
          x: pdfX,
          y: pdfY,
          width: pdfW,
          height: pdfH,
          color: rgb(bgColor.r, bgColor.g, bgColor.b),
        });
      }

      if (safeText.length > 0) {
        const baselineY = pdfY + Math.max(1, (pdfH - scaledFontSize) / 2);
        try {
          page.drawText(safeText, {
            x: pdfX,
            y: baselineY,
            size: scaledFontSize,
            font: font,
            color: rgb(textColor.r, textColor.g, textColor.b),
          });
        } catch (err) {
          console.warn('Failed to draw custom text item:', err);
        }
      }
    }
  }

  // 2. Apply Annotations (Signatures, Stamps, Redactions, Highlights)
  for (const annot of annotations) {
    const pageIndex = annot.pageNumber - 1;
    if (pageIndex < 0 || pageIndex >= numOriginalPages) continue;
    const page = pages[pageIndex];
    const { width: pageWidth, height: pageHeight } = page.getSize();

    const cWidth = annot.canvasWidth || pageWidth;
    const cHeight = annot.canvasHeight || pageHeight;

    const pdfX = (annot.x / cWidth) * pageWidth;
    const pdfY = pageHeight - ((annot.y + annot.height) / cHeight) * pageHeight;
    const pdfW = (annot.width / cWidth) * pageWidth;
    const pdfH = (annot.height / cHeight) * pageHeight;

    if (annot.type === 'redaction') {
      const color = hexToRgb(annot.color || '#000000');
      page.drawRectangle({
        x: pdfX,
        y: pdfY,
        width: pdfW,
        height: pdfH,
        color: rgb(color.r, color.g, color.b),
      });
    } else if (annot.type === 'highlight') {
      page.drawRectangle({
        x: pdfX,
        y: pdfY,
        width: pdfW,
        height: pdfH,
        color: rgb(0.98, 0.8, 0.08),
        opacity: 0.35,
      });
    } else if (annot.type === 'image' || annot.type === 'signature' || annot.type === 'stamp') {
      if (annot.imageDataUrl) {
        try {
          const imageBytes = dataUriToUint8Array(annot.imageDataUrl);
          const embeddedImage = await pdfDoc.embedPng(imageBytes);
          page.drawImage(embeddedImage, {
            x: pdfX,
            y: pdfY,
            width: pdfW,
            height: pdfH,
          });
        } catch (e) {
          console.warn('Failed to embed PNG image annotation:', e);
        }
      }
    }
  }

  // 3. Apply Page Rotations
  Object.entries(rotations).forEach(([pageNumStr, angle]) => {
    const pageIdx = parseInt(pageNumStr, 10) - 1;
    if (pageIdx >= 0 && pageIdx < pages.length) {
      const currentRotation = pages[pageIdx].getRotation().angle;
      pages[pageIdx].setRotation(degrees((currentRotation + angle) % 360));
    }
  });

  // 4. Handle Page Deletions or Reordering
  try {
    if (deletedPages.length > 0 || (pageOrder.length > 0 && pageOrder.length !== numOriginalPages)) {
      // Build new document containing only retained & reordered pages
      const newDoc = await PDFDocument.create();
      const finalOrder = pageOrder.length > 0 
        ? pageOrder.filter(p => !deletedPages.includes(p))
        : Array.from({ length: numOriginalPages }, (_, i) => i + 1).filter(p => !deletedPages.includes(p));

      const copiedPages = await newDoc.copyPages(
        pdfDoc, 
        finalOrder.map(p => p - 1)
      );

      copiedPages.forEach(p => newDoc.addPage(p));
      const resultBytes = await newDoc.save();
      console.log(`[Export] Successfully compiled modified PDF (Pages: ${finalOrder.length}, Size: ${resultBytes.byteLength} bytes)`);
      return resultBytes;
    }

    // Save modified original document
    const resultBytes = await pdfDoc.save();
    console.log(`[Export] Successfully compiled modified PDF (Size: ${resultBytes.byteLength} bytes)`);
    return resultBytes;
  } catch (saveErr) {
    console.error('[Export Error] pdfDoc.save() failed:', saveErr);
    throw new Error(`Failed to compile PDF document bytes: ${saveErr.message}`);
  }
}

/**
 * Merge two or more PDF ArrayBuffers into a single document
 */
export async function mergePdfDocuments(pdfBytesList) {
  const mergedPdf = await PDFDocument.create();

  for (const bytes of pdfBytesList) {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const copiedPages = await mergedPdf.copyPages(doc, doc.getPageIndices());
    copiedPages.forEach(page => mergedPdf.addPage(page));
  }

  return await mergedPdf.save();
}

function hexToRgb(hex) {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  const num = parseInt(cleanHex, 16);
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255,
  };
}

function editFallback(val) {
  return val || 1;
}

function dataUriToUint8Array(dataUri) {
  const base64 = dataUri.split(',')[1];
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function sanitizeForWinAnsi(str) {
  if (!str) return '';
  return str
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(/\u2022/g, '*')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ');
}

/**
 * Crop a specific PDF page to the given rectangle using pdf-lib
 * @param {Uint8Array} originalPdfBytes
 * @param {number} pageNumber - 1-indexed page number
 * @param {Object} cropRect - { x, y, width, height } in canvas pixels
 * @param {Object} pageDimensions - { width, height } canvas pixel dimensions
 * @returns {Promise<Uint8Array>}
 */
export async function cropPdfPage(originalPdfBytes, pageNumber, cropRect, pageDimensions) {
  const pdfDoc = await PDFDocument.load(originalPdfBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  const pageIdx = pageNumber - 1;
  if (pageIdx < 0 || pageIdx >= pages.length) {
    throw new Error(`Page ${pageNumber} out of range`);
  }

  const page = pages[pageIdx];
  const { width: pageWidth, height: pageHeight } = page.getSize();
  const rotation = (page.getRotation().angle || 0) % 360;

  let pdfX, pdfY, pdfW, pdfH;

  if (rotation === 90) {
    const scaleX = pageHeight / pageDimensions.width;
    const scaleY = pageWidth / pageDimensions.height;
    pdfX = cropRect.y * scaleY;
    pdfW = cropRect.height * scaleY;
    pdfH = cropRect.width * scaleX;
    pdfY = cropRect.x * scaleX;
  } else if (rotation === 180) {
    const scaleX = pageWidth / pageDimensions.width;
    const scaleY = pageHeight / pageDimensions.height;
    pdfW = cropRect.width * scaleX;
    pdfH = cropRect.height * scaleY;
    pdfX = pageWidth - (cropRect.x * scaleX) - pdfW;
    pdfY = cropRect.y * scaleY;
  } else if (rotation === 270) {
    const scaleX = pageHeight / pageDimensions.width;
    const scaleY = pageWidth / pageDimensions.height;
    pdfW = cropRect.height * scaleY;
    pdfH = cropRect.width * scaleX;
    pdfX = pageWidth - (cropRect.y * scaleY) - pdfW;
    pdfY = pageHeight - (cropRect.x * scaleX) - pdfH;
  } else {
    // 0 degrees (standard)
    const scaleX = pageWidth / pageDimensions.width;
    const scaleY = pageHeight / pageDimensions.height;
    pdfX = cropRect.x * scaleX;
    pdfW = cropRect.width * scaleX;
    pdfH = cropRect.height * scaleY;
    pdfY = pageHeight - (cropRect.y * scaleY) - pdfH;
  }

  // Ensure positive dimensions and valid bounds
  pdfW = Math.max(10, pdfW);
  pdfH = Math.max(10, pdfH);

  page.setCropBox(pdfX, pdfY, pdfW, pdfH);
  page.setMediaBox(pdfX, pdfY, pdfW, pdfH);

  return await pdfDoc.save();
}

