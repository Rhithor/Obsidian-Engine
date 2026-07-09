/**
 * Centralised API layer for Obsidian Engine.
 *
 * The backend URL is read from the VITE_API_URL environment variable.
 * In development this defaults to http://127.0.0.1:8000.
 * In production (Railway backend + Vercel frontend) this will be the Railway URL.
 */
import type { Collection, HealthStatus, IngestResponse, Source } from "./types";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error("Health check failed");
  return res.json();
}

// ---------------------------------------------------------------------------
// Collections (document management)
// ---------------------------------------------------------------------------
export async function fetchCollections(): Promise<Collection[]> {
  const res = await fetch(`${API_BASE}/collections`);
  if (!res.ok) throw new Error("Failed to load collections");
  return res.json();
}

export async function deleteCollection(collectionId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/collections/${collectionId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete collection");
}

// ---------------------------------------------------------------------------
// Ingest
// ---------------------------------------------------------------------------
export async function ingestDocument(file: File): Promise<IngestResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/ingest`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(err.detail ?? "Upload failed");
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Streaming Query
// ---------------------------------------------------------------------------
export async function* streamQuery(
  query: string,
  collectionId: string,
  onSources: (sources: Source[]) => void
): AsyncGenerator<string> {
  const res = await fetch(`${API_BASE}/query/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, collection_id: collectionId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Query failed" }));
    throw new Error(err.detail ?? "Query failed");
  }

  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("event: sources")) continue;
      if (line.startsWith("event: done")) continue;

      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") return;

        // Check if this is the sources JSON event
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) {
            onSources(parsed as Source[]);
            continue;
          }
        } catch {
          // Not JSON — it's a text token
        }

        yield data;
      }
    }
  }
}
