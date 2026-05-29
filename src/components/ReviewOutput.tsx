import React from 'react';
import { AlertTriangle, Zap, ShieldCheck, Share, FileText, CheckCircle } from 'lucide-react';

interface ReviewOutputProps {
  reviewText: string | null;
  selectedType: 'text' | 'image' | 'link' | null;
  inputData: string | null;
}

// Custom simple parser to render basic markdown elements safely
function RenderMarkdown({ text }: { text: string }) {
  if (!text) return <p className="text-gray-400 text-sm italic">No details provided for this section.</p>;

  const lines = text.split('\n');
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];

  return (
    <div className="space-y-2 text-sm text-gray-300 leading-relaxed font-sans">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // Code block toggle
        if (trimmed.startsWith('```')) {
          if (inCodeBlock) {
            inCodeBlock = false;
            const blockContent = codeBlockLines.join('\n');
            codeBlockLines = [];
            return (
              <pre
                key={`code-${idx}`}
                className="bg-black/60 border border-gray-800/80 p-4 rounded-xl text-xs font-mono text-emerald-400 overflow-x-auto my-3 leading-relaxed shadow-inner"
              >
                <code>{blockContent}</code>
              </pre>
            );
          } else {
            inCodeBlock = true;
            return null;
          }
        }

        if (inCodeBlock) {
          codeBlockLines.push(line);
          return null;
        }

        // Section header inside block (e.g. ### or ##)
        if (trimmed.startsWith('#')) {
          const depth = line.match(/^#+/)?.[0].length || 1;
          const headingText = trimmed.replace(/^#+\s*/, '');
          const classes = depth === 1 ? 'text-lg font-bold text-gray-100 mt-4' : 'text-base font-semibold text-gray-100 mt-3';
          return <h4 key={idx} className={`${classes}`}>{headingText}</h4>;
        }

        // Unordered list item
        if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
          const listText = trimmed.replace(/^[-*]\s*/, '');
          return (
            <div key={idx} className="flex items-start gap-2.5 ml-1 my-1">
              <span className="text-emerald-500 mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="flex-1">{parseInlineMarkdown(listText)}</span>
            </div>
          );
        }

        // Ordered lists
        if (/^\d+\.\s+/.test(trimmed)) {
          const listText = trimmed.replace(/^\d+\.\s+/, '');
          const num = trimmed.match(/^\d+/)?.[0] || '1';
          return (
            <div key={idx} className="flex items-start gap-2 ml-1 my-1">
              <span className="text-emerald-400 font-mono text-xs mt-0.5 flex-shrink-0 w-5">{num}.</span>
              <span className="flex-1">{parseInlineMarkdown(listText)}</span>
            </div>
          );
        }

        // Empty line spacer
        if (trimmed === '') {
          return <div key={idx} className="h-1.5" />;
        }

        // Standard line paragraph text
        return <p key={idx}>{parseInlineMarkdown(line)}</p>;
      })}
    </div>
  );
}

// Function to convert basic bold `**bold**` and inline `` `code` `` fragments
function parseInlineMarkdown(text: string): React.ReactNode[] {
  // Regex to split on either `**` (bold) or ``` ` ``` (code)
  const regex = /(\*\*.*?\*\*|`.*?`)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const boldText = part.slice(2, -2);
      return <strong key={index} className="font-semibold text-gray-100 text-[#f3f4f6]">{boldText}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      const codeText = part.slice(1, -1);
      return (
        <code key={index} className="px-1.5 py-0.5 bg-black/40 border border-gray-800 text-emerald-400 rounded font-mono text-xs">
          {codeText}
        </code>
      );
    }
    return part;
  });
}

function parseReviewSections(mdText: string) {
  const sections = {
    critical: '',
    performance: '',
    cleanCode: '',
    general: '',
  };

  const criticalMarker = '🚨 CRITICAL BUGS';
  const performanceMarker = '⚡ PERFORMANCE';
  const cleanCodeMarker = '🔒 CLEAN CODE';

  const idxCrit = mdText.indexOf(criticalMarker);
  const idxPerf = mdText.indexOf(performanceMarker);
  const idxClean = mdText.indexOf(cleanCodeMarker);

  const markers = [
    { type: 'crit', index: idxCrit, label: criticalMarker },
    { type: 'perf', index: idxPerf, label: performanceMarker },
    { type: 'clean', index: idxClean, label: cleanCodeMarker },
  ]
    .filter((m) => m.index !== -1)
    .sort((a, b) => a.index - b.index);

  if (markers.length === 0) {
    sections.general = mdText;
    return sections;
  }

  // Content before first exact marker
  sections.general = mdText.substring(0, markers[0].index).trim();

  for (let i = 0; i < markers.length; i++) {
    const current = markers[i];
    const start = current.index + current.label.length;
    const end = i + 1 < markers.length ? markers[i + 1].index : mdText.length;
    let sectionText = mdText.substring(start, end).trim();

    // Clean leading syntax artifacts
    sectionText = sectionText.replace(/^[\s#*:=[\]-]+/, '').trim();

    if (current.type === 'crit') {
      sections.critical = sectionText;
    } else if (current.type === 'perf') {
      sections.performance = sectionText;
    } else if (current.type === 'clean') {
      sections.cleanCode = sectionText;
    }
  }

  return sections;
}

export default function ReviewOutput({ reviewText, selectedType, inputData }: ReviewOutputProps) {
  if (!reviewText) {
    return (
      <div id="review_output_placeholder" className="h-full border border-gray-800 rounded-2xl bg-[#121314]/30 flex flex-col items-center justify-center p-8 text-center min-h-[400px]">
        <div id="placeholder_ring" className="w-16 h-16 rounded-full bg-[#1e2024] border border-gray-800 flex items-center justify-center text-gray-500 mb-4 animate-pulse">
          <FileText size={28} />
        </div>
        <h3 id="placeholder_heading" className="text-lg font-bold text-gray-300">Analysis report pending</h3>
        <p id="placeholder_desc" className="text-sm text-gray-500 max-w-sm mt-2 leading-relaxed">
          Input your script or screenshot in the Intake Panel and run review to display live AI recommendations here.
        </p>
      </div>
    );
  }

  const sections = parseReviewSections(reviewText);

  return (
    <div id="review_output_container" className="flex flex-col gap-6 animation-fade-in">
      
      {/* Container overview bar matching Stitch spec */}
      <div id="output_header_row" className="flex items-center justify-between border-b border-gray-800/80 pb-4">
        <div>
          <h2 id="report_heading" className="text-lg font-bold text-gray-200 tracking-wide">COOLSPOT ANALYTICAL REPORT</h2>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] font-mono uppercase bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/20 font-semibold">
              Analysis: {selectedType === 'image' ? 'Screenshot Visual' : selectedType === 'link' ? 'Script URL' : 'Snipped Code'}
            </span>
            <span className="text-xs text-gray-500 font-mono">• Generated just now</span>
          </div>
        </div>
        
        <button
          id="copy_report_txt_btn"
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(reviewText);
            alert('Coolspot review report copied to clipboard!');
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#202124] hover:bg-[#2d2e33] text-gray-400 hover:text-gray-200 border border-gray-850/60 transition-all text-xs font-semibold"
        >
          <Share size={13} />
          <span>Copy Markdown</span>
        </button>
      </div>

      {/* General introductory overview comments from Gemini rendered inside Summary Card style */}
      {sections.general && (
        <div id="output_intro_box" className="bg-indigo-600/10 border border-indigo-500/30 rounded-xl p-5 text-indigo-300 text-xs leading-relaxed font-sans">
          <strong>Review Executive Snapshot:</strong>
          <div className="mt-1">
            {sections.general}
          </div>
        </div>
      )}

      {/* 1. CRITICAL BUGS SECTION (Red Accent Border) */}
      <div
        id="critical_bugs_card"
        className="bg-[#202124] border-l-4 border-red-500 rounded-r-xl p-5 shadow-lg transition-transform hover:-translate-y-0.5"
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🚨</span>
          <h3 id="critical_bugs_heading" className="font-bold text-red-400 uppercase tracking-tight text-sm">
            Critical Bugs & Memory Leaks
          </h3>
        </div>
        <div id="critical_bugs_content" className="pl-6 text-sm text-gray-300">
          <RenderMarkdown text={sections.critical} />
        </div>
      </div>

      {/* 2. PERFORMANCE SECTION (Yellow/Amber Accent Border) */}
      <div
        id="performance_card"
        className="bg-[#202124] border-l-4 border-yellow-500 rounded-r-xl p-5 shadow-lg transition-transform hover:-translate-y-0.5"
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">⚡</span>
          <h3 id="performance_heading" className="font-bold text-yellow-400 uppercase tracking-tight text-sm">
            Latency & Optimization Targets
          </h3>
        </div>
        <div id="performance_content" className="pl-6 text-sm text-gray-300">
          <RenderMarkdown text={sections.performance} />
        </div>
      </div>

      {/* 3. CLEAN CODE & ARCHITECTURE (Green Accent Border) */}
      <div
        id="cleancode_card"
        className="bg-[#202124] border-l-4 border-green-500 rounded-r-xl p-5 shadow-lg transition-transform hover:-translate-y-0.5"
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🔒</span>
          <h3 id="cleancode_heading" className="font-bold text-green-400 uppercase tracking-tight text-sm">
            Modern Best Practices & Style
          </h3>
        </div>
        <div id="cleancode_content" className="pl-6 text-sm text-gray-300">
          <RenderMarkdown text={sections.cleanCode} />
        </div>
      </div>
    </div>
  );
}
