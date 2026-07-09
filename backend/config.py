"""
Centralised configuration for Obsidian Engine backend.
All values are loaded from the .env file. No magic numbers or
hardcoded URLs anywhere else in the codebase.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# --- LLM Provider ---
# Set LLM_PROVIDER=groq for production (Railway), LLM_PROVIDER=ollama for local dev
GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
_default_provider = "groq" if GROQ_API_KEY else "ollama"
LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", _default_provider)

# --- Ollama (local dev) ---
OLLAMA_HOST: str = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "llama3.2")

# --- Groq (production) ---
GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

# --- ChromaDB ---
CHROMA_PATH: str = os.getenv("CHROMA_PATH", "./chroma_data")

# --- RAG pipeline ---
CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", "1000"))
CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", "200"))
N_RESULTS: int = int(os.getenv("N_RESULTS", "5"))

# --- CORS ---
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
ALLOWED_ORIGINS: list[str] = [o.strip() for o in _raw_origins.split(",")]

# --- File upload limits ---
MAX_FILE_SIZE_MB: int = int(os.getenv("MAX_FILE_SIZE_MB", "50"))
MAX_FILE_SIZE_BYTES: int = MAX_FILE_SIZE_MB * 1024 * 1024
