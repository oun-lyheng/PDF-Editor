import * as pdfjsLib from 'pdfjs-dist';

// Use bundled local worker from public directory - 100% offline, zero network requests
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

/**
 * Load PDF Document from ArrayBuffer or Uint8Array
 */
export async function loadPdfDocument(data) {
  // Always slice into an independent Uint8Array so worker transfer cannot detach caller's memory
  const safeData = data instanceof Uint8Array 
    ? new Uint8Array(data.slice().buffer)
    : new Uint8Array(new Uint8Array(data).slice().buffer);

  const loadingTask = pdfjsLib.getDocument({
    data: safeData,
    cMapUrl: undefined,
    cMapPacked: false,
    standardFontDataUrl: undefined,
  });
  return await loadingTask.promise;
}

/**
 * Render a single PDF page to a target canvas
 */
export async function renderPdfPage(pdfDoc, pageNumber, canvas, scale = 1.0, rotation = 0) {
  const page = await pdfDoc.getPage(pageNumber);
  const totalRotation = (page.rotate + rotation) % 360;
  const cropBox = page.view || null;

  const viewport = page.getViewport({ scale, rotation: totalRotation, viewBox: cropBox });
  const outputScale = Math.max(window.devicePixelRatio || 1, 2.5);

  // Render to full viewport first with a clean solid white sheet
  const fullCanvas = document.createElement('canvas');
  fullCanvas.width = Math.floor(viewport.width * outputScale);
  fullCanvas.height = Math.floor(viewport.height * outputScale);
  const fullCtx = fullCanvas.getContext('2d');
  fullCtx.fillStyle = '#ffffff';
  fullCtx.fillRect(0, 0, fullCanvas.width, fullCanvas.height);

  // Native PDF.js HiDPI rendering via transform matrix for crystal-sharp text
  await page.render({
    canvasContext: fullCtx,
    viewport: viewport,
    transform: [outputScale, 0, 0, outputScale, 0, 0],
  }).promise;

  let finalWidth = Math.floor(viewport.width);
  const finalHeight = Math.floor(viewport.height);

  // Fast Pixel Auto-Trim: Scan columns from right to left to automatically eliminate empty white margin
  try {
    const imgData = fullCtx.getImageData(0, 0, fullCanvas.width, fullCanvas.height);
    const data = imgData.data;
    const w = fullCanvas.width;
    const h = fullCanvas.height;
    let rightmostX = 0;

    // Sample columns from right to left (starting at 98% width down to 35% width)
    for (let x = Math.floor(w * 0.98); x >= Math.floor(w * 0.35); x -= 3) {
      let hasContent = false;
      // Sample down the column vertically
      for (let y = Math.floor(h * 0.04); y < Math.floor(h * 0.96); y += 4) {
        const idx = (y * w + x) * 4;
        const a = data[idx + 3];
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        // Content pixel: opaque and not white/near-white
        if (a > 100 && (r < 230 || g < 230 || b < 230)) {
          hasContent = true;
          break;
        }
      }
      if (hasContent) {
        rightmostX = x;
        break;
      }
    }

    if (rightmostX > 0 && rightmostX < w * 0.93) {
      // Add a neat 12px margin and trim the empty right space
      finalWidth = Math.min(viewport.width, Math.round((rightmostX / outputScale) + 12));
    }
  } catch (e) {
    console.warn('Auto-trim right space error:', e);
  }

  // Draw the cleanly trimmed canvas with high quality smoothing
  canvas.width = Math.floor(finalWidth * outputScale);
  canvas.height = Math.floor(finalHeight * outputScale);
  canvas.style.width = finalWidth + 'px';
  canvas.style.height = finalHeight + 'px';

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    fullCanvas,
    0, 0, Math.floor(finalWidth * outputScale), Math.floor(finalHeight * outputScale),
    0, 0, Math.floor(finalWidth * outputScale), Math.floor(finalHeight * outputScale)
  );

  return {
    width: finalWidth,
    height: finalHeight,
    fullWidth: viewport.width,
    scale,
  };
}

/**
 * Extract all text spans with precise bounding coordinates for the "Edit Text" feature
 */
export async function extractPageTextItems(pdfDoc, pageNumber, scale = 1.0, rotation = 0) {
  const page = await pdfDoc.getPage(pageNumber);
  const totalRotation = (page.rotate + rotation) % 360;
  let cropBox = page.view || null;

  if (cropBox && cropBox.length === 4) {
    try {
      const baseViewport = page.getViewport({ scale: 1.0, rotation: totalRotation, viewBox: cropBox });
      const textContent = await page.getTextContent();
      
      if (textContent.items && textContent.items.length > 3) {
        let maxScreenX = 0;
        
        for (const item of textContent.items) {
          if (!item.str || item.str.trim() === '') continue;
          const tx = pdfjsLib.Util.transform(baseViewport.transform, item.transform);
          const screenX = tx[4] + (item.width || 0);
          if (screenX > maxScreenX) maxScreenX = screenX;
        }

        const widthRatio = maxScreenX / baseViewport.width;
        if (widthRatio > 0.4 && widthRatio < 0.93) {
          const trimRatio = Math.min(1.0, (maxScreenX + 18) / baseViewport.width);
          const [xMin, yMin, xMax, yMax] = cropBox;
          
          if (totalRotation === 0 || totalRotation === 180) {
            const newXMax = xMin + (xMax - xMin) * trimRatio;
            cropBox = [xMin, yMin, newXMax, yMax];
          } else {
            const newYMax = yMin + (yMax - yMin) * trimRatio;
            cropBox = [xMin, yMin, xMax, newYMax];
          }
        }
      }
    } catch (e) {}
  }

  const viewport = page.getViewport({ scale, rotation: totalRotation, viewBox: cropBox });
  const textContent = await page.getTextContent({ disableCombineTextItems: false });

  const rawItems = [];

  for (const item of textContent.items) {
    if (!item.str || item.str.trim() === '') continue;

    // Exact native PDF point metrics (origin bottom-left in PDF user space)
    const pdfFontSize = Math.hypot(item.transform[0], item.transform[1]) || item.height || 12;
    const pdfX = item.transform[4];
    const pdfY = item.transform[5]; // Baseline in PDF coordinate space
    const pdfWidth = item.width;
    const pdfHeight = item.height || pdfFontSize;

    // Transform PDF matrix coordinates to standard canvas viewport pixels
    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
    const fontHeight = Math.hypot(tx[2], tx[3]);
    const fontWidth = item.width * scale;

    const baselineY = tx[5];
    // Start slightly above cap-height (0.85) and extend 0.30 below baseline to cover descenders & glyph curves
    const boxY = Math.max(0, baselineY - (fontHeight * 0.85));
    const boxHeight = fontHeight * 1.20;
    const boxX = Math.max(0, tx[4] - 2);
    const boxWidth = Math.max(fontWidth + 4, 14);

    rawItems.push({
      str: item.str,
      fontName: item.fontName || 'sans-serif',
      pdfX,
      pdfY,
      pdfWidth,
      pdfHeight,
      pdfFontSize,
      boxX,
      boxY,
      boxWidth,
      boxHeight,
      fontSize: fontHeight,
    });
  }

  // Sort rawItems top-to-bottom (descending Y in PDF), left-to-right (ascending X)
  rawItems.sort((a, b) => {
    if (Math.abs(b.pdfY - a.pdfY) > 2.5) {
      return b.pdfY - a.pdfY; // higher baseline first
    }
    return a.pdfX - b.pdfX; // leftmost first
  });

  // Merge adjacent items on the same baseline (e.g. "47.0" + "LB" + "S" -> "47.0 LBS")
  const mergedItems = [];
  let current = null;

  for (const item of rawItems) {
    if (!current) {
      current = { ...item };
      continue;
    }

    const sameBaseline = Math.abs(current.pdfY - item.pdfY) < 2.0;
    const sameFontSize = Math.abs(current.pdfFontSize - item.pdfFontSize) < 2.5;
    const currentEndPdfX = current.pdfX + current.pdfWidth;
    const gapPdfX = item.pdfX - currentEndPdfX;

    // Adjacent on same line: gap between items is small (e.g. word spacing or kerning)
    const isAdjacent = gapPdfX >= -2 && gapPdfX <= (current.pdfFontSize * 0.75);

    if (sameBaseline && sameFontSize && isAdjacent) {
      const needSpace = gapPdfX > (current.pdfFontSize * 0.18) && !current.str.endsWith(' ') && !item.str.startsWith(' ');
      current.str = current.str + (needSpace ? ' ' : '') + item.str;
      current.pdfWidth = (item.pdfX + item.pdfWidth) - current.pdfX;
      current.boxWidth = (item.boxX + item.boxWidth) - current.boxX;
      current.boxHeight = Math.max(current.boxHeight, item.boxHeight);
      current.boxY = Math.min(current.boxY, item.boxY);
    } else {
      mergedItems.push(current);
      current = { ...item };
    }
  }

  if (current) {
    mergedItems.push(current);
  }

  // Sort lines top-to-bottom, left-to-right for paragraph grouping
  const sortedLines = [...mergedItems].sort((a, b) => {
    if (Math.abs(a.boxY - b.boxY) > 3) {
      return a.boxY - b.boxY;
    }
    return a.boxX - b.boxX;
  });

  // Group vertically stacked lines into cohesive Adobe Acrobat-style paragraph blocks
  const blocks = [];
  for (const line of sortedLines) {
    let matchedBlock = null;

    for (const b of blocks) {
      const lastLine = b.lines[b.lines.length - 1];
      const vertGap = line.boxY - (lastLine.boxY + lastLine.boxHeight);
      const isBelow = vertGap >= -4 && vertGap <= Math.max(lastLine.boxHeight, 14) * 1.5;
      const leftAligned = Math.abs(line.boxX - b.x) < 25 || Math.abs(line.boxX - lastLine.boxX) < 25;
      const xOverlap = line.boxX >= b.x - 15 && line.boxX <= b.maxX + 15;
      const fontSimilar = Math.abs(line.fontSize - lastLine.fontSize) < 5;

      if (isBelow && (leftAligned || xOverlap) && fontSimilar) {
        matchedBlock = b;
        break;
      }
    }

    if (matchedBlock) {
      matchedBlock.lines.push(line);
      matchedBlock.x = Math.min(matchedBlock.x, line.boxX);
      matchedBlock.y = Math.min(matchedBlock.y, line.boxY);
      matchedBlock.maxX = Math.max(matchedBlock.maxX, line.boxX + line.boxWidth);
      matchedBlock.maxY = Math.max(matchedBlock.maxY, line.boxY + line.boxHeight);
      matchedBlock.width = matchedBlock.maxX - matchedBlock.x;
      matchedBlock.height = matchedBlock.maxY - matchedBlock.y;
    } else {
      blocks.push({
        id: `block-${pageNumber}-${blocks.length}`,
        x: line.boxX,
        y: line.boxY,
        maxX: line.boxX + line.boxWidth,
        maxY: line.boxY + line.boxHeight,
        width: line.boxWidth,
        height: line.boxHeight,
        lines: [line],
      });
    }
  }

  const items = mergedItems.map((item, idx) => ({
    id: `text-${pageNumber}-${idx}`,
    text: item.str,
    originalText: item.str,
    x: item.boxX,
    y: item.boxY,
    width: item.boxWidth,
    height: item.boxHeight,
    fontSize: item.fontSize,
    fontFamily: item.fontName,
    pageNumber,
    // Exact native PDF point metrics
    pdfX: item.pdfX,
    pdfY: item.pdfY,
    pdfWidth: item.pdfWidth,
    pdfHeight: item.pdfHeight,
    pdfFontSize: item.pdfFontSize,
  }));

  return {
    items,
    blocks: blocks.map((b) => ({
      id: b.id,
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
    })),
  };
}
