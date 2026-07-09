import { useState, useEffect, useRef, useCallback } from "react";
import {
  fetchHealth,
  fetchCollections,
  deleteCollection,
  ingestDocument,
  streamQuery,
} from "./api";
import type { ChatMessage, Collection, Source } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function genId() {
  return Math.random().toString(36).slice(2);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Animated pulsing dot for streaming / thinking state */
function TypingDot() {
  return (
    <span className="inline-flex items-center gap-1 ml-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

/** Health badge shown in the header */
function HealthBadge({ active }: { active: boolean | null }) {
  if (active === null)
    return (
      <span className="flex items-center gap-1.5 text-xs text-gray-500">
        <span className="w-2 h-2 rounded-full bg-gray-600 animate-pulse" />
        Checking…
      </span>
    );
  return (
    <span
      className={`flex items-center gap-1.5 text-xs font-medium ${
        active ? "text-emerald-400" : "text-red-400"
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          active ? "bg-emerald-400 shadow-[0_0_6px_#34d399]" : "bg-red-500"
        }`}
      />
      Ollama {active ? "connected" : "offline"}
    </span>
  );
}

/** Individual chat bubble */
function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} gap-1`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-gradient-to-br from-orange-500/80 to-pink-500/80 text-white rounded-br-sm"
            : msg.error
            ? "bg-red-900/40 border border-red-500/30 text-red-200 rounded-bl-sm"
            : "bg-white/5 border border-white/10 text-gray-100 rounded-bl-sm"
        }`}
      >
        {msg.content || (msg.isStreaming ? <TypingDot /> : null)}
        {msg.isStreaming && msg.content && <TypingDot />}
      </div>

      {/* Sources */}
      {!isUser && msg.sources && msg.sources.length > 0 && (
        <div className="flex flex-wrap gap-1.5 max-w-[85%] pl-1">
          {msg.sources.map((src, i) => (
            <span
              key={i}
              className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/25"
            >
              {src.source} · p.{src.page + 1}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Document collection card in the sidebar */
function CollectionCard({
  col,
  isActive,
  onSelect,
  onDelete,
}: {
  col: Collection;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer border transition-all duration-200 ${
        isActive
          ? "bg-orange-500/15 border-orange-500/40 shadow-[0_0_12px_rgba(249,115,22,0.2)]"
          : "bg-white/3 border-white/8 hover:bg-white/6 hover:border-white/15"
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-200 truncate" title={col.filename}>
          {col.filename}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">{col.chunk_count} chunks indexed</p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="ml-2 opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all duration-150 p-1 rounded-md hover:bg-red-500/10"
        title="Delete document"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------
export default function App() {
  // --- Health ---
  const [ollamaActive, setOllamaActive] = useState<boolean | null>(null);

  // --- Collections (sidebar) ---
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);

  // --- Upload ---
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // --- Chat ---
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isQuerying, setIsQuerying] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- Toast ---
  const [toast, setToast] = useState<{ text: string; type: "error" | "success" } | null>(null);

  // ---------------------------------------------------------------------------
  const showToast = useCallback((text: string, type: "error" | "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadCollections = useCallback(async () => {
    try {
      const cols = await fetchCollections();
      setCollections(cols);
    } catch {
      // Non-fatal
    }
  }, []);

  const pollHealth = useCallback(async () => {
    try {
      const h = await fetchHealth();
      setOllamaActive(h.status === "active");
    } catch {
      setOllamaActive(false);
    }
  }, []);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initial load + periodic health poll
  useEffect(() => {
    pollHealth();
    loadCollections();
    const healthInterval = setInterval(pollHealth, 15000);
    return () => clearInterval(healthInterval);
  }, [pollHealth, loadCollections]);

  // ---------------------------------------------------------------------------
  async function handleUpload() {
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      const result = await ingestDocument(selectedFile);
      setActiveCollectionId(result.collection_id);
      setSelectedFile(null);
      setMessages([]);
      showToast(`"${result.filename}" is being indexed…`, "success");
      // Poll collections after a delay to let background task finish
      setTimeout(loadCollections, 3000);
      setTimeout(loadCollections, 8000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setUploadError(msg);
      showToast(msg, "error");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleQuery() {
    if (!userInput.trim() || isQuerying) return;
    if (!activeCollectionId) {
      showToast("Select a document from the sidebar first.", "error");
      return;
    }

    const userMsg: ChatMessage = {
      id: genId(),
      role: "user",
      content: userInput.trim(),
    };
    const assistantMsg: ChatMessage = {
      id: genId(),
      role: "assistant",
      content: "",
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setUserInput("");
    setIsQuerying(true);

    let finalSources: Source[] = [];

    try {
      const stream = streamQuery(
        userMsg.content,
        activeCollectionId,
        (sources) => {
          finalSources = sources;
        }
      );

      let fullContent = "";
      for await (const token of stream) {
        fullContent += token;
        const snapshot = fullContent;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: snapshot, isStreaming: true }
              : m
          )
        );
      }

      // Finalize with sources
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: fullContent, isStreaming: false, sources: finalSources }
            : m
        )
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Query failed";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: msg, isStreaming: false, error: true }
            : m
        )
      );
      showToast(msg, "error");
    } finally {
      setIsQuerying(false);
    }
  }

  async function handleDeleteCollection(collectionId: string) {
    try {
      await deleteCollection(collectionId);
      if (activeCollectionId === collectionId) {
        setActiveCollectionId(null);
        setMessages([]);
      }
      await loadCollections();
      showToast("Document removed.", "success");
    } catch {
      showToast("Failed to delete document.", "error");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleQuery();
    }
  }

  const activeCollection = collections.find((c) => c.collection_id === activeCollectionId);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#05050A] text-gray-200 font-sans flex flex-col">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <header className="border-b border-white/8 px-6 py-4 flex items-center justify-between backdrop-blur-sm bg-black/30 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-pink-600 flex items-center justify-center shadow-[0_0_12px_rgba(249,115,22,0.4)]">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white tracking-wide">Obsidian Engine</h1>
            <p className="text-xs text-gray-500">Private Document Intelligence</p>
          </div>
        </div>
        <HealthBadge active={ollamaActive} />
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Main layout: Sidebar + Chat                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <aside className="w-72 border-r border-white/8 flex flex-col bg-black/20 shrink-0">
          <div className="p-4 border-b border-white/6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
              Knowledge Vault
            </p>

            {/* Upload zone */}
            <div className="space-y-2">
              <label
                htmlFor="file-upload"
                className={`flex items-center justify-center gap-2 w-full border-2 border-dashed rounded-xl p-4 text-sm cursor-pointer transition-all duration-200 ${
                  selectedFile
                    ? "border-orange-500/50 bg-orange-500/8 text-orange-300"
                    : "border-white/15 text-gray-500 hover:border-white/25 hover:text-gray-400 hover:bg-white/3"
                }`}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="truncate">
                  {selectedFile ? selectedFile.name : "Select PDF…"}
                </span>
              </label>
              <input
                id="file-upload"
                type="file"
                accept=".pdf"
                className="sr-only"
                onChange={(e) => {
                  setUploadError(null);
                  setSelectedFile(e.target.files?.[0] ?? null);
                }}
              />

              {uploadError && (
                <p className="text-xs text-red-400">{uploadError}</p>
              )}

              <button
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
                className="w-full py-2 rounded-xl text-sm font-medium transition-all duration-200 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-400 hover:to-pink-400 text-white disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 shadow-[0_0_16px_rgba(249,115,22,0.3)] disabled:shadow-none"
              >
                {isUploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Uploading…
                  </span>
                ) : (
                  "Index Document"
                )}
              </button>
            </div>
          </div>

          {/* Document list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {collections.length === 0 ? (
              <p className="text-xs text-gray-600 text-center mt-8 px-4">
                No documents indexed yet. Upload a PDF to get started.
              </p>
            ) : (
              collections.map((col) => (
                <CollectionCard
                  key={col.collection_id}
                  col={col}
                  isActive={col.collection_id === activeCollectionId}
                  onSelect={() => {
                    setActiveCollectionId(col.collection_id);
                    setMessages([]);
                  }}
                  onDelete={() => handleDeleteCollection(col.collection_id)}
                />
              ))
            )}
          </div>
        </aside>

        {/* Chat area */}
        <main className="flex-1 flex flex-col overflow-hidden">

          {/* Active document banner */}
          {activeCollection && (
            <div className="px-6 py-2 bg-orange-500/8 border-b border-orange-500/20 flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-orange-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
              <span className="text-xs text-orange-300">
                Querying: <strong>{activeCollection.filename}</strong>
              </span>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500/20 to-pink-500/20 border border-orange-500/20 flex items-center justify-center shadow-[0_0_30px_rgba(249,115,22,0.15)]">
                  <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-300">
                    {activeCollectionId
                      ? "Ask anything about your document"
                      : "Select a document to start querying"}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {activeCollectionId
                      ? "Responses are grounded in your document — no hallucinations."
                      : "Upload a PDF or pick one from the sidebar."}
                  </p>
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <ChatBubble key={msg.id} msg={msg} />
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input bar */}
          <div className="border-t border-white/8 px-6 py-4 bg-black/20">
            <div className="flex items-end gap-3 max-w-4xl mx-auto">
              <textarea
                className="flex-1 bg-white/5 border border-white/12 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30 rounded-2xl px-4 py-3 text-sm text-gray-100 placeholder-gray-600 transition-all outline-none resize-none h-12 max-h-40 leading-relaxed"
                placeholder={
                  activeCollectionId
                    ? "Ask a question…  (Enter to send)"
                    : "Select a document first…"
                }
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!activeCollectionId || isQuerying}
                rows={1}
              />
              <button
                onClick={handleQuery}
                disabled={!userInput.trim() || !activeCollectionId || isQuerying}
                className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-pink-500 hover:from-orange-400 hover:to-pink-400 disabled:from-gray-700 disabled:to-gray-700 flex items-center justify-center transition-all duration-200 shadow-[0_0_16px_rgba(249,115,22,0.35)] disabled:shadow-none"
              >
                {isQuerying ? (
                  <svg className="w-4 h-4 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Toast notification                                                   */}
      {/* ------------------------------------------------------------------ */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-2xl border transition-all duration-300 animate-slide-up max-w-sm ${
            toast.type === "error"
              ? "bg-red-900/80 border-red-500/40 text-red-200 backdrop-blur-sm"
              : "bg-emerald-900/80 border-emerald-500/40 text-emerald-200 backdrop-blur-sm"
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}