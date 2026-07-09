// Shared TypeScript interfaces for Obsidian Engine

export interface Source {
  source: string;
  page: number;
  chunk_index?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  isStreaming?: boolean;
  error?: boolean;
}

export interface Collection {
  collection_id: string;
  filename: string;
  chunk_count: number;
}

export interface HealthStatus {
  status: "active" | "inactive";
  ollama_connection: "connected" | "disconnected";
}

export interface IngestResponse {
  message: string;
  collection_id: string;
  filename: string;
}
