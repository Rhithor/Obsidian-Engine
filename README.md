# Obsidian Engine

Obsidian Engine is a local-first RAG app for private document Q and A.
You can upload a PDF, index it into ChromaDB, and ask grounded questions from a React UI.

## What It Does

- Uploads PDF files to the backend
- Chunks and embeds document text into a local ChromaDB store
- Answers questions using retrieved context only
- Scrubs sensitive text with Presidio
- Uses Ollama locally for generation

## Tech Stack

- Frontend: React, TypeScript, Vite
- Backend: FastAPI, LangChain, ChromaDB, PyMuPDF
- AI runtime: Ollama (`llama3.2`)
- Privacy: Presidio Analyzer and Anonymizer

## Project Structure

```text
backend/
	main.py
	requirements.txt
	database/
	models/
	services/
	temp_uploads/
	chroma_data/

frontend/
	src/
	package.json
```

## Prerequisites

- Python 3.12+
- Node.js 20+
- Ollama installed and running
- Ollama model pulled: `llama3.2`

## Quick Start

### 1) Start Ollama

```powershell
ollama serve
ollama pull llama3.2
```

### 2) Run Backend

From `backend/`:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### 3) Run Frontend

From `frontend/`:

```powershell
npm install
npm run dev
```

Open the app URL shown by Vite, usually `http://localhost:5173`.

## API Endpoints

- `GET /health`: checks backend and Ollama connection
- `POST /ingest`: uploads PDF and starts background indexing
- `POST /query`: asks a question using indexed document context
- `POST /scrub`: anonymizes user text with Presidio
- `POST /summary`: scrubs text and requests a summary from Ollama

## Example Request

`POST /query`

```json
{
	"QueryRequest": "What are the key findings in this document?"
}
```

## Notes

- Data is stored locally in `backend/chroma_data/`
- Temporary uploads are written to `backend/temp_uploads/`
- Current frontend calls backend at `http://127.0.0.1:8000`

## Troubleshooting

- If `/health` is inactive, confirm `ollama serve` is running on port `11434`
- If uploads fail, check backend logs and confirm the file is a PDF
- If query results are weak, ingest more relevant documents first

## License

Add your preferred license here.
