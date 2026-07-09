"""
AI Service — LLM interaction via LangChain LCEL pipeline.

Uses the LangChain Expression Language (LCEL) to build a proper
chain: prompt template → LLM → output parser. This replaces the
original raw httpx calls and makes LangChain an actual dependency,
not a phantom one.

Streaming: the generate_rag_response_stream() generator yields
token-by-token text for SSE streaming to the frontend.
"""
import httpx
from langchain_ollama import ChatOllama
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from typing import AsyncGenerator
import config

# --- Shared LLM instance ---
_llm = ChatOllama(
    model=config.OLLAMA_MODEL,
    base_url=config.OLLAMA_HOST,
    temperature=0.1,  # Low temperature for factual RAG responses
    timeout=120,
)

# --- RAG prompt ---
_rag_prompt = ChatPromptTemplate.from_template("""You are a highly secure, private AI assistant called Obsidian Engine.
You must answer the user's question using ONLY the information provided in the Context below.
If the answer is not contained in the Context, explicitly say: "I do not know based on the provided documents."
Do not use any outside knowledge. Do not make up information.

Context:
{context}

Question:
{question}

Answer:""")

# --- Summary prompt ---
_summary_prompt = ChatPromptTemplate.from_template("""Summarize the following text concisely. 
Preserve the key facts. The text may have had sensitive information anonymized — treat anonymized tokens like <PERSON> or <EMAIL_ADDRESS> as-is.

Text:
{text}

Summary:""")

# --- Build LCEL chains ---
_rag_chain = _rag_prompt | _llm | StrOutputParser()
_summary_chain = _summary_prompt | _llm | StrOutputParser()


async def is_ollama() -> bool:
    """Checks if the Ollama server is reachable."""
    async with httpx.AsyncClient(timeout=5) as client:
        try:
            res = await client.get(f"{config.OLLAMA_HOST}/")
            return res.status_code == 200
        except Exception as e:
            print(f"[AI Service] Ollama health check failed: {e}")
            return False


async def generate_rag_response(question: str, context: str) -> str | None:
    """
    Generates a RAG response using the LCEL chain (non-streaming).
    Returns the full response string, or None on failure.
    """
    try:
        response = await _rag_chain.ainvoke({"context": context, "question": question})
        return response
    except Exception as e:
        print(f"[AI Service] RAG chain failed: {e}")
        return None


async def generate_rag_response_stream(
    question: str, context: str
) -> AsyncGenerator[str, None]:
    """
    Streams the RAG response token by token via the LCEL chain.
    Each yielded value is a plain text chunk for SSE.
    """
    try:
        async for chunk in _rag_chain.astream({"context": context, "question": question}):
            yield chunk
    except Exception as e:
        print(f"[AI Service] Streaming RAG chain failed: {e}")
        yield f"\n\n[Error: AI model unavailable — {e}]"


async def generate_summary(text: str) -> str | None:
    """Generates a summary of the given (pre-scrubbed) text."""
    try:
        response = await _summary_chain.ainvoke({"text": text})
        return response
    except Exception as e:
        print(f"[AI Service] Summary chain failed: {e}")
        return None