from pydantic import BaseModel, Field
from typing import List, Optional

class OpenPathRequest(BaseModel):
    filePath: str

class SaveRequest(BaseModel):
    filePath: str
    base64Data: str

class SaveAsRequest(BaseModel):
    suggestedName: str = "document.pdf"
    base64Data: str

class TextEditItem(BaseModel):
    pageNumber: int = Field(default=1, description="1-indexed page number")
    originalText: Optional[str] = None
    text: str = Field(description="The new replacement text")
    pdfX: Optional[float] = None
    pdfY: Optional[float] = None  # In PDF bottom-left coordinates, or top-left
    pdfWidth: Optional[float] = None
    pdfHeight: Optional[float] = None
    pdfFontSize: Optional[float] = 12.0
    fontFamily: Optional[str] = "Helvetica"
    isBold: Optional[bool] = False
    textColor: Optional[str] = "#000000"
    backgroundColor: Optional[str] = "#ffffff"
    # Optional raw rect [x0, y0, x1, y1] if provided directly
    rect: Optional[List[float]] = None

class ApplyEditsRequest(BaseModel):
    filePath: Optional[str] = None
    base64Data: Optional[str] = None
    textEdits: List[TextEditItem] = []
    targetPath: Optional[str] = None
