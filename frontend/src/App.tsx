import { useState } from "react";
interface BackendResponse {
  scrubbed_text: string;
  is_scrubbed: boolean;
  summary: string;
}

function App() {
  const [userInput, setUserInput] = useState("");
  const [appLoading, setAppLoading] = useState(false);
  const [finalResult, setFinalResult] = useState<BackendResponse | null>(null);
  async function submit() {
    setAppLoading(true);
    setFinalResult(null);
    const response = await fetch("http://127.0.0.1:8000/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_info: userInput }),
    });
    const data = await response.json();
    setFinalResult(data);
    setAppLoading(false);
  }
  return (
    // Deep, dark tech background with a subtle radial glow
    <div className="min-h-screen bg-[#05050A] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1a1a2e] via-[#05050A] to-black text-gray-200 p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-12 pt-10">
        {/* Input Vault Card */}
        <div className="max-w-3xl mx-auto relative group">
          {/* Subtle outer glow effect for the card */}
          <div className="absolute -inset-1 bg-gradient-to-r from-orange-500/20 to-pink-500/20 rounded-[2rem] blur-xl opacity-50 group-hover:opacity-75 transition duration-1000"></div>

          <div className="relative bg-[#0d0d14]/80 backdrop-blur-2xl border border-orange-500/30 p-10 rounded-[2rem] shadow-2xl flex flex-col items-center">
            <h1 className="text-4xl font-light tracking-widest text-white mb-8 uppercase text-center">
              Obsidian Engine
            </h1>

            <textarea
              className="w-full bg-black/40 border border-gray-700/50 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 rounded-xl p-5 text-gray-100 placeholder-gray-600 transition-all outline-none resize-none h-32 mb-8 shadow-inner"
              placeholder="Enter text to analyze..."
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
            />

            <button
              type="submit"
              onClick={submit}
              disabled={appLoading}
              className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-400 hover:to-pink-400 disabled:from-gray-700 disabled:to-gray-800 disabled:text-gray-400 text-white font-medium tracking-wide py-3 px-10 rounded-full transition-all duration-300 shadow-[0_0_20px_rgba(249,115,22,0.4)] hover:shadow-[0_0_30px_rgba(249,115,22,0.6)]"
            >
              {appLoading ? "Processing..." : "Scrub & Summarize"}
            </button>
          </div>
        </div>

        {/* Results Glass Panels */}
        {finalResult && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in-up">
            {/* Scrubbed Text Panel (Cool Blue/Purple) */}
            <div className="relative bg-gradient-to-br from-indigo-500/10 to-purple-500/10 backdrop-blur-xl border border-indigo-400/30 p-8 rounded-[2rem] shadow-[0_0_30px_rgba(99,102,241,0.1)]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold tracking-wide text-white">
                  Scrubbed Text
                </h3>
                <span className="text-xs font-bold tracking-wider uppercase px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {finalResult.is_scrubbed ? "PII Redacted" : "Clean"}
                </span>
              </div>
              <div className="text-sm leading-relaxed text-indigo-100/80">
                {finalResult.scrubbed_text}
              </div>
            </div>

            {/* AI Summary Panel (Dynamic Color) */}
            {/* If scrubbed, it turns warm Orange/Red. If clean, it turns cool Green. */}
            <div
              className={`relative backdrop-blur-xl p-8 rounded-[2rem] border shadow-2xl transition-colors duration-500 ${
                finalResult.is_scrubbed
                  ? "bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/30 shadow-[0_0_30px_rgba(249,115,22,0.15)]"
                  : "bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.15)]"
              }`}
            >
              <h3 className="text-lg font-semibold tracking-wide text-white mb-4">
                AI Summary
              </h3>
              <div
                className={`text-sm leading-relaxed ${finalResult.is_scrubbed ? "text-orange-100/80" : "text-emerald-100/80"}`}
              >
                {finalResult.summary}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
