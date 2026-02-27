import chromadb
from chromadb.utils import embedding_functions
from chromadb.config import Settings

chroma_client = chromadb.PersistentClient(path = "./chroma_data", settings = Settings(anonymized_telemetry = False))
bge_function = embedding_functions.SentenceTransformerEmbeddingFunction("BAAI/bge-small-en-v1.5")
collection = chroma_client.get_or_create_collection(name = "documents", embedding_function = bge_function)

collection.add(
    ids = ["1"],
    documents = ["This is a sample document!"]
)

results = collection.query(
    query_texts = ["This is a sample query"],
    n_results = 1
)

print(results)
