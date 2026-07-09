# Obsidian Engine

**Local-first, privacy-preserving RAG application for private document Q&A.**

Upload PDFs, index them into a per-document ChromaDB vector store, and ask grounded questions from a modern React chat UI — with streaming responses, multi-document management, and automatic PII scrubbing.

---

## What It Does

- **Per-document namespacing** — each uploaded PDF gets its own ChromaDB collection, preventing cross-document context bleed
- **Streaming AI responses** — tokens stream to the UI in real-time via Server-Sent Events
- **Proper chunking** — uses LangChain's `RecursiveCharacterTextSplitter` (paragraph → sentence → word hierarchy) with global document-level splitting
- **PII scrubbing** — Presidio Analyzer + Anonymizer scrubs sensitive text before sending to the LLM
- **Local LLM** — Ollama runs `llama3.2` entirely on-device, no data leaves your machine
- **Document management** — sidebar shows all indexed documents with chunk counts; supports deletion

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4 |
| Backend | FastAPI, LangChain (LCEL), ChromaDB |
| Embeddings | `BAAI/bge-small-en-v1.5` via sentence-transformers |
| LLM runtime | Ollama (`llama3.2`) |
| Privacy | Presidio Analyzer + Anonymizer |
| Deployment | Frontend → Vercel, Backend → Railway |

---

## Project Structure

```
backend/
  main.py                  # FastAPI app with all endpoints
  config.py                # Centralised config (reads from .env)
  requirements.txt         # Pinned dependencies
  Procfile                 # Railway deployment
  railway.toml             # Railway config
  database/
    db.py                  # ChromaDB multi-collection client
  models/
    health.py / query.py / privacy.py / ingest.py
  services/
    ai_service.py          # LangChain LCEL RAG chain + streaming
    ingestion_service.py   # RecursiveCharacterTextSplitter pipeline
    privacy_service.py     # Presidio PII scrubbing

frontend/
  src/
    App.tsx                # Main UI (chat + sidebar + streaming)
    api.ts                 # Centralised API layer (reads VITE_API_URL)
    types.ts               # Shared TypeScript interfaces
    index.css              # Tailwind + custom animations
  vercel.json              # Vercel SPA routing config
```

---

## Prerequisites

- Python 3.12+
- Node.js 20+
- Ollama installed and running: [ollama.ai](https://ollama.ai)

---

## Quick Start (Local)

### 1. Start Ollama

```powershell
ollama serve
ollama pull llama3.2
```

### 2. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m spacy download en_core_web_lg   # Required by Presidio
copy .env.example .env
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### 3. Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Checks backend and Ollama connection |
| `POST` | `/ingest` | Uploads PDF, starts background indexing, returns `collection_id` |
| `GET` | `/collections` | Lists all indexed documents |
| `DELETE` | `/collections/{id}` | Deletes a document and its index |
| `POST` | `/query` | Non-streaming RAG query for a specific collection |
| `POST` | `/query/stream` | SSE streaming RAG query |
| `POST` | `/scrub` | Anonymizes PII in text with Presidio |
| `POST` | `/summary` | Scrubs then summarizes text |

---

## Deployment

### Frontend → Vercel

1. Push the repo to GitHub
2. Import the `frontend/` directory into Vercel
3. Set environment variable: `VITE_API_URL=https://your-backend.railway.app`
4. Deploy

### Backend → Railway

1. Create a new Railway project from the `backend/` directory
2. Set environment variables in Railway dashboard (see `.env.example`)
3. Set `ALLOWED_ORIGINS` to your Vercel frontend URL
4. Railway auto-detects the `Procfile` and deploys

> **Note:** Ollama must also run on Railway or be accessible from the backend. For the deployed version, set `OLLAMA_HOST` to your Ollama server URL.

---

## Environment Variables

See [`backend/.env.example`](backend/.env.example) for all available configuration.

---

## License

MIT
