***

### 📄 3. Replace the contents of `project_structure.md` with this:

```markdown
# MONOREPO FOLDER STRUCTURE

```text
aegis-verify/
│
├── frontend/                  # Next.js App
│   ├── app/
│   │   ├── layout.tsx
│   │   └── page.tsx           # Main CISO Dashboard (Drag & Drop, Sieve Pulse)
│   ├── components/
│   │   ├── ui/                # shadcn/ui components
│   │   └── AutopsyReport.tsx  # PDF Generation Component
│   ├── lib/
│   │   └── api.ts             # Axios calls to FastAPI
│   └── package.json
│
├── backend/                   # FastAPI App
│   ├── core/
│   │   ├── config.py          # Pydantic Settings (Fail-Fast)
│   │   └── graph.py           # LangGraph Orchestration Nodes & Routing
│   ├── services/
│   │   ├── vertex_llm.py      # Vertex AI (Gemini 1.5 Pro + Grounding) logic
│   │   ├── firestore_db.py    # Firestore Native Vector Search & Cache logic
│   │   └── tools.py           # Python hashlib, EXIF extractors
│   ├── main.py                # FastAPI endpoints
│   └── requirements.txt
│
├── context.md                 # System Prompt constraints
├── architecture.md            # Data Flow and State definitions
├── project_structure.md       # Folder Tree
└── logs.md                    # Developer Work Log