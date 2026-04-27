# Aegis-Verify — Forensic Autopsy Pipeline

Aegis-Verify is an evidence intake and forensic analysis pipeline that uses a grounded LLM (Vertex AI Gemini) and an adaptive sieve architecture to produce an enterprise-grade PDF "Forensic Autopsy" report.

This README is interactive and focused on getting you running locally, explaining the architecture, and showing common workflows (upload → analyze → download PDF).

**Quick Links**
- Backend: `/backend` — FastAPI + LangGraph orchestration
- Frontend: `/frontend` — Next.js (App Router) UI with PDF download via `@react-pdf/renderer`
- Docs/Snapshots: `logs.md`, `current_code.md`, `context.md` (these files are ignored by git)

---

## Quick Start (Local Development)

Prerequisites

- Python 3.11+ (virtualenv recommended)
- Node.js 18+ / npm 9+
- Google Cloud credentials configured for Vertex AI and Firestore

Backend (API)

1. Create and activate a virtual environment:

```bash
python -m venv .venv
source .venv/bin/activate
```

2. Install Python dependencies:

```bash
pip install -r backend/requirements.txt
```

3. Set required environment variables (example):

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
export GCP_PROJECT_ID="your-gcp-project-id"
# optional / recommended
export FIRESTORE_EMULATOR_HOST="localhost:8080"
```

4. Run the API server (development):

```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Frontend (Next.js)

1. Install dependencies and start dev server:

```bash
cd frontend
npm install
npm run dev
```

2. Open the app in your browser: `http://localhost:3000`

---

## API: Evidence Upload & Autopsy

Endpoint (example)

- `POST /api/v1/scan` — multipart form with `file` and `user_prompt`

Curl example:

```bash
curl -X POST "http://localhost:8000/api/v1/scan" \
  -F "file=@/path/to/evidence.jpg" \
  -F "user_prompt=Please analyze for red flags and missing metadata"
```

Successful response (JSON) contains the LangGraph `AutopsyState` findings and flow state. Important fields used by the frontend:

```json
{
  "findings": {
    "critical_red_flags": ["..."],
    "missing_metadata": ["..."],
    "contextual_verdict": "..."
  },
  "autopsy_report_ready": true,
  "active_sieves": [ /* dynamic sieve definitions */ ]
}
```

The frontend expects these fields to populate the PDF report. No mock data is used — the pipeline calls Vertex AI and Firestore.

---

## Generating the Forensic PDF (UI)

1. Use the Next.js UI to upload evidence and trigger the scan.
2. When analysis completes, click the **Download Forensic Autopsy** button to generate the PDF via `@react-pdf/renderer`.

The UI uses `PDFDownloadLink` which shows a loading state while the PDF is prepared.

---

## Architecture Summary

- Adaptive Sieve Architecture: dynamic `sieves` are forged or reused (via Firestore vector memory) per evidence and prompt.
- `VertexLLMService`: grounded Gemini model (gemini-1.5-pro) with Google Search retrieval to provide legally-relevant context.
- LangGraph orchestrates the AutopsyState state machine and routes work between memory lookup, sieve forging, and executor nodes.
- Frontend renders the `Forensic Autopsy` using `@react-pdf/renderer` with a strict contract (`critical_red_flags`, `missing_metadata`, `contextual_verdict`).

---

## Environment & Secrets

Minimum environment variables used by the backend (example names):

- `GOOGLE_APPLICATION_CREDENTIALS` — path to GCP service account JSON
- `GCP_PROJECT_ID` — GCP project used for Vertex & Firestore
- `FIRESTORE_EMULATOR_HOST` — optional for local Firestore emulation

Keep these secrets out of source control (they're loaded from the environment by the backend config).

---

## Developer Tips & Troubleshooting

- If Vertex calls fail, confirm `GOOGLE_APPLICATION_CREDENTIALS` and `GCP_PROJECT_ID` are set and the service account has Vertex AI + Firestore permissions.
- If Firestore cache lookups misbehave, try running with the emulator or inspect stored vectors in your Firestore console.
- Use `uvicorn --reload` for live backend reload while developing.

Regenerating the project snapshot (advanced): `scripts/generate_snapshot.sh` (if present) or run a manual `find`/`wc -l` to inspect files.

---

## Contributing

1. Fork the repo, create a feature branch, and open a PR.
2. Keep changes focused and include tests where applicable.

Suggested workflow:

```bash
git checkout -b feat/your-change
# implement
git add .
git commit -m "feat: description"
git push origin feat/your-change
# open PR
```

---

## License

This project currently has no license file. Add a `LICENSE` at the repo root if you plan to publish.

---

If you want, I can also:

- add badges, CI workflow examples, and a `make` or `justfile` to simplify the commands above
- create a minimal `README` section in `frontend/README.md` with developer run scripts
- open a draft PR with these changes

Tell me which optional items you'd like next.

---

## Problem Statement — The Visibility Gap & Alert Fatigue

The proliferation of Generative AI has eroded digital trust. Enterprises, media organizations, and legal institutions face an unprecedented volume of sophisticated digital manipulation (deepfakes, forged contracts, synthetic media). Current detection approaches suffer from three fatal flaws:

- **Probabilistic "Black Boxes":** Generic likelihood scores without explainable proof are inadequate for legal or high-stakes audit contexts.
- **Alert Fatigue:** Uncontextualized anomaly flags overwhelm security teams, increasing the chance true threats are ignored.
- **Static Rigidity:** Rule-based detectors lack domain awareness and cannot dynamically adapt to novel document types or domains.

There is a critical visibility gap: organizations need a deterministic, context-aware, and explainable system that can authenticate digital assets and provide provable evidence of unauthorized manipulation in near real-time.

## Our Solution — Aegis-Verify

Aegis-Verify is a Domain-Aware, Autonomous Digital Asset Forensics Engine. Instead of a single "trust score" we produce a Cryptographic Forensic Autopsy Report: a human- and legally-readable artifact that records the tests performed, the deterministic proofs (e.g., hashes, metadata), and the LLM-guided findings.

Key attributes:

- **Context-Driven:** User supplies a contextual prompt (e.g., "Audit this insurance car damage claim") which guides the investigation.
- **Ephemeral Sieve Forge:** The system dynamically invents and deploys custom forensic tests (Sieves) tailored to the specific asset and prompt.
- **Neuro-Symbolic Verification:** Combines probabilistic LLM analysis (Gemini 1.5 Pro) with deterministic math (EXIF, cryptographic hashing, metadata extraction) for both semantic insight and absolute proof.
- **Grounded OSINT:** Uses Vertex AI Grounding (Google Search) to cross-check claims against live web evidence.

## Opportunities & Unique Selling Proposition (USP)

How we differ from existing approaches:

- **Dynamic vs. Static:** A cognitive router that forges only the sieves needed per asset, reducing compute and increasing relevance.
- **Explainability over Scores:** Instead of opaque percentages, we provide autopsy-style findings that explain *why* something is suspicious and how that conclusion was reached.
- **Recursive Sieve Vault:** When a novel sieve is created and validated, the logic is vectorized and cached in Firestore. Future similar cases retrieve the verified sieve from memory (sub-second), bypassing the LLM and reducing cost while improving accuracy.

This design turns the system into an autonomous, self-evolving immune system for enterprise digital trust.

## Features

- Context-Aware Ingestion (multi-modal: images, PDFs, associated natural-language directives)
- Zero-Shot Ephemeral Sieve Forge (real-time, bespoke forensic logic)
- Recursive Sieve Vault (Firestore Native Vector Search cache for verified sieves)
- Vertex AI Grounding (live OSINT checks via Google Search retrieval)
- Cryptographic Chain of Custody (SHA-256 hashes for immutability)
- Downloadable Forensic Autopsy PDF (Red Flags, Missing Metadata, Sieve Breakdown, Contextual Verdict)

## Process Flow (System Architecture)

High-level steps:

1. Ingest: User uploads asset and provides a context string.
2. Immutable Base: System computes SHA-256 hash and extracts metadata (EXIF/PDF fields).
3. Vector Lookup: Embed the context via Vertex AI embeddings and query Firestore Vector DB.
4. Decision Branch:
  - Cache Hit (similarity above 85%): retrieve pre-existing sieves from Firestore.
  - Cache Miss (similarity at or below 85%): trigger Gemini 1.5 Pro to forge new Ephemeral Sieves and persist them to Firestore.
5. Parallel Execution: LangGraph routes the asset through active sieves concurrently (Visual, Semantic, OSINT grounding sieves).
6. Governor: LangGraph compiles sieve results into a unified JSON findings structure.
7. Export: Frontend renders dashboard and generates the downloadable Forensic Autopsy PDF.

Mermaid diagram (process flow):

```mermaid
flowchart TD
  A[Ingest Asset + Context] --> B[Compute SHA-256 & Extract Metadata]
  B --> C[Embed Context & Query Firestore]
  C -->|Similarity above 0.85| D[Cache Hit: Retrieve Sieves]
  C -->|Similarity at or below 0.85| E[Cache Miss: Forge Sieves (Gemini)]
  D --> F[LangGraph: Execute Sieves in Parallel]
  E --> F
  F --> G[Compile Findings (Governor)]
  G --> H[Dashboard + PDF Forensic Autopsy]
```

### System Architecture (Component Diagram)

This diagram shows the main runtime components and their interactions during a scan request.

```mermaid
flowchart LR
  subgraph Browser
    UIC[Next.js CISO Cockpit]
  end

  subgraph Frontend
    UIC -->|POST /api/v1/scan| API[FastAPI (Cloud Run / Local)]
  end

  subgraph Backend
    API -->|enqueue/ainvoke| SG[LangGraph StateGraph]
    SG -->|calls| FS[Firestore (Recursive Sieve Vault)]
    SG -->|forge| VTX[Vertex AI Gemini 1.5 Pro]
    SG -->|grounding| VG[Vertex Grounding (Google Search)]
    SG -->|visual| VISION[Cloud Vision API]
    SG -->|persist| FS
    API -->|serve| UIResult[Scan Results / Findings JSON]
  end

  subgraph AI_Stack
    VTX[Vertex AI Gemini 1.5 Pro]
    VG[Vertex Grounding (Google Search)]
    VISION[Cloud Vision API]
  end

  FS -.->|vector retrieval| SG
  VTX -->|sieve logic| SG
  VG -->|search evidence| SG
  VISION -->|ocr/bbox| SG

  UIResult -->|render| UIC
```

The diagram illustrates the request path from the browser, through the API, into the LangGraph orchestrator which interacts with Vertex AI, Vertex Grounding, Cloud Vision, and Firestore. Results are compiled and returned to the frontend for rendering and PDF export.

## Use Cases

- **Insurance Fraud:** Upload a crash photo with "Verify claim". System generates Geolocation and Camera Metadata sieves, extracts hidden EXIF GPS, and proves the photo location is inconsistent with the claimed accident site.
- **Corporate Fraud / Espionage:** Upload a vendor invoice and prompt "Verify vendor legitimacy". System constructs OSINT sieves, uses Vertex Grounding to check domain registration and corporate records, and flags shell companies or recently-registered domains.

## Technology Stack — Google-Native

Frontend (CISO Cockpit)

- Next.js (App Router) + React 18
- Tailwind CSS, shadcn/ui, Framer Motion for Sieve pulse animations
- `@react-pdf/renderer` for on-demand Forensic Autopsy PDF generation

Backend (Intelligence Engine)

- Python 3.11+, FastAPI, Pydantic
- LangGraph for orchestrating the state machine and parallel sieve execution
- Deploy on Google Cloud Run (scales 0→N)

AI & Memory

- Vertex AI Gemini 1.5 Pro (multimodal model) for forging sieves and semantic/visual analysis
- Vertex AI Grounding (Google Search retrieval) for live OSINT
- Vertex AI Embeddings (`textembedding-gecko`) for vectorizing prompts
- Google Cloud Firestore with Native Vector Search as the Recursive Sieve Vault
- Google Cloud Vision API for bounding box OCR/visual forensics

---

If you'd like, I can now:

- generate SVG/PNG diagrams from the mermaid flow and add them to `/docs`;
- add an architecture image layout to `architecture.md` and link it here;
- create `frontend/README.md` with quick dev scripts and `backend/requirements.txt` if missing.

Tell me which of these you'd like next.
