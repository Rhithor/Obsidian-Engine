"""
AI Service — Provider-agnostic LLM via LangChain LCEL.

Automatically selects the LLM backend based on config:
  - LLM_PROVIDER=groq  → ChatGroq  (production on Railway, fast, free tier)
  - LLM_PROVIDER=ollama → ChatOllama (local dev, fully private)

The LCEL chain (prompt | llm | parser) is identical for both providers —
this is the key benefit of LangChain's abstraction layer.
"""
import httpx
from typing import AsyncGenerator

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

import config


# ---------------------------------------------------------------------------
# Build the LLM based on the configured provider
# ---------------------------------------------------------------------------
def _build_llm():
    if config.LLM_PROVIDER == "groq":
        from langchain_groq import ChatGroq
        print(f"[AI Service] Using Groq provider (model: {config.GROQ_MODEL})")
        return ChatGroq(
            model=config.GROQ_MODEL,
            api_key=config.GROQ_API_KEY,
            temperature=0.1,
            max_retries=2,
        )
    else:
        from langchain_ollama import ChatOllama
        print(f"[AI Service] Using Ollama provider (model: {config.OLLAMA_MODEL})")
        return ChatOllama(
            model=config.OLLAMA_MODEL,
            base_url=config.OLLAMA_HOST,
            temperature=0.1,
        )


_llm = _build_llm()

# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------
_rag_prompt = ChatPromptTemplate.from_template("""You are a highly secure, private AI assistant called Obsidian Engine.
You must answer the user's question using ONLY the information provided in the Context below.
If the answer is not contained in the Context, explicitly say: "I do not know based on the provided documents."
Do not use any outside knowledge. Do not make up information.

Context:
{context}

Question:
{question}

Answer:""")

_summary_prompt = ChatPromptTemplate.from_template("""Summarize the following text concisely.
Preserve the key facts. The text may have had sensitive information anonymized — treat anonymized tokens like <PERSON> or <EMAIL_ADDRESS> as-is.

Text:
{text}

Summary:""")

# ---------------------------------------------------------------------------
# LCEL Chains (identical regardless of provider)
# ---------------------------------------------------------------------------
_rag_chain = _rag_prompt | _llm | StrOutputParser()
_summary_chain = _summary_prompt | _llm | StrOutputParser()


# ---------------------------------------------------------------------------
# Health check (provider-aware)
# ---------------------------------------------------------------------------
async def is_ollama() -> bool:
    """
    Returns True if the configured LLM provider is reachable.
    For Groq, verifies the API key is set.
    For Ollama, pings the local server.
    """
    if config.LLM_PROVIDER == "groq":
        return bool(config.GROQ_API_KEY)

    async with httpx.AsyncClient(timeout=5) as client:
        try:
            res = await client.get(f"{config.OLLAMA_HOST}/")
            return res.status_code == 200
        except Exception as e:
            print(f"[AI Service] Ollama health check failed: {e}")
            return False


# ---------------------------------------------------------------------------
# RAG response (non-streaming)
# ---------------------------------------------------------------------------
async def generate_rag_response(question: str, context: str) -> str | None:
    try:
        response = await _rag_chain.ainvoke({"context": context, "question": question})
        return response
    except Exception as e:
        print(f"[AI Service] RAG chain error ({config.LLM_PROVIDER}): {e}")
        return None


# ---------------------------------------------------------------------------
# RAG response (streaming)
# ---------------------------------------------------------------------------
async def generate_rag_response_stream(
    question: str, context: str
) -> AsyncGenerator[str, None]:
    try:
        async for chunk in _rag_chain.astream({"context": context, "question": question}):
            yield chunk
    except Exception as e:
        print(f"[AI Service] Streaming error ({config.LLM_PROVIDER}): {e}")
        yield f"\n\n[Error: AI model unavailable — {e}]"


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
async def generate_summary(text: str) -> str | None:
    try:
        response = await _summary_chain.ainvoke({"text": text})
        return response
    except Exception as e:
        print(f"[AI Service] Summary error ({config.LLM_PROVIDER}): {e}")
        return None