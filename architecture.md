# SYSTEM ARCHITECTURE & DATA FLOW

## 1. Tech Stack
- **Frontend:** Next.js (React 18), Firebase Hosting, `@react-pdf/renderer` (for Autopsy PDF generation).
- **Backend:** FastAPI, deployed on Google Cloud Run.
- **Orchestration:** LangGraph (Python).
- **AI/ML:** Google Cloud Vertex AI (Gemini 1.5 Pro with Google Search Grounding, Text Embeddings).
- **Database:** Google Cloud Firestore (using Native Vector Search Extension).

## 2. The LangGraph State Machine (`AutopsyState`)
The backend relies on a cyclic graph passing this exact TypedDict state:
```python
class DynamicSieve(TypedDict):
    sieve_name: str
    objective: str
    required_tool: str # 'vision', 'osint_grounding', 'metadata'

class AutopsyState(TypedDict):
    file_bytes: bytes
    mime_type: str
    user_prompt: str
    prompt_embedding: list[float]
    active_sieves: list[DynamicSieve]
    findings: dict[str, Any]
    autopsy_report_ready: bool