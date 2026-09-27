import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn

from src.features.documents.router import router as documents_router

app = FastAPI(
    title="PDF Editor Python Backend",
    description="High-performance PyMuPDF-powered local backend for true PDF stream text editing and direct disk file operations",
    version="2.0.0"
)

# Enable CORS for Vite frontend (http://localhost:5173) and any local origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Feature Routers
app.include_router(documents_router)

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "pdf-editor-backend-python",
        "engine": "PyMuPDF (fitz)",
        "message": "FastAPI + PyMuPDF engine ready for true direct PDF stream editing"
    }

# -------------------------------------------------------------
# Serve Pre-Built Frontend (Zero Node.js required on client PC)
# -------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

if os.path.isdir(STATIC_DIR):
    assets_dir = os.path.join(STATIC_DIR, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        target_file = os.path.join(STATIC_DIR, full_path)
        if full_path and os.path.isfile(target_file):
            return FileResponse(target_file)
        index_file = os.path.join(STATIC_DIR, "index.html")
        if os.path.isfile(index_file):
            return FileResponse(index_file)
        return {"error": "Frontend static files not found."}

if __name__ == "__main__":
    print("=" * 60)
    print("🚀 PDF Editor Python Backend (FastAPI + PyMuPDF)")
    print("📡 URL: http://localhost:5000")
    print("📖 Docs: http://localhost:5000/docs")
    print("🎯 Engine: PyMuPDF (True Vector Stream Redaction & Editing)")
    print("=" * 60)
    uvicorn.run("main:app", host="127.0.0.1", port=5000, reload=True)
