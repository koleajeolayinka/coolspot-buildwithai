import { useState, useEffect } from 'react';
import { Terminal, Code, Cpu, ShieldAlert, History, PlusCircle, Check, HelpCircle, Loader2 } from 'lucide-react';
import IntakePanel from './components/IntakePanel';
import ReviewOutput from './components/ReviewOutput';
import { Review } from './types';

export default function App() {
  const [reviewsHistory, setReviewsHistory] = useState<Review[]>([]);
  const [activeReview, setActiveReview] = useState<Review | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // States to keep track of currently active workspace
  const [selectedType, setSelectedType] = useState<'text' | 'image' | 'link' | null>(null);
  const [inputData, setInputData] = useState<string | null>(null);
  const [reviewOutputText, setReviewOutputText] = useState<string | null>(null);

  // Fetch reviews history on boot
  const fetchReviewsHistory = async () => {
    try {
      const res = await fetch('/api/reviews');
      if (res.ok) {
        const data = await res.json();
        setReviewsHistory(data);
      }
    } catch (err) {
      console.error('Failed to preheat review log database streams:', err);
    }
  };

  useEffect(() => {
    fetchReviewsHistory();
  }, []);

  // Handle new code review request
  const handleStartReview = async (type: 'text' | 'image' | 'link', data: string) => {
    setIsLoading(true);
    setAnalysisError(null);
    setSelectedType(type);
    setInputData(data);
    setReviewOutputText(null);

    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type, data }),
      });

      const body = await res.json();
      
      if (!res.ok) {
        throw new Error(body.error || 'Server rejected review processing.');
      }

      setReviewOutputText(body.reviewText);
      
      // Real-time synchronization back to index list
      await fetchReviewsHistory();

      // Set index highlight
      if (body.id) {
        setActiveReview({
          id: body.id,
          type,
          inputData: data,
          reviewText: body.reviewText,
          createdAt: new Date().toISOString()
        });
      }
    } catch (err: any) {
      console.error('Review process execution error:', err);
      setAnalysisError(err.message || 'An unexpected failure happened during code review.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Handle choosing an item from historical sidebar
  const handleSelectHistoryItem = (review: Review) => {
    setActiveReview(review);
    setSelectedType(review.type);
    setInputData(review.inputData);
    setReviewOutputText(review.reviewText);
    setAnalysisError(null);
  };

  // Reset to create a new review instance
  const handleNewAnalysis = () => {
    setActiveReview(null);
    setSelectedType(null);
    setInputData(null);
    setReviewOutputText(null);
    setAnalysisError(null);
  };

  return (
    <div id="coolspot_dashboard" className="flex flex-col lg:flex-row h-screen w-full bg-[#0F0F10] text-[#eaeaea] font-sans overflow-hidden">
      
      {/* Sidebar: Historical Reviews */}
      <aside id="sidebar_container" className="w-full lg:w-64 bg-[#18181B] lg:border-r border-b lg:border-b-0 border-gray-800 flex flex-col justify-between shrink-0 h-auto lg:h-full">
        <div className="flex flex-col flex-1 min-h-0">
          
          {/* Logo block */}
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-white text-base">C</div>
              <span className="text-xl font-semibold tracking-tight text-white font-sans">CoolSpot</span>
            </div>
          </div>

          {/* Quick trigger to clear work canvas and run a new analysis */}
          <div className="px-4 pb-4 border-b border-gray-800">
            <button
              id="sidebar_new_audit_btn"
              type="button"
              onClick={handleNewAnalysis}
              className="w-full py-2.5 px-4 rounded-lg font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider shadow-sm"
            >
              <PlusCircle size={15} />
              <span>New Analysis</span>
            </button>
          </div>

          {/* Historical Review Listing Header */}
          <div className="px-6 pt-5 pb-2 flex items-center justify-between">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
              Historical Reviews ({reviewsHistory.length})
            </div>
            <span className="text-[9px] text-gray-400 bg-gray-850/40 px-2 py-0.5 rounded font-mono border border-gray-800">CLOUD</span>
          </div>

          {/* Historical list items */}
          <div id="reviews_history_scroller" className="flex-1 overflow-y-auto max-h-[220px] lg:max-h-none px-4 py-2 space-y-2">
            {reviewsHistory.length === 0 ? (
              <div id="empty_history_log" className="text-center py-8 px-4 border border-dashed border-gray-800 rounded-lg bg-gray-900/10">
                <p className="text-xs text-gray-500">No review records found</p>
                <p className="text-[10px] text-gray-600 mt-1">Submit code snippet to run audit</p>
              </div>
            ) : (
              reviewsHistory.map((item) => {
                const isSelected = activeReview?.id === item.id;
                
                // Truncate input data description preview text
                const snippetSummary = item.type === 'link' 
                  ? item.inputData 
                  : item.type === 'image' 
                    ? 'Screenshot snapshot upload' 
                    : item.inputData.split('\n')[0].substring(0, 32) || 'Empty snippet';

                const timeStr = new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                const typeLabel = item.type === 'link' ? 'URL' : item.type === 'image' ? 'Image' : 'Snippet';

                return (
                  <button
                    id={`history_button_${item.id}`}
                    key={item.id}
                    onClick={() => handleSelectHistoryItem(item)}
                    type="button"
                    className={`w-full text-left p-3 rounded-lg border transition-all flex flex-col gap-1 ${
                      isSelected
                        ? 'bg-gray-800/60 border-gray-750 text-white shadow-inner'
                        : 'border-transparent hover:bg-gray-800/40 hover:border-gray-800 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <div className="text-sm font-medium truncate w-full">{snippetSummary}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      {timeStr} • {typeLabel}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* User Bio Footer */}
        <div className="p-4 border-t border-gray-800 bg-[#161618]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-tr from-indigo-500 to-rose-450 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white shadow-inner">AR</div>
            <div className="text-sm leading-tight">
              <div className="font-medium text-white">Alex Rivera</div>
              <div className="text-xs text-gray-500">Pro Plan</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main View */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#0F0F10]">
        
        {/* Main Header */}
        <header id="top_app_header" className="h-16 border-b border-gray-800 flex items-center justify-between px-8 bg-[#121214] shrink-0">
          <div className="flex items-center gap-3">
            <h2 id="app_brand_title" className="text-lg font-medium text-white tracking-tight">Code Review Dashboard</h2>
          </div>

          <div id="env_diagnostics" className="flex items-center gap-3">
            <span className="flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-400 text-xs rounded-full border border-green-500/20 font-mono">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
              Gemini Flash Active
            </span>
            <span className="hidden md:inline-flex items-center gap-1 xl:gap-2 px-3 py-1 bg-indigo-500/10 text-indigo-400 text-xs rounded-full border border-indigo-500/10 font-mono">
              Firestore v2 Connected
            </span>
          </div>
        </header>

        {/* Content Area / Ingest & Verdict Grid */}
        <div id="primary_layout_container" className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 p-6 lg:p-8 overflow-y-auto">
          
          {/* Intake column */}
          <div id="intake_panel_column" className="flex flex-col gap-4">
            <div className="flex items-center justify-between pl-1">
              <div>
                <h3 className="text-xs font-bold text-gray-400 tracking-wider font-mono uppercase">1. ANALYST WORKPLACE INGEST</h3>
                <p className="text-[11px] text-gray-500">Formulate inputs using code snippets, screenshot frames, or public URLs</p>
              </div>
            </div>

            <IntakePanel onStartReview={handleStartReview} isLoading={isLoading} />

            {/* Ingested source summary indicator */}
            {inputData && selectedType === 'text' && (
              <div id="ingested_meta_card" className="rounded-xl border border-gray-850 bg-[#121214] p-4 text-[#bfdbfe]">
                <div className="flex items-center gap-2 mb-2">
                  <Terminal size={14} className="text-indigo-400" />
                  <span className="text-xs font-mono text-gray-400 font-semibold uppercase">Currently Active Source:</span>
                </div>
                <pre className="text-[11px] font-mono text-gray-500 line-clamp-3 overflow-hidden bg-black/30 p-2.5 rounded border border-gray-800/40">
                  {inputData}
                </pre>
              </div>
            )}
          </div>

          {/* Verdict/Output column */}
          <div id="review_output_column" className="flex flex-col gap-4">
            <div className="flex items-center justify-between pl-1">
              <div>
                <h3 className="text-xs font-bold text-gray-400 tracking-wider font-mono uppercase">2. AUDIT VERDICT</h3>
                <p className="text-[11px] text-gray-500">AI security guidelines, bug analysis, and design highlights</p>
              </div>
            </div>

            {/* State Management Panels */}
            {analysisError ? (
              <div id="output_failure_card" className="border border-rose-500/30 bg-rose-500/5 rounded-2xl p-6 text-center shadow-lg">
                <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400 mx-auto mb-3">
                  <ShieldAlert size={22} />
                </div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">Analysis Engine Interrupted</h4>
                <p className="text-xs text-rose-300 max-w-sm mx-auto mt-2 leading-relaxed">
                  {analysisError}
                </p>
                <button
                  id="retry_analysis_btn"
                  type="button"
                  onClick={() => handleStartReview(selectedType!, inputData!)}
                  className="mt-4 px-4 py-2 bg-rose-650 hover:bg-rose-500 text-white font-semibold rounded-lg text-xs transition-colors"
                >
                  Retry Analysis
                </button>
              </div>
            ) : isLoading ? (
              <div id="output_loading_card" className="h-full border border-indigo-500/20 rounded-2xl bg-[#202124]/40 flex flex-col items-center justify-center p-8 text-center min-h-[400px]">
                <Loader2 className="animate-spin text-indigo-400 mb-4" size={32} />
                <h3 className="text-lg font-bold text-gray-350 animate-pulse">Running GenAI Audit...</h3>
                <p className="text-xs text-gray-400 max-w-xs mt-2 leading-relaxed">
                  Mapping AST tokens, querying system safety modules, and reviewing quality parameters with Gemini Flash.
                </p>
              </div>
            ) : (
              <div className="bg-[#121214]/60 border border-gray-800 rounded-2xl p-6 shadow-xl">
                <ReviewOutput
                  reviewText={reviewOutputText}
                  selectedType={selectedType}
                  inputData={inputData}
                />
              </div>
            )}

          </div>

        </div>

      </main>

    </div>
  );
}
