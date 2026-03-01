import { useState } from "react";

// 1. Updated Interfaces to match the new FastAPI responses
interface Source {
  source: string;
  page: number;
}

interface QueryResponse {
  answer: string;
  sources: Source[];
}

function App() {
  // 2. Chat State
  const [userInput, setUserInput] = useState("");
  const [appLoading, setAppLoading] = useState(false);
  const [finalResult, setFinalResult] = useState<QueryResponse | null>(null);
  
  // 3. File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");

  // 4. File Upload Logic (The FormData Envelope)
  async function handleUpload() {
    if (!selectedFile) {
      setUploadStatus("Please select a file first.");
      return;
    }

    setIsUploading(true);
    setUploadStatus("Sending to Vault...");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const response = await fetch("http://127.0.0.1:8000/ingest", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setUploadStatus("Document ingested successfully!");
        setSelectedFile(null); // Clear the selected file
      } else {
        setUploadStatus("Upload failed. Check the server.");
      }
    } catch (error) {
      console.error(error);
      setUploadStatus("Network error occurred.");
    } finally {
      setIsUploading(false);
    }
  }

  // 5. Query Logic (The RAG Handoff)
  async function submit() {
    if (!userInput.trim()) return;
    
    setAppLoading(true);
    setFinalResult(null);
    
    try {
      const response = await fetch("http://127.0.0.1:8000/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ QueryRequest: userInput }),
      });
      
      const data = await response.json();
      setFinalResult(data);
    } catch (error) {
      console.error(error);
    } finally {
      setAppLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#05050A] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1a1a2e] via-[#05050A] to-black text-gray-200 p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-12 pt-10">
        
        {/* Input Vault Card */}
        <div className="max-w-3xl mx-auto relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-orange-500/20 to-pink-500/20 rounded-[2rem] blur-xl opacity-50 group-hover:opacity-75 transition duration-1000"></div>

          <div className="relative bg-[#0d0d14]/80 backdrop-blur-2xl border border-orange-500/30 p-10 rounded-[2rem] shadow-2xl flex flex-col items-center">
            <h1 className="text-4xl font-light tracking-widest text-white mb-8 uppercase text-center">
              Obsidian Engine
            </h1>
            
            {/* New File Upload Section */}
            <div className="flex flex-col items-center gap-4 mb-8 w-full max-w-sm bg-black/40 border border-gray-700/50 p-4 rounded-xl">
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-500/20 file:text-orange-400 hover:file:bg-orange-500/30 transition-all cursor-pointer outline-none"
              />
              <button
                 onClick={handleUpload}
                 disabled={isUploading || !selectedFile}
                 className="w-full bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white font-medium py-2 px-6 rounded-full transition-all border border-gray-600 shadow-inner"
              >
                {isUploading ? "Uploading..." : "Upload PDF"}
              </button>
              {uploadStatus && (
                <span className="text-xs font-medium text-orange-300 animate-pulse">
                  {uploadStatus}
                </span>
              )}
            </div>
            
            {/* Chat Textarea */}
            <textarea
              className="w-full bg-black/40 border border-gray-700/50 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 rounded-xl p-5 text-gray-100 placeholder-gray-600 transition-all outline-none resize-none h-32 mb-8 shadow-inner"
              placeholder="Ask a question about your document..."
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
            />

            <button
              type="submit"
              onClick={submit}
              disabled={appLoading || !userInput}
              className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-400 hover:to-pink-400 disabled:from-gray-700 disabled:to-gray-800 disabled:text-gray-400 text-white font-medium tracking-wide py-3 px-10 rounded-full transition-all duration-300 shadow-[0_0_20px_rgba(249,115,22,0.4)] hover:shadow-[0_0_30px_rgba(249,115,22,0.6)]"
            >
              {appLoading ? "Thinking..." : "Query Engine"}
            </button>
          </div>
        </div>

        {/* Results Glass Panels */}
        {finalResult && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in-up">
            
            {/* AI Intelligence Panel (Left) */}
            <div className="relative bg-gradient-to-br from-emerald-500/10 to-teal-500/10 backdrop-blur-xl border border-emerald-500/30 p-8 rounded-[2rem] shadow-[0_0_30px_rgba(16,185,129,0.15)]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold tracking-wide text-white">
                  AI Response
                </h3>
                <span className="text-xs font-bold tracking-wider uppercase px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Generated
                </span>
              </div>
              <div className="text-sm leading-relaxed text-emerald-100/90 whitespace-pre-wrap">
                {finalResult.answer}
              </div>
            </div>

            {/* Vault Sources Panel (Right) */}
            <div className="relative bg-gradient-to-br from-indigo-500/10 to-purple-500/10 backdrop-blur-xl border border-indigo-400/30 p-8 rounded-[2rem] shadow-[0_0_30px_rgba(99,102,241,0.1)]">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold tracking-wide text-white">
                  Vault Sources
                </h3>
                <span className="text-xs font-bold tracking-wider uppercase px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {finalResult.sources?.length || 0} References
                </span>
              </div>
              
              <div className="space-y-3">
                {finalResult.sources && finalResult.sources.length > 0 ? (
                  finalResult.sources.map((source, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between p-3 rounded-lg bg-black/30 border border-indigo-500/20"
                    >
                      <span className="text-sm font-medium text-indigo-200 truncate pr-4">
                        {source.source}
                      </span>
                      <span className="text-xs text-indigo-400 bg-indigo-900/40 px-2 py-1 rounded">
                        Page {source.page}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-indigo-200/50 italic">No sources retrieved.</p>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

export default App;