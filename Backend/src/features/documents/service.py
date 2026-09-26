import os
import base64
import pymupdf
from typing import List, Dict, Any, Optional
from .schemas import TextEditItem

def hex_to_rgb_tuple(hex_str: str) -> tuple:
    """Convert hex string (e.g. '#000000') to RGB float tuple (0.0 to 1.0)."""
    if not hex_str:
        return (0.0, 0.0, 0.0)
    hex_clean = hex_str.lstrip('#')
    if len(hex_clean) == 3:
        hex_clean = ''.join(c * 2 for c in hex_clean)
    if len(hex_clean) != 6:
        return (0.0, 0.0, 0.0)
    try:
        r = int(hex_clean[0:2], 16) / 255.0
        g = int(hex_clean[2:4], 16) / 255.0
        b = int(hex_clean[4:6], 16) / 255.0
        return (r, g, b)
    except Exception:
        return (0.0, 0.0, 0.0)

def read_pdf_file(file_path: str) -> Dict[str, Any]:
    """Read a local PDF file and return metadata + base64 data."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
    
    file_size = os.path.getsize(file_path)
    file_name = os.path.basename(file_path)
    
    with open(file_path, "rb") as f:
        file_bytes = f.read()
    
    base64_data = base64.b64encode(file_bytes).decode('utf-8')
    
    return {
        "filePath": file_path,
        "fileName": file_name,
        "fileSize": file_size,
        "base64Data": base64_data
    }

def save_pdf_bytes_to_disk(file_path: str, base64_data: str) -> Dict[str, Any]:
    """Overwrite or write PDF bytes directly to disk."""
    file_bytes = base64.b64decode(base64_data)
    
    # Ensure directory exists
    dir_name = os.path.dirname(file_path)
    if dir_name and not os.path.exists(dir_name):
        os.makedirs(dir_name, exist_ok=True)
    
    try:
        with open(file_path, "wb") as f:
            f.write(file_bytes)
    except PermissionError:
        raise PermissionError(
            f"Cannot overwrite '{os.path.basename(file_path)}' because it is open in Adobe Acrobat. Please close Adobe Acrobat and click Save again."
        )
        
    return {
        "success": True,
        "filePath": file_path,
        "fileName": os.path.basename(file_path),
        "fileSize": len(file_bytes)
    }

def apply_text_edits_with_pymupdf(
    file_path: Optional[str] = None,
    base64_data: Optional[str] = None,
    text_edits: List[TextEditItem] = [],
    target_path: Optional[str] = None
) -> Dict[str, Any]:
    """
    Perform TRUE stream redaction and direct text replacement using PyMuPDF.
    1. Permanently erases old text characters/vector glyphs from the PDF binary stream.
    2. Inserts replacement text cleanly at the exact coordinates on that specific page.
    3. Saves directly in-place or returns sanitized stream.
    """
    if base64_data:
        file_bytes = base64.b64decode(base64_data)
        doc = pymupdf.open(stream=file_bytes, filetype="pdf")
        save_target = target_path or file_path
    elif file_path and os.path.exists(file_path):
        doc = pymupdf.open(file_path)
        save_target = target_path or file_path
    else:
        raise ValueError("Either valid file_path or base64_data must be provided")
    
    num_pages = len(doc)
    edits_applied = 0
    
    for edit in text_edits:
        page_idx = edit.pageNumber - 1
        if page_idx < 0 or page_idx >= num_pages:
            continue
            
        page = doc[page_idx]
        page_height = page.rect.height
        page_width = page.rect.width
        
        font_size = edit.pdfFontSize or 12.0
        font_name = "hebo" if edit.isBold else "helv"
        if edit.fontFamily:
            fam = edit.fontFamily.lower()
            if "times" in fam:
                font_name = "tibo" if edit.isBold else "tiro"
            elif "courier" in fam:
                font_name = "cobo" if edit.isBold else "cour"
            else:
                font_name = "hebo" if edit.isBold else "helv"
        
        text_color = hex_to_rgb_tuple(edit.textColor or "#000000")
        
        target_rect = None
        
        # Strategy A: If originalText is provided, search page for exact occurrences
        if edit.originalText and edit.originalText.strip():
            matches = page.search_for(edit.originalText.strip())
            if matches:
                # If multiple matches, find the closest one to (pdfX, y_top) if available
                if edit.pdfX is not None and edit.pdfY is not None:
                    y_top_expected = page_height - (edit.pdfY + font_size * 0.95)
                    closest_rect = min(
                        matches,
                        key=lambda r: (r.x0 - edit.pdfX)**2 + (r.y0 - y_top_expected)**2
                    )
                    target_rect = closest_rect
                else:
                    target_rect = matches[0]
        
        # Strategy B: If no match found by string, compute rect from coordinates
        if target_rect is None and edit.pdfX is not None and edit.pdfY is not None:
            # Baseline y in PDF coordinates -> PyMuPDF y coordinates
            # Descender is ~28% of font_size, ascender is ~95%
            y_top = page_height - (edit.pdfY + font_size * 0.95)
            y_bottom = page_height - (edit.pdfY - font_size * 0.28)
            width = edit.pdfWidth or (font_size * len(edit.text) * 0.6)
            
            target_rect = pymupdf.Rect(
                max(0.0, edit.pdfX - 1.0),
                max(0.0, y_top - 1.0),
                min(page_width, edit.pdfX + width + 2.0),
                min(page_height, y_bottom + 1.0)
            )
            
        # Strategy C: Raw rect provided
        if target_rect is None and edit.rect and len(edit.rect) == 4:
            target_rect = pymupdf.Rect(edit.rect[0], edit.rect[1], edit.rect[2], edit.rect[3])
            
        if target_rect is not None:
            # Step 1: True Stream Redaction
            # This completely scrubs and removes the vector glyphs/characters from the PDF stream
            page.add_redact_annot(target_rect, fill=(1, 1, 1))
            page.apply_redactions()
            
            # Step 2: Clean insertion of new replacement text
            # In PyMuPDF, insert_text uses point at baseline:
            # baseline y is approx y1 - (font_size * 0.22)
            if edit.pdfX is not None and edit.pdfY is not None:
                insert_pt = pymupdf.Point(edit.pdfX, page_height - edit.pdfY)
            else:
                insert_pt = pymupdf.Point(target_rect.x0, target_rect.y1 - (font_size * 0.22))
                
            page.insert_text(
                insert_pt,
                edit.text,
                fontsize=font_size,
                fontname=font_name,
                color=text_color
            )
            edits_applied += 1

    if save_target:
        temp_target = save_target + ".tmp.pdf"
        doc.save(temp_target, incremental=False, deflate=True, garbage=4)
        doc.close()
        
        try:
            if os.path.exists(save_target):
                os.remove(save_target)
            os.rename(temp_target, save_target)
        except PermissionError:
            if os.path.exists(temp_target):
                try:
                    os.remove(temp_target)
                except Exception:
                    pass
            raise PermissionError(
                f"Cannot overwrite '{os.path.basename(save_target)}' because it is open in Adobe Acrobat or another program. Please close Adobe Acrobat and click Save again."
            )
        
        with open(save_target, "rb") as f:
            saved_bytes = f.read()
        file_name = os.path.basename(save_target)
    else:
        saved_bytes = doc.tobytes(deflate=True, garbage=4)
        doc.close()
        file_name = "merged-document.pdf"
        
    saved_base64 = base64.b64encode(saved_bytes).decode('utf-8')
    
    return {
        "success": True,
        "filePath": save_target,
        "fileName": file_name,
        "fileSize": len(saved_bytes),
        "editsApplied": edits_applied,
        "base64Data": saved_base64
    }
