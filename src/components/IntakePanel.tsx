import React, { useState, useRef } from 'react';
import { Terminal, Image, Link2, Upload, Sparkles, Loader2, AlertCircle } from 'lucide-react';

interface IntakePanelProps {
  onStartReview: (type: 'text' | 'image' | 'link', data: string) => Promise<void>;
  isLoading: boolean;
}

export default function IntakePanel({ onStartReview, isLoading }: IntakePanelProps) {
  const [activeTab, setActiveTab] = useState<'text' | 'image' | 'link'>('text');
  
  // Tab states
  const [codeSnippet, setCodeSnippet] = useState<string>('');
  const [urlLink, setUrlLink] = useState<string>('');
  const [imageBase64, setImageBase64] = useState<string>('');
  const [imageFileName, setImageFileName] = useState<string>('');
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTabChange = (tab: 'text' | 'image' | 'link') => {
    setActiveTab(tab);
    setErrorMsg('');
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select an image file (PNG, JPG, webp) representing your code screenshot.');
      return;
    }
    
    // Size check - 10MB
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('File size is too large. Image size must be under 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImageBase64(reader.result as string);
      setImageFileName(file.name);
      setErrorMsg('');
    };
    reader.onerror = () => {
      setErrorMsg('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const selectFileManually = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    let requestData = '';
    
    if (activeTab === 'text') {
      if (!codeSnippet.trim()) {
        setErrorMsg('Please paste or write your code snippet before running review.');
        return;
      }
      requestData = codeSnippet;
    } else if (activeTab === 'image') {
      if (!imageBase64) {
        setErrorMsg('Please select or drop an image file of your code.');
        return;
      }
      requestData = imageBase64;
    } else if (activeTab === 'link') {
      if (!urlLink.trim()) {
        setErrorMsg('Please provide a link to the code script.');
        return;
      }
      if (!urlLink.startsWith('http://') && !urlLink.startsWith('https://')) {
        setErrorMsg('Please enter a valid URL starting with http:// or https://');
        return;
      }
      requestData = urlLink.trim();
    }

    try {
      await onStartReview(activeTab, requestData);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during code analysis.');
    }
  };

  return (
    <div id="intake_panel_container" className="rounded-2xl bg-[#202124] border border-gray-800 shadow-2xl overflow-hidden text-gray-200">
      {/* Tab Navigation header */}
      <div id="tabs_header" className="flex border-b border-gray-800">
        <button
          id="tab_button_text"
          type="button"
          onClick={() => handleTabChange('text')}
          className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-all ${
            activeTab === 'text'
              ? 'border-b-2 border-indigo-500 bg-gray-800/40 text-white font-semibold'
              : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/10'
          }`}
        >
          <Terminal size={15} />
          <span>Paste Snippet</span>
        </button>
        <button
          id="tab_button_image"
          type="button"
          onClick={() => handleTabChange('image')}
          className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-all ${
            activeTab === 'image'
              ? 'border-b-2 border-indigo-500 bg-gray-800/40 text-white font-semibold'
              : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/10'
          }`}
        >
          <Image size={15} />
          <span>Upload Image</span>
        </button>
        <button
          id="tab_button_link"
          type="button"
          onClick={() => handleTabChange('link')}
          className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-all ${
            activeTab === 'link'
              ? 'border-b-2 border-indigo-500 bg-gray-800/40 text-white font-semibold'
              : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/10'
          }`}
        >
          <Link2 size={15} />
          <span>Share Link</span>
        </button>
      </div>

      <form id="intake_form" onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">
        
        {/* Dynamic Inner Panel View based on activeTab */}
        <div id="tab_content_area" className="min-h-[220px] flex flex-col justify-stretch">
          
          {activeTab === 'text' && (
            <div id="text_tab_view" className="flex flex-col flex-1 gap-2">
              <label htmlFor="code_textarea" className="text-xs text-gray-500 font-mono tracking-wider font-semibold">
                RAW SOURCE CODE INPUT:
              </label>
              <textarea
                id="code_textarea"
                value={codeSnippet}
                onChange={(e) => setCodeSnippet(e.target.value)}
                placeholder="/* Paste snippet or script to analyze (e.g. JavaScript, Python, C++, etc.) */&#10;function calculateMetrics(items) {&#10;  return items.map(x => x.price * 1.15);&#10;}"
                className="w-full flex-1 min-h-[190px] font-mono text-sm bg-[#121214] text-indigo-200 placeholder-gray-650 border border-gray-700 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 resize-y"
              />
            </div>
          )}

          {activeTab === 'image' && (
            <div id="image_tab_view" className="flex flex-col flex-1 gap-2">
              <label className="text-xs text-gray-500 font-mono tracking-wider font-semibold">
                SCREENSHOT OR WORKSPACE CAPTURE:
              </label>
              
              <div
                id="drop_zone"
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`flex-1 border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center transition-all cursor-pointer ${
                  dragActive 
                    ? 'border-indigo-500 bg-indigo-500/5' 
                    : 'border-gray-700 bg-[#121214] hover:border-gray-600'
                }`}
                onClick={selectFileManually}
              >
                <input
                  id="image_file_input"
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                
                {imageBase64 ? (
                  <div id="image_preview_container" className="flex flex-col items-center gap-3 w-full">
                    <img 
                      id="uploaded_preview"
                      src={imageBase64} 
                      alt="Uploaded code snippet" 
                      className="max-h-[140px] rounded border border-gray-800 object-contain shadow-md"
                    />
                    <div id="image_file_meta" className="text-center">
                      <p className="text-indigo-400 text-sm font-medium line-clamp-1">{imageFileName || 'Code-Screenshot.png'}</p>
                      <button 
                        id="clear_image_button"
                        type="button" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setImageBase64('');
                          setImageFileName('');
                        }}
                        className="text-xs text-red-400 hover:text-red-300 hover:underline mt-1"
                      >
                        Remove Image
                      </button>
                    </div>
                  </div>
                ) : (
                  <div id="drag_prompt" className="flex flex-col items-center text-center gap-3">
                    <div id="upload_icon_ring" className="w-12 h-12 rounded-full bg-gray-800/30 border border-gray-700 flex items-center justify-center text-gray-400">
                      <Upload size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-300">Drag & drop screenshot here</p>
                      <p className="text-xs text-gray-500 mt-1">or click to browse local files</p>
                    </div>
                    <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest bg-[#18181b] px-3 py-1 rounded-full border border-gray-750 mt-2">
                      PNG, JPG, WEBP • Max 10MB
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'link' && (
            <div id="link_tab_view" className="flex flex-col flex-1 gap-2 justify-center">
              <label htmlFor="url_input" className="text-xs text-gray-500 font-mono tracking-wider font-semibold">
                WEBSITE LINK OR RAW SCRIPT SOURCE ACCESSIBLE ENDPOINT:
              </label>
              <div id="url_input_wrapper" className="flex items-center bg-[#121214] border border-gray-700 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500 transition-all">
                <Link2 className="text-gray-500 mr-3" size={18} />
                <input
                  id="url_input"
                  type="url"
                  value={urlLink}
                  onChange={(e) => setUrlLink(e.target.value)}
                  placeholder="https://raw.githubusercontent.com/user/project/main/src/utils.js"
                  className="w-full bg-transparent border-none text-indigo-300 placeholder-gray-600 text-sm focus:outline-none"
                />
              </div>
              <p className="text-xs text-gray-500 leading-relaxed max-w-xl">
                We will fetch this raw script format using our server-side proxy router to securely parse the script instructions directly.
              </p>
            </div>
          )}

        </div>

        {/* Display inline alerts/errors */}
        {errorMsg && (
          <div id="intake_error_alert" className="flex items-start gap-2 text-rose-400 text-sm bg-rose-500/5 border border-rose-500/20 rounded-xl p-3.5 animation-fade-in">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Action Button */}
        <button
          id="trigger_review_btn"
          type="submit"
          disabled={isLoading}
          className={`w-full py-4 px-6 rounded-xl font-bold flex items-center justify-center gap-2.5 transition-all text-sm shadow-lg tracking-wider ${
            isLoading 
              ? 'bg-indigo-600/20 text-indigo-400 cursor-not-allowed border border-indigo-500/20' 
              : 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-[0.98] font-semibold border border-transparent'
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin text-indigo-400" size={18} />
              <span>LAUNCHING GENAI DEEP ANALYSIS...</span>
            </>
          ) : (
            <>
              <Sparkles size={18} />
              <span>ANALYZE CODEBASE</span>
            </>
          )}
        </button>

      </form>
    </div>
  );
}
