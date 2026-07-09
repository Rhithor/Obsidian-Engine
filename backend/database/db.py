"""
Database module — ChromaDB client with multi-collection (namespace) support.

Each uploaded document gets its own named collection identified by a
collection_id (UUID hex). This prevents cross-document context bleed
where a query about document A accidentally pulls chunks from document B.

The original implementation used a single hardcoded "documents" collection
for everything — this module replaces that with proper namespacing.
"""
import chromadb
from chromadb.utils.embedding_functions import DefaultEmbeddingFunction
from chromadb.config import Settings
import config

# --- Shared client ---
# DefaultEmbeddingFunction uses all-MiniLM-L6-v2 via ONNX Runtime.
# This uses ~25MB RAM vs ~300MB for the PyTorch sentence-transformers version
# — critical for fitting within Render's 512MB free tier.
_chroma_client = chromadb.PersistentClient(
    path=config.CHROMA_PATH,
    settings=Settings(anonymized_telemetry=False),
)
_embedding_fn = DefaultEmbeddingFunction()


def get_or_create_collection(collection_id: str):
    """Gets or creates a ChromaDB collection for a given collection_id."""
    return _chroma_client.get_or_create_collection(
        name=collection_id,
        embedding_function=_embedding_fn,
    )


def list_collections() -> list[dict]:
    """
    Returns a list of all collections with their name and document count.
    Used by the frontend document management sidebar.
    """
    collections = _chroma_client.list_collections()
    result = []
    for col in collections:
        try:
            # Fetch the collection with embedding function to get count
            full_col = _chroma_client.get_collection(
                name=col.name,
                embedding_function=_embedding_fn,
            )
            # The collection metadata stores the display name (original filename)
            meta = full_col.metadata or {}
            result.append({
                "collection_id": col.name,
                "filename": meta.get("filename", col.name),
                "chunk_count": full_col.count(),
            })
        except Exception as e:
            print(f"[DB] Could not load collection '{col.name}': {e}")
    return result


def delete_collection(collection_id: str) -> bool:
    """Deletes a collection by its ID. Returns True on success."""
    try:
        _chroma_client.delete_collection(name=collection_id)
        return True
    except Exception as e:
        print(f"[DB] Failed to delete collection '{collection_id}': {e}")
        return False


def retrieve_context(question: str, collection_id: str) -> dict:
    """
    Queries a specific collection for relevant chunks.
    Returns a dict with 'context' (joined text) and 'sources' (metadata list).
    """
    try:
        collection = _chroma_client.get_collection(
            name=collection_id,
            embedding_function=_embedding_fn,
        )
    except Exception:
        return {"context": "No documents found for this collection.", "sources": []}

    total_docs = collection.count()
    if total_docs == 0:
        return {"context": "The document has not been indexed yet.", "sources": []}

    n_results = min(config.N_RESULTS, total_docs)
    results = collection.query(query_texts=[question], n_results=n_results)

    if not results["documents"] or not results["documents"][0]:
        return {"context": "No relevant context found.", "sources": []}

    matching_chunks = "\n\n---\n\n".join(results["documents"][0])
    metadata = results["metadatas"][0]

    return {
        "context": matching_chunks,
        "sources": metadata,
    }
