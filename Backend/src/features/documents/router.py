from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
import os
import base64

from .schemas import (
    OpenPathRequest,
    SaveRequest,
    SaveAsRequest,
    ApplyEditsRequest,
)
from .service import (
    read_pdf_file,
    save_pdf_bytes_to_disk,
    apply_text_edits_with_pymupdf,
)
from src.utils.file_dialog import show_open_dialog, show_save_dialog

router = APIRouter(prefix="/api/documents", tags=["documents"])

@router.post("/open-dialog")
async def open_dialog():
    """Prompt user with native Windows File Explorer to pick a PDF."""
    try:
        chosen_path = show_open_dialog()
        if not chosen_path:
            return JSONResponse(
                status_code=200,
                content={"status": "cancelled", "message": "File selection cancelled by user"}
            )
        
        doc_data = read_pdf_file(chosen_path)
        return {
            "status": "success",
            "message": f"Opened {doc_data['fileName']} successfully",
            "data": doc_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/open-path")
async def open_path(req: OpenPathRequest):
    """Load a PDF directly from a known disk path."""
    try:
        doc_data = read_pdf_file(req.filePath)
        return {
            "status": "success",
            "message": f"Loaded {doc_data['fileName']} from disk",
            "data": doc_data
        }
    except FileNotFoundError as fnf:
        raise HTTPException(status_code=404, detail=str(fnf))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/save")
async def save_document(req: SaveRequest):
    """Overwrite PDF file directly on disk in-place."""
    try:
        result = save_pdf_bytes_to_disk(req.filePath, req.base64Data)
        return {
            "status": "success",
            "message": f"Successfully overwritten {result['fileName']} directly to disk",
            "data": result
        }
    except PermissionError as pe:
        raise HTTPException(status_code=409, detail=str(pe))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/save-as")
async def save_as(req: SaveAsRequest):
    """Prompt native Windows Save As dialog and write bytes to selected file."""
    try:
        chosen_path = show_save_dialog(req.suggestedName)
        if not chosen_path:
            return JSONResponse(
                status_code=200,
                content={"status": "cancelled", "message": "Save As cancelled by user"}
            )
        
        result = save_pdf_bytes_to_disk(chosen_path, req.base64Data)
        return {
            "status": "success",
            "message": f"Successfully saved to {result['fileName']}",
            "data": result
        }
    except PermissionError as pe:
        raise HTTPException(status_code=409, detail=str(pe))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/apply-edits")
async def apply_edits(req: ApplyEditsRequest):
    """
    True PDF Text Stream Redaction & In-Place Replacement via PyMuPDF.
    Scrubs old text characters out of the PDF binary stream and writes clean text.
    """
    try:
        result = apply_text_edits_with_pymupdf(
            file_path=req.filePath,
            base64_data=req.base64Data,
            text_edits=req.textEdits,
            target_path=req.targetPath
        )
        return {
            "status": "success",
            "message": f"Successfully applied {result['editsApplied']} text edits directly to PDF stream",
            "data": result
        }
    except PermissionError as pe:
        raise HTTPException(status_code=409, detail=str(pe))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
