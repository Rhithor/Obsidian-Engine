import chromadb
from chromadb.utils import embedding_functions
from chromadb.config import Settings

chroma_client = chromadb.PersistentClient(path = "./chroma_data", settings = Settings(anonymized_telemetry = False))
bge_function = embedding_functions.SentenceTransformerEmbeddingFunction("BAAI/bge-small-en-v1.5")
collection = chroma_client.get_or_create_collection(name = "documents", embedding_function = bge_function)

def retrieve_context(question: str):
    results = collection.query(query_texts = [question], n_results = 3)
    if len(results["documents"]) > 0:
        matching_text_chunks = "\n\n".join(results["documents"][0])
    else:
        return {"context": "No documents found.", "sources": []}
    metadata = results["metadatas"][0]
    return_dict = {
        'context': matching_text_chunks,
        'sources': metadata
    }
    return return_dict
