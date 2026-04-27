from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from core.graph import AutopsyState, compiled_autopsy_graph

app = FastAPI(title="Aegis-Verify API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/v1/scan")
async def scan_asset(file: UploadFile = File(...), user_prompt: str = Form(...)) -> dict[str, object]:
    file_bytes = await file.read()
    initial_state: AutopsyState = {
        "file_bytes": file_bytes,
        "mime_type": file.content_type or "application/octet-stream",
        "user_prompt": user_prompt,
        "prompt_embedding": [],
        "active_sieves": [],
        "findings": {},
        "autopsy_report_ready": False,
    }

    result = await compiled_autopsy_graph.ainvoke(initial_state)

    return {
        "status": "success",
        "message": "Scan request completed",
        "filename": file.filename or "unknown",
        "autopsy_report_ready": result.get("autopsy_report_ready", False),
        "active_sieves": result.get("active_sieves", []),
        "findings": result.get("findings", {}),
    }
