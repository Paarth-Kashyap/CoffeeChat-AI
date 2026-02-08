
import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, Contact, OutreachResult } from './types';
import { GeminiService } from './services/geminiService';
import * as pdfjsLib from 'pdfjs-dist';
import { 
  ClipboardDocumentIcon, 
  ArrowUpTrayIcon, 
  CheckCircleIcon,
  ExclamationCircleIcon,
  EnvelopeIcon,
  SparklesIcon,
  DocumentTextIcon,
  BriefcaseIcon,
  ChatBubbleLeftRightIcon,
  AcademicCapIcon,
  StopCircleIcon,
  PaperClipIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

const LOCAL_STORAGE_KEY = 'coffeechat_user_profile_paarth_v8';

const App: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile & { senderEmail: string, resumeFileName?: string }>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) return JSON.parse(saved);

  return {
      userName: (import.meta as any).env.VITE_USER_NAME || '',
      senderEmail: (import.meta as any).env.VITE_SENDER_EMAIL || '',
      education: (import.meta as any).env.VITE_EDUCATION || '',
      currentRole: (import.meta as any).env.VITE_CURRENT_ROLE || '',
      targetRole: (import.meta as any).env.VITE_TARGET_ROLE || '',
      targetTerm: (import.meta as any).env.VITE_TARGET_TERM || '',
      resumeText: '',
      resumeFileName: '', 
      philosophy: (import.meta as any).env.VITE_PHILOSOPHY || '',
      interests: (import.meta as any).env.VITE_INTERESTS || '',
      keyAchievements: (import.meta as any).env.VITE_KEY_ACHIEVEMENTS || '',
      experienceContext: (import.meta as any).env.VITE_EXPERIENCE_CONTEXT || '',
      customTailoringInstructions: (import.meta as any).env.VITE_CUSTOM_TAILORING_INSTRUCTIONS || '',
      customRules: (import.meta as any).env.VITE_CUSTOM_RULES || '',
    };
  });

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [results, setResults] = useState<OutreachResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'setup' | 'results'>('setup');
  const [haltedByQuota, setHaltedByQuota] = useState(false);
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  
  // Ref to track if the user requested a stop
  const stopRequestedRef = useRef(false);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profile));
  }, [profile]);

  const extractTextFromPdf = async (data: ArrayBuffer): Promise<string> => {
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map((item: any) => item.str);
      fullText += strings.join(' ') + '\n';
    }
    return fullText;
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === 'application/pdf') {
      setIsParsingPdf(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const text = await extractTextFromPdf(arrayBuffer);
        setProfile(prev => ({ 
          ...prev, 
          resumeText: text, 
          resumeFileName: file.name 
        }));
      } catch (err) {
        console.error("PDF Parsing error:", err);
        alert("Failed to parse PDF. Please try a different file or paste the text manually.");
      } finally {
        setIsParsingPdf(false);
      }
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setProfile(prev => ({ 
          ...prev, 
          resumeText: text, 
          resumeFileName: file.name 
        }));
      };
      reader.readAsText(file);
    }
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const rows = text.split('\n');
      const parsedContacts: Contact[] = rows
        .map(row => row.trim())
        .filter(row => row.includes('@'))
        .map(email => ({ email: email.split(',')[0].trim() }));
      setContacts(parsedContacts);
    };
    reader.readAsText(file);
  };

  const stopGeneration = () => {
    stopRequestedRef.current = true;
    setIsProcessing(false);
  };

  const processAll = async () => {
    if (contacts.length === 0) {
      alert("Please upload a CSV with emails first.");
      return;
    }
    if (!profile.resumeText || !profile.userName) {
      alert("Please ensure your name and resume are provided in the Profile section.");
      return;
    }

    setIsProcessing(true);
    setHaltedByQuota(false);
    stopRequestedRef.current = false;
    setActiveTab('results');
    setResults([]);

    const service = new GeminiService();
    
    for (const contact of contacts) {
      // Check if user clicked Stop
      if (stopRequestedRef.current) {
        setIsProcessing(false);
        return;
      }

      setResults(prev => [...prev, {
        email: contact.email,
        companyName: '...',
        research: '',
        draftedEmail: '',
        sources: [],
        status: 'processing'
      }]);

      const result = await service.processOutreach(contact.email, profile);
      
      setResults(prev => {
        const newResults = [...prev];
        const index = newResults.findIndex(r => r.email === contact.email);
        if (index !== -1) newResults[index] = result;
        return newResults;
      });

      if (result.error?.includes("QUOTA_EXCEEDED")) {
        setHaltedByQuota(true);
        setIsProcessing(false);
        return;
      }
    }
    setIsProcessing(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Draft copied to clipboard!");
  };

  const openInMail = (result: OutreachResult) => {
    const subject = encodeURIComponent("Summer 2026 Internship & Coffee Chat Request");
    const body = encodeURIComponent(result.draftedEmail);
    // Since we cannot automate attachments via mailto, we notify the user.
    alert("Draft opened! Please remember to manually attach your resume PDF in the email client.");
    window.location.href = `mailto:${result.email}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <header className="mb-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-gray-900 mb-2 flex items-center gap-3 tracking-tighter">
            <div className="bg-indigo-600 p-2 rounded-xl">
              <SparklesIcon className="w-8 h-8 text-white" />
            </div>
            CoffeeChat AI
          </h1>
          <p className="text-gray-500 font-medium">University of Toronto Engineering Builder Outreach</p>
        </div>
        <div className="flex bg-white rounded-xl shadow-sm border border-gray-200 p-1">
          <button
            onClick={() => setActiveTab('setup')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'setup' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            1. My Profile
          </button>
          <button
            onClick={() => setActiveTab('results')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'results' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            2. Drafting ({results.length})
          </button>
        </div>
      </header>

      {activeTab === 'setup' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
              <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
                <AcademicCapIcon className="w-6 h-6 text-indigo-600" />
                University of Toronto Context
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Full Name</label>
                    <input
                      type="text"
                      className="w-full bg-gray-50 border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 border p-3 text-gray-900"
                      value={profile.userName}
                      onChange={e => setProfile({...profile, userName: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Sender Email</label>
                    <input
                      type="email"
                      className="w-full bg-gray-50 border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 border p-3 text-gray-900 font-mono"
                      value={profile.senderEmail}
                      onChange={e => setProfile({...profile, senderEmail: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Interests</label>
                    <input
                      type="text"
                      className="w-full bg-gray-50 border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 border p-3 text-gray-900"
                      value={profile.interests}
                      onChange={e => setProfile({...profile, interests: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Experience Highlights</label>
                    <input
                      type="text"
                      className="w-full bg-gray-50 border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 border p-3 text-gray-900"
                      value={profile.keyAchievements}
                      onChange={e => setProfile({...profile, keyAchievements: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-indigo-50 p-8 rounded-2xl shadow-sm border border-indigo-100">
              <h2 className="text-xl font-black text-indigo-900 mb-4 flex items-center gap-2">
                <ChatBubbleLeftRightIcon className="w-6 h-6 text-indigo-600" />
                Drafting constraints
              </h2>
              <textarea
                rows={4}
                className="w-full bg-white border-indigo-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 border p-4 text-gray-900 text-sm shadow-sm"
                value={profile.customTailoringInstructions}
                onChange={e => setProfile({...profile, customTailoringInstructions: e.target.value})}
              />
              <p className="mt-2 text-[10px] font-bold text-indigo-400 uppercase">3 Sentence Max | No Em-Dashes | Truthful AI Analysis</p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                    <DocumentTextIcon className="w-6 h-6 text-indigo-600" />
                    Resume Upload
                  </h2>
                  {profile.resumeFileName && (
                    <p className="text-xs font-bold text-green-600 mt-1 flex items-center gap-1">
                      <PaperClipIcon className="w-3 h-3" />
                      Loaded: {profile.resumeFileName}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept=".pdf,.txt,.md"
                    onChange={handleResumeUpload}
                    className="hidden"
                    id="resume-upload"
                  />
                  <label htmlFor="resume-upload" className={`cursor-pointer px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                    isParsingPdf ? 'bg-gray-200 text-gray-400 cursor-wait' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}>
                    {isParsingPdf ? 'Reading PDF...' : (
                      <>
                        <ArrowUpTrayIcon className="w-4 h-4" />
                        Upload PDF / TXT
                      </>
                    )}
                  </label>
                </div>
              </div>
              <textarea
                rows={12}
                className="w-full bg-gray-50 border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 border p-4 text-gray-700 text-sm font-mono leading-relaxed"
                placeholder="Resume text extracted from your PDF will appear here..."
                value={profile.resumeText}
                onChange={e => setProfile({...profile, resumeText: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-indigo-900 p-8 rounded-3xl shadow-2xl text-white">
              <h2 className="text-xl font-black mb-6 flex items-center gap-2">
                <BriefcaseIcon className="w-6 h-6 text-indigo-300" />
                Targets List
              </h2>
              <div 
                className="border-2 border-dashed border-indigo-700 rounded-2xl p-8 text-center hover:bg-indigo-800 transition-all cursor-pointer group"
                onClick={() => document.getElementById('csv-upload')?.click()}
              >
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleCsvUpload}
                  className="hidden"
                  id="csv-upload"
                />
                <ArrowUpTrayIcon className="w-10 h-10 text-indigo-300 mx-auto mb-4 group-hover:scale-110 transition-transform" />
                <p className="text-sm font-bold mb-1">Batch Upload</p>
                <p className="text-xs text-indigo-400 font-medium">CSV/TXT list of emails</p>
              </div>

              {contacts.length > 0 && (
                <div className="mt-6 space-y-2">
                  <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
                    Queue ({contacts.length})
                  </p>
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-2 scrollbar-thin scrollbar-thumb-indigo-700">
                    {contacts.map((c, i) => (
                      <div key={i} className="text-xs bg-indigo-800/50 px-3 py-2 rounded-lg flex justify-between">
                        <span className="truncate opacity-80">{c.email}</span>
                        <CheckCircleIcon className="w-3 h-3 text-indigo-400" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-8 flex flex-col gap-3">
                <button
                  onClick={processAll}
                  disabled={isProcessing || contacts.length === 0}
                  className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${
                    isProcessing || contacts.length === 0
                    ? 'bg-indigo-800 text-indigo-600 cursor-not-allowed'
                    : 'bg-white text-indigo-900 hover:scale-[1.02] active:scale-[0.98] shadow-xl'
                  }`}
                >
                  {isProcessing ? 'AI Thinking...' : 'Automate Drafting'}
                </button>
                
                {isProcessing && (
                  <button
                    onClick={stopGeneration}
                    className="w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest bg-red-600 text-white hover:bg-red-700 flex items-center justify-center gap-2 transition-all shadow-lg animate-pulse"
                  >
                    <XCircleIcon className="w-5 h-5" />
                    Stop Generation
                  </button>
                )}
              </div>
            </div>
            
            <div className="bg-gray-100 p-6 rounded-2xl border border-gray-200">
              <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Professional Rules</h4>
              <ul className="text-[11px] text-gray-600 space-y-3 font-medium">
                <li className="flex gap-2">
                  <span className="text-indigo-600 font-bold shrink-0">Identity</span>
                  University of Toronto Engineering
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-600 font-bold shrink-0">BMO Rule</span>
                  Always BMO Capital Markets.
                </li>
                <li className="flex gap-2 text-indigo-700">
                  <span className="font-bold shrink-0">!</span>
                  Manual attachment required.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'results' && (
        <div className="space-y-6 max-w-5xl mx-auto">
          {haltedByQuota && (
            <div className="bg-amber-50 border border-amber-200 p-6 rounded-3xl flex items-center gap-4 text-amber-900">
              <StopCircleIcon className="w-8 h-8 shrink-0 text-amber-500" />
              <div>
                <p className="font-black text-lg">Automation Paused</p>
                <p className="text-sm">API quota exceeded. The remaining batch was preserved to avoid data loss.</p>
              </div>
            </div>
          )}

          {results.length === 0 && !isProcessing && (
            <div className="bg-white p-20 text-center rounded-3xl border border-gray-100 shadow-sm">
              <EnvelopeIcon className="w-20 h-20 text-gray-100 mx-auto mb-6" />
              <h3 className="text-2xl font-black text-gray-900">No drafts yet</h3>
              <p className="text-gray-500 mt-2">Upload your targets in the setup tab to start.</p>
            </div>
          )}

          <div className="flex justify-between items-center px-4">
            <h2 className="text-2xl font-black text-gray-900">Research Results</h2>
            {isProcessing && (
              <button
                onClick={stopGeneration}
                className="px-6 py-2 bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-700 flex items-center gap-2 shadow-lg"
              >
                <XCircleIcon className="w-4 h-4" />
                Stop
              </button>
            )}
          </div>

          {results.map((result, idx) => (
            <div key={idx} className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-md">
              <div className="px-8 py-5 bg-gray-50/50 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-4 h-4 rounded-full shadow-inner ${
                    result.status === 'completed' ? 'bg-green-500' :
                    result.status === 'error' ? 'bg-red-500' :
                    'bg-indigo-500 animate-pulse'
                  }`} />
                  <div>
                    <h3 className="text-lg font-black text-gray-900">{result.companyName}</h3>
                    <p className="text-gray-400 text-xs font-bold tracking-tight italic">{result.email}</p>
                  </div>
                </div>
                {result.status === 'completed' && (
                  <div className="flex gap-2 w-full md:w-auto">
                    <button 
                      onClick={() => copyToClipboard(result.draftedEmail)}
                      className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <ClipboardDocumentIcon className="w-4 h-4" />
                      Copy Draft
                    </button>
                    <button 
                      onClick={() => openInMail(result)}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                    >
                      <EnvelopeIcon className="w-4 h-4" />
                      Open Mail
                    </button>
                  </div>
                )}
              </div>

              <div className="p-8">
                {result.status === 'processing' && (
                  <div className="py-12 flex flex-col items-center">
                    <div className="relative w-16 h-16 mb-6">
                      <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <p className="text-gray-900 font-black tracking-tight">AI is researching {result.email.split('@')[1]}...</p>
                    <p className="text-gray-400 text-xs mt-1 font-medium italic">Scraping University of Toronto Engineering context...</p>
                  </div>
                )}

                {result.status === 'error' && (
                  <div className="bg-red-50 p-6 rounded-2xl flex gap-4 text-red-700 border border-red-100">
                    <ExclamationCircleIcon className="w-6 h-6 shrink-0" />
                    <div>
                      <p className="font-black mb-1">Outreach Failed</p>
                      <p className="text-sm opacity-80">{result.error}</p>
                    </div>
                  </div>
                )}

                {result.status === 'completed' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                          <CheckCircleIcon className="w-4 h-4 text-green-500" />
                          Strategic Context
                        </h4>
                        <div className="text-sm text-gray-700 bg-gray-50 p-6 rounded-2xl border border-gray-100 max-h-[400px] overflow-y-auto leading-relaxed whitespace-pre-wrap">
                          {result.research}
                        </div>
                      </div>
                      
                      {result.sources.length > 0 && (
                        <div>
                          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Live Sources</h4>
                          <div className="flex flex-wrap gap-2">
                            {result.sources.map((source, sidx) => (
                              <a 
                                key={sidx}
                                href={source.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] font-bold bg-white border border-gray-100 text-gray-500 px-3 py-1.5 rounded-full hover:border-indigo-200 hover:text-indigo-600 transition-all truncate max-w-[240px]"
                              >
                                {source.title || source.uri}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-6">
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <EnvelopeIcon className="w-4 h-4 text-indigo-500" />
                        Final Email Draft
                      </h4>
                      <div className="bg-indigo-50/40 p-8 rounded-3xl border border-indigo-100/50 text-gray-900 text-sm leading-relaxed font-serif italic shadow-inner">
                        {result.draftedEmail}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-400 font-bold bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <span className="flex items-center gap-1"><SparklesIcon className="w-3 h-3 text-indigo-400" /> University of Toronto</span>
                        <span className="opacity-30">|</span>
                        <span>Summer 2026 Context</span>
                        <span className="opacity-30">|</span>
                        <span>BMO Compliant</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default App;
