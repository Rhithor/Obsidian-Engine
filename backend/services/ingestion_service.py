"""
Ingestion Service — Document processing and indexing pipeline.

Key design decisions vs the original implementation:
- We extract the FULL document text first, then chunk globally.
  The old code chunked per-page, which made overlap meaningless at
  page boundaries (a sentence cut at the bottom of page 1 was never
  stitched to its continuation on page 2).
- We use RecursiveCharacterTextSplitter which respects paragraph →
  sentence → word boundaries in that priority order, so we never
  split mid-sentence unless absolutely necessary.
- Page numbers are tracked via a character-offset map so we can still
  attach accurate page metadata to every chunk despite global chunking.
"""
import uuid
import fitz  # PyMuPDF
from langchain_text_splitters import RecursiveCharacterTextSplitter
import config


def _build_page_map(doc: fitz.Document) -> dict[int, int]:
    """
    Returns a mapping of {char_offset: page_number} so we can look up
    which page a chunk came from based on its position in the full text.
    """
    page_map: dict[int, int] = {}
    offset = 0
    for page in doc:
        page_map[offset] = page.number
        offset += len(page.get_text())
    return page_map


def _get_page_for_offset(offset: int, page_map: dict[int, int]) -> int:
    """Finds the page number for a given character offset using the page map."""
    last_page = 0
    for char_start, page_num in sorted(page_map.items()):
        if offset >= char_start:
            last_page = page_num
        else:
            break
    return last_page


def process_document(
    file_path: str,
    original_filename: str,
    collection,
) -> int:
    """
    Reads a PDF, chunks it properly, and stores it in the given ChromaDB collection.
    Returns the number of chunks stored.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=config.CHUNK_SIZE,
        chunk_overlap=config.CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", "! ", "? ", " ", ""],
        length_function=len,
    )

    full_text = ""
    page_map: dict[int, int] = {}

    # --- Pass 1: Extract all text and build page offset map ---
    with fitz.open(file_path) as doc:
        offset = 0
        for page in doc:
            page_text = page.get_text()
            page_map[offset] = page.number
            full_text += page_text
            offset += len(page_text)

    if not full_text.strip():
        print(f"[Ingestion] Warning: No extractable text found in '{original_filename}'.")
        return 0

    # --- Pass 2: Split globally (respects sentence/paragraph boundaries) ---
    chunks_with_offsets = splitter.create_documents([full_text])

    text_chunks: list[str] = []
    metadatas: list[dict] = []
    ids: list[str] = []

    running_offset = 0
    for i, doc_chunk in enumerate(chunks_with_offsets):
        chunk_text = doc_chunk.page_content
        # Find the character offset of this chunk in the original text
        chunk_start = full_text.find(chunk_text, running_offset)
        if chunk_start == -1:
            chunk_start = running_offset
        page_num = _get_page_for_offset(chunk_start, page_map)
        running_offset = chunk_start + len(chunk_text)

        text_chunks.append(chunk_text)
        metadatas.append({
            "source": original_filename,
            "page": page_num,
            "chunk_index": i,
        })
        ids.append(uuid.uuid4().hex)

    if text_chunks:
        # ChromaDB handles batching internally for large lists
        collection.add(documents=text_chunks, metadatas=metadatas, ids=ids)
        print(f"[Ingestion] Stored {len(text_chunks)} chunks from '{original_filename}'.")

    return len(text_chunks)
