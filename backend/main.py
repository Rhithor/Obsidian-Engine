"""
Obsidian Engine — FastAPI Backend
"""
import os
import uuid
import shutil
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, UploadFile, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

import config
from models import health, privacy, query, ingest
from services import ai_service, privacy_service, ingestion_service
from database import db


# ---------------------------------------------------------------------------
# Lifespan: ensure required directories exist on startup
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs("./temp_uploads", exist_ok=True)
    os.makedirs(config.CHROMA_PATH, exist_ok=True)
    yield


# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Obsidian Engine",
    description="Local-first, privacy-preserving RAG API",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/")
async def root():
    return {"message": "Obsidian Engine is running. Visit /docs for the API."}


@app.get("/health", response_model=health.HealthResponse)
async def check_health():
    ollama_up = await ai_service.is_ollama()
    return health.HealthResponse(
        status="active" if ollama_up else "inactive",
        ollama_connection="connected" if ollama_up else "disconnected",
    )


# ---------------------------------------------------------------------------
# Privacy / Scrubbing
# ---------------------------------------------------------------------------
@app.post("/scrub", response_model=privacy.ScrubbedResponse)
async def scrub_data(payload: privacy.RequestUserInfo):
    result = await privacy_service.scrub_text(text=payload.user_info)
    return privacy.ScrubbedResponse(
        response=result["response"],
        is_scrubbed=result["is_scrubbed"],
    )


@app.post("/summary", response_model=privacy.SummaryResponse)
async def summarize(payload: privacy.RequestUserInfo):
    scrubbed = await privacy_service.scrub_text(text=payload.user_info)
    summary = await ai_service.generate_summary(scrubbed["response"])
    if summary is None:
        raise HTTPException(
            status_code=503,
            detail="AI model is unavailable. Is Ollama running?",
        )
    return privacy.SummaryResponse(
        scrubbed_text=scrubbed["response"],
        is_scrubbed=scrubbed["is_scrubbed"],
        summary=summary,
    )


# ---------------------------------------------------------------------------
# Document Management
# ---------------------------------------------------------------------------
def _run_ingestion(file_path: str, original_filename: str, collection_id: str):
    """Background task: ingest document into its own ChromaDB collection."""
    try:
        collection = db.get_or_create_collection(collection_id)
        # Store filename in collection metadata for display
        collection.modify(metadata={"filename": original_filename})
        count = ingestion_service.process_document(file_path, original_filename, collection)
        print(f"[Ingest] Done. {count} chunks stored for '{original_filename}'.")
    except Exception as e:
        print(f"[Ingest] Background error: {e}")
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)


@app.post("/ingest", response_model=ingest.IngestResponse)
async def ingest_document(
    file: UploadFile,
    dispatcher: BackgroundTasks,
):
    # --- Validation ---
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    # Read the file bytes to check size
    file_bytes = await file.read()
    if len(file_bytes) > config.MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the {config.MAX_FILE_SIZE_MB}MB limit.",
        )

    # Basic PDF magic bytes check (PDF files start with %PDF)
    if not file_bytes.startswith(b"%PDF"):
        raise HTTPException(
            status_code=400,
            detail="File does not appear to be a valid PDF.",
        )

    # --- Save to temp and dispatch ---
    collection_id = uuid.uuid4().hex
    unique_name = f"{collection_id}.pdf"
    file_path = os.path.join("./temp_uploads", unique_name)

    with open(file_path, "wb") as buffer:
        buffer.write(file_bytes)

    dispatcher.add_task(_run_ingestion, file_path, file.filename, collection_id)

    return ingest.IngestResponse(
        message="File accepted. Processing in background.",
        collection_id=collection_id,
        filename=file.filename,
    )


@app.get("/collections", response_model=list[ingest.CollectionInfo])
async def list_collections():
    """Returns all indexed document collections with their metadata."""
    return db.list_collections()


@app.delete("/collections/{collection_id}")
async def delete_collection(collection_id: str):
    """Deletes a document collection and all its indexed chunks."""
    success = db.delete_collection(collection_id)
    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"Collection '{collection_id}' not found.",
        )
    return {"message": f"Collection '{collection_id}' deleted successfully."}


# ---------------------------------------------------------------------------
# Query (non-streaming + streaming)
# ---------------------------------------------------------------------------
@app.post("/query")
async def query_document(request: query.Query):
    """Non-streaming RAG query against a specific document collection."""
    db_result = db.retrieve_context(request.query, request.collection_id)
    context = db_result["context"]

    answer = await ai_service.generate_rag_response(
        question=request.query,
        context=context,
    )
    if answer is None:
        raise HTTPException(
            status_code=503,
            detail="AI model is unavailable. Is Ollama running?",
        )

    return {
        "answer": answer,
        "sources": db_result["sources"],
    }


@app.post("/query/stream")
async def query_document_stream(request: query.Query):
    """
    Streaming RAG query. Returns an SSE stream of text tokens.
    The frontend consumes this with EventSource or fetch + ReadableStream.
    Sources are sent as the final SSE event with type 'sources'.
    """
    db_result = db.retrieve_context(request.query, request.collection_id)
    context = db_result["context"]
    sources = db_result["sources"]

    async def event_generator():
        # Stream tokens
        async for token in ai_service.generate_rag_response_stream(
            question=request.query,
            context=context,
        ):
            # SSE format: "data: <content>\n\n"
            yield f"data: {token}\n\n"

        # Send sources as a final event
        import json
        yield f"event: sources\ndata: {json.dumps(sources)}\n\n"
        yield "event: done\ndata: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
