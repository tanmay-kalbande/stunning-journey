// src/components/BookView.tsx
import React, { useEffect, ReactNode, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Book, Download, Trash2, Clock, CheckCircle, AlertCircle, Loader2,
  Brain, Sparkles, BarChart3, ListChecks, Play, Box, ArrowLeft, Check,
  BookText, RefreshCw, Edit, Save, X, FileText, List, Settings, Moon,
  ZoomIn, ZoomOut, BookOpen, BookmarkCheck, Copy, AlertTriangle,
  CheckCircle2, Pause, Zap, Sun, Palette, Bookmark, ChevronDown,
  Search, Code, Music, Heart, Cpu, TrendingUp, Eye, Coins, Utensils,
  MessageCircle, Users, GraduationCap, Atom, Target, Briefcase, Crown,
} from 'lucide-react';
import { APISettings } from '../types';
import { BookProject, BookSession, ReadingBookmark } from '../types/book';
import { bookService } from '../services/bookService';
import { BookAnalytics } from './BookAnalytics';
import { CustomSelect } from './CustomSelect';
import { pdfService } from '../services/pdfService';
import { readingProgressUtils } from '../utils/readingProgress';

// ============================================================================
// TYPES
// ============================================================================
type AppView = 'list' | 'create' | 'detail';

interface GenerationStatus {
  currentModule?: { id: string; title: string; attempt: number; progress: number; generatedText?: string; };
  totalProgress: number;
  status: 'idle' | 'generating' | 'completed' | 'error' | 'paused' | 'waiting_retry';
  logMessage?: string;
  totalWordsGenerated?: number;
  aiStage?: 'analyzing' | 'writing' | 'examples' | 'polishing' | 'complete';
  retryInfo?: { moduleTitle: string; error: string; retryCount: number; maxRetries: number; waitTime?: number; };
}

interface GenerationStats {
  startTime: Date;
  totalModules: number;
  completedModules: number;
  failedModules: number;
  averageTimePerModule: number;
  estimatedTimeRemaining: number;
  totalWordsGenerated: number;
  wordsPerMinute: number;
}

interface BookViewProps {
  books: BookProject[];
  currentBookId: string | null;
  onCreateBookRoadmap: (session: BookSession) => Promise<void>;
  onGenerateAllModules: (book: BookProject, session: BookSession) => Promise<void>;
  onRetryFailedModules: (book: BookProject, session: BookSession) => Promise<void>;
  onAssembleBook: (book: BookProject, session: BookSession) => Promise<void>;
  onSelectBook: (id: string | null) => void;
  onDeleteBook: (id: string) => void;
  onUpdateBookStatus: (id: string, status: BookProject['status']) => void;
  hasApiKey: boolean;
  view: AppView;
  setView: React.Dispatch<React.SetStateAction<AppView>>;
  onUpdateBookContent: (bookId: string, newContent: string) => void;
  showListInMain: boolean;
  setShowListInMain: React.Dispatch<React.SetStateAction<boolean>>;
  isMobile?: boolean;
  generationStatus?: GenerationStatus;
  generationStats?: GenerationStats;
  onPauseGeneration?: (bookId: string) => void;
  onResumeGeneration?: (book: BookProject, session: BookSession) => void;
  isGenerating?: boolean;
  onRetryDecision?: (decision: 'retry' | 'switch' | 'skip') => void;
  availableModels?: Array<{ provider: string; model: string; name: string }>;
  theme: 'light' | 'dark';
  onOpenSettings: () => void;
  showAlertDialog: (props: {
    type: 'info' | 'warning' | 'error' | 'success' | 'confirm';
    title: string;
    message: string | React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
  }) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  onReadingModeChange?: (isReading: boolean) => void;
  settings: APISettings;
}

interface ReadingModeProps {
  content: string;
  isEditing: boolean;
  editedContent: string;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onContentChange: (content: string) => void;
  onGoBack: () => void;
  theme: 'light' | 'dark';
  bookId: string;
  currentModuleIndex: number;
}

interface ReadingSettings {
  fontSize: number;
  lineHeight: number;
  fontFamily: 'nunito' | 'mono' | 'crimson' | 'rubik';
  theme: 'dark' | 'sepia' | 'light';
  maxWidth: 'narrow' | 'medium' | 'wide';
  textAlign: 'left' | 'justify';
}

// ============================================================================
// CONSTANTS
// ============================================================================
const THEMES = {
  dark:  { bg: '#0F0F0F', contentBg: '#1A1A1A', text: '#E5E5E5', secondary: '#A0A0A0', border: '#333333', accent: '#6B7280' },
  sepia: { bg: '#F5F1E8', contentBg: '#FAF7F0', text: '#3C2A1E', secondary: '#8B7355', border: '#D4C4A8', accent: '#B45309' },
  light: { bg: '#FFFFFF', contentBg: '#F9F9F9', text: '#1A1A1A', secondary: '#555555', border: '#E0E0E0', accent: '#3B82F6' },
};
const FONT_FAMILIES = {
  mono:   'ui-monospace, "SF Mono", "Monaco", "Cascadia Code", monospace',
  nunito: "'Nunito', 'Segoe UI', sans-serif",
  crimson: "'Crimson Pro', serif",
  rubik:  "'Outfit', sans-serif",
};
const FONT_LABELS = { rubik: 'Rubik', nunito: 'Smooth', crimson: 'Book', mono: 'Code' };
const MAX_WIDTHS  = { narrow: '65ch', medium: '75ch', wide: '85ch' };

// ============================================================================
// UTILS
// ============================================================================
const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 1) return '--';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
};

const getContextualIcon = (title: string): React.ElementType => {
  const t = title.toLowerCase();
  if (t.includes('code') || t.includes('program') || t.includes('software')) return Code;
  if (t.includes('ai') || t.includes('machine') || t.includes('neural'))    return Brain;
  if (t.includes('data') || t.includes('analytics'))                          return TrendingUp;
  if (t.includes('music') || t.includes('song'))                              return Music;
  if (t.includes('art') || t.includes('design'))                              return Palette;
  if (t.includes('health') || t.includes('fitness'))                          return Heart;
  if (t.includes('money') || t.includes('finance'))                           return Coins;
  if (t.includes('food') || t.includes('nutrition'))                          return Utensils;
  if (t.includes('leader') || t.includes('team'))                             return Users;
  if (t.includes('learn') || t.includes('study'))                             return GraduationCap;
  if (t.includes('science') || t.includes('physics'))                         return Atom;
  if (t.includes('habit') || t.includes('goal'))                              return Target;
  if (t.includes('career') || t.includes('job'))                              return Briefcase;
  return Sparkles;
};

const getBookCoverTone = (title: string) => {
  const t = title.toLowerCase();
  if (t.includes('finance') || t.includes('money'))  return 'from-emerald-400/45 via-cyan-400/20 to-transparent';
  if (t.includes('ai') || t.includes('code'))        return 'from-orange-400/45 via-amber-300/25 to-transparent';
  if (t.includes('health') || t.includes('life'))    return 'from-rose-400/40 via-orange-300/20 to-transparent';
  return 'from-blue-400/35 via-violet-300/20 to-transparent';
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================
const GradientProgressBar = ({ progress = 0, active = true }: { progress?: number; active?: boolean }) => (
  <div className="relative w-full h-2.5 bg-[var(--color-card)] rounded-full overflow-hidden border border-[var(--color-border)]">
    <div
      className="absolute inset-0 bg-gradient-to-r from-gray-500 via-gray-400 to-gray-500 transition-all duration-700 ease-out"
      style={{ width: `${progress}%`, backgroundSize: '200% 100%', animation: active ? 'gradient-flow 3s ease infinite' : 'none' }}
    />
  </div>
);

const StatusLoader = () => (
  <div className="status-loader">
    {Array.from({ length: 9 }).map((_, i) => <div key={i} className="status-loader-dot" />)}
  </div>
);

const AIWaveAnimation = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pixels, setPixels] = useState<Array<{ id: number; color: string; opacity: string }>>([]);

  useEffect(() => {
    const colors = [
      'bg-orange-500', 'bg-orange-400', 'bg-amber-500',
      'bg-amber-400', 'bg-orange-600', 'bg-amber-600',
      'bg-gray-500', 'bg-gray-600',
    ];
    const generatePixels = () => {
      if (!containerRef.current) return;
      const pixelSize = 10, gap = 4, pixelSpace = pixelSize + gap;
      const numCols = Math.floor(containerRef.current.offsetWidth / pixelSpace);
      const numRows = Math.floor(containerRef.current.offsetHeight / pixelSpace);
      const total   = numCols * numRows;
      if (total > 0) {
        setPixels(Array(total).fill(0).map((_, i) => ({
          id: i,
          color: colors[Math.floor(Math.random() * colors.length)],
          opacity: Math.random() > 0.4 ? 'opacity-100' : 'opacity-40',
        })));
      }
    };
    const observer = new ResizeObserver(generatePixels);
    if (containerRef.current) observer.observe(containerRef.current);
    const interval = setInterval(generatePixels, 200);
    return () => { clearInterval(interval); observer.disconnect(); };
  }, []);

  return (
    <div ref={containerRef} className="flex flex-wrap content-start gap-1 w-full h-10 pl-1 overflow-hidden rounded-lg">
      {pixels.map(p => <div key={p.id} className={`w-2.5 h-2.5 rounded-sm ${p.color} ${p.opacity} transition-all duration-150`} />)}
    </div>
  );
};

const RetryDecisionPanel = ({
  retryInfo, onRetry, onSwitchModel, onSkip, availableModels,
}: {
  retryInfo: { moduleTitle: string; error: string; retryCount: number; maxRetries: number; waitTime?: number; };
  onRetry: () => void;
  onSwitchModel: () => void;
  onSkip: () => void;
  availableModels: Array<{ provider: string; model: string; name: string }>;
}) => {
  const [countdown, setCountdown] = useState(Math.ceil((retryInfo.waitTime || 0) / 1000));

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const isRateLimit = retryInfo.error.toLowerCase().includes('rate limit') || retryInfo.error.includes('429');

  return (
    <div className="bg-red-900/20 backdrop-blur-xl border border-red-500/50 rounded-xl overflow-hidden animate-fade-in-up">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 flex items-center justify-center bg-red-500/20 rounded-lg border border-red-500/30">
            <AlertCircle className="w-6 h-6 text-red-400 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Generation Failed</h3>
            <p className="text-sm text-[var(--color-text-secondary)]">Attempt {retryInfo.retryCount} of {retryInfo.maxRetries}</p>
          </div>
        </div>
        <div className="mb-4 p-4 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg">
          <h4 className="font-medium text-[var(--color-text-primary)] mb-2">{retryInfo.moduleTitle}</h4>
          <p className="text-sm text-[var(--color-text-secondary)]"><span className="text-red-400 font-medium">Error:</span> {retryInfo.error}</p>
        </div>
        <div className="space-y-3">
          <button
            onClick={onRetry}
            disabled={countdown > 0}
            className="w-full btn bg-green-600 hover:bg-green-700 disabled:bg-[var(--color-card)] disabled:text-[var(--color-text-secondary)] disabled:cursor-not-allowed rounded-lg text-white font-semibold py-3 transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            {countdown > 0 ? `Retry in ${countdown}s` : 'Retry Same Model'}
          </button>
          {availableModels.length > 0 && (
            <button onClick={onSwitchModel} className="w-full btn bg-gray-700 hover:bg-gray-800 rounded-lg text-white font-semibold py-3 flex items-center justify-center gap-2">
              <Settings className="w-4 h-4" /> Switch AI Model
            </button>
          )}
          <button onClick={onSkip} className="w-full btn border border-[var(--color-border)] hover:bg-[var(--color-card)] rounded-lg text-[var(--color-text-secondary)] font-medium py-3 transition-all hover:text-red-400 flex items-center justify-center gap-2">
            <X className="w-4 h-4" /> Skip This Module
          </button>
        </div>
      </div>
    </div>
  );
};

const EmbeddedProgressPanel = ({
  generationStatus, stats, onCancel, onPause, onResume, onRetryDecision, availableModels, bookTitle,
}: {
  generationStatus: GenerationStatus;
  stats: GenerationStats;
  onCancel?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onRetryDecision?: (decision: 'retry' | 'switch' | 'skip') => void;
  availableModels?: Array<{ provider: string; model: string; name: string }>;
  bookTitle?: string;
}) => {
  const ContextIcon    = bookTitle ? getContextualIcon(bookTitle) : Sparkles;
  const streamBoxRef   = useRef<HTMLDivElement>(null);
  const isPaused       = generationStatus.status === 'paused';
  const isGenerating   = generationStatus.status === 'generating';
  const isWaitingRetry = generationStatus.status === 'waiting_retry';
  const overallProgress = (stats.completedModules / (stats.totalModules || 1)) * 100;

  useEffect(() => {
    if (streamBoxRef.current && generationStatus.currentModule?.generatedText) {
      streamBoxRef.current.scrollTop = streamBoxRef.current.scrollHeight;
    }
  }, [generationStatus.currentModule?.generatedText]);

  if (isWaitingRetry && generationStatus.retryInfo && onRetryDecision) {
    return (
      <RetryDecisionPanel
        retryInfo={generationStatus.retryInfo}
        onRetry={() => onRetryDecision('retry')}
        onSwitchModel={() => onRetryDecision('switch')}
        onSkip={() => onRetryDecision('skip')}
        availableModels={availableModels || []}
      />
    );
  }

  return (
    <div className={`overflow-hidden rounded-[28px] border backdrop-blur-xl animate-fade-in-up ${isPaused ? 'border-slate-500/50 bg-slate-500/[0.05]' : 'border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))]'}`}>
      <div className="p-6 md:p-7">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-3">
            {isPaused ? (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-500/30 bg-slate-500/20">
                <Pause className="w-6 h-6 text-slate-400" />
              </div>
            ) : (
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/20 to-emerald-500/20">
                <div className="absolute inset-0 rounded-2xl bg-cyan-400/10 blur-md" />
                <ContextIcon className="w-6 h-6 text-cyan-400 animate-pulse" />
              </div>
            )}
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.22em] text-orange-200/70">In Progress</p>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] md:text-xl">
                {isPaused ? 'Generation Paused' : 'Generating Chapters…'}
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)]">{stats.completedModules} of {stats.totalModules} complete</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className={`px-3 py-1.5 border rounded-full text-xs font-semibold ${isPaused ? 'bg-slate-500/20 border-slate-500/30 text-slate-300' : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'}`}>
              {Math.round(overallProgress)}%
            </div>
            <div className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-sm font-mono text-[var(--color-text-secondary)]">
              {stats.totalWordsGenerated.toLocaleString()} words
            </div>
          </div>
        </div>

        <div className="mb-4 rounded-[22px] border border-white/[0.06] bg-black/20 p-4">
          <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
            <span>Book Build Progress</span>
            <span>{stats.completedModules}/{stats.totalModules}</span>
          </div>
          <GradientProgressBar progress={overallProgress} active={isGenerating} />
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
              {stats.wordsPerMinute.toFixed(0)} wpm
            </span>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
              {formatTime(stats.estimatedTimeRemaining)} left
            </span>
          </div>
        </div>

        {isGenerating && generationStatus.currentModule && (
          <>
            <div className="mt-5 mb-4 rounded-[22px] border border-white/[0.06] bg-black/20 px-4 py-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-200/70">Live Drafting</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">{generationStatus.currentModule.title}</p>
                </div>
                <div className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300">
                  Attempt {generationStatus.currentModule.attempt}
                </div>
              </div>
              <AIWaveAnimation />
            </div>
            {generationStatus.currentModule.generatedText && (
              <div className="rounded-[22px] border border-white/[0.08] bg-white/[0.025] p-4">
                <h4 className="font-semibold text-[var(--color-text-primary)] flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  {generationStatus.currentModule.title}
                </h4>
                <div
                  ref={streamBoxRef}
                  className="streaming-text-box max-h-40 overflow-y-auto rounded-2xl border border-white/[0.06] bg-black/20 px-4 py-3 font-mono text-sm leading-relaxed text-[var(--color-text-secondary)]"
                >
                  {generationStatus.currentModule.generatedText}
                  <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-1" />
                </div>
              </div>
            )}
          </>
        )}

        <div className="mt-6 border-t border-[var(--color-border)] pt-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>{isPaused ? `Paused • ${stats.completedModules}/${stats.totalModules} done` : `${formatTime(stats.estimatedTimeRemaining)} remaining`}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {(isGenerating || isPaused) && onCancel && (
                <button onClick={onCancel} className="px-4 py-2 border border-[var(--color-border)] hover:bg-[var(--color-card)] rounded-lg text-sm font-medium transition-all hover:text-red-400">
                  <X className="w-4 h-4 inline mr-1.5" /> Cancel
                </button>
              )}
              {isPaused && onResume && (
                <button onClick={onResume} className="px-5 py-2.5 bg-green-600 hover:bg-green-700 rounded-lg text-white font-semibold flex items-center gap-2">
                  <Play className="w-4 h-4" /> Resume
                </button>
              )}
              {isGenerating && onPause && (
                <button onClick={onPause} className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/90 font-medium flex items-center gap-2">
                  <Pause className="w-4 h-4 opacity-70" /> Pause
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CodeBlock = React.memo(({ children, className, theme, readingTheme }: {
  children: ReactNode; className?: string; theme: 'light' | 'dark'; readingTheme?: string;
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const language = className?.replace(/language-/, '') || 'text';

  const handleCopy = () => {
    if (isCopied) return;
    navigator.clipboard.writeText(String(children)).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const themeMap: Record<string, { containerBg: string; headerBg: string; headerText: string; }> = {
    dark:  { containerBg: '#0D1117', headerBg: 'rgba(22,27,34,0.7)',   headerText: '#8B949E' },
    sepia: { containerBg: '#F0EAD6', headerBg: 'rgba(232,225,209,0.7)', headerText: '#8B7355' },
    light: { containerBg: '#f8f8f8', headerBg: 'rgba(239,239,239,0.7)', headerText: '#555555' },
  };
  const ts = themeMap[readingTheme as string] || themeMap.dark;

  return (
    <div className="relative rounded-lg my-4 overflow-hidden" style={{ backgroundColor: ts.containerBg }}>
      <div className="flex items-center justify-between px-4 py-2" style={{ backgroundColor: ts.headerBg, color: ts.headerText }}>
        <span className="text-xs font-semibold uppercase tracking-wider">{language}</span>
        <button onClick={handleCopy} className={`flex items-center gap-1.5 p-1.5 rounded-md text-xs transition-all ${isCopied ? 'text-green-400' : ''}`}>
          {isCopied ? <Check size={14} /> : <Copy size={14} />}
          {isCopied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <SyntaxHighlighter
        style={readingTheme === 'light' || readingTheme === 'sepia' ? prism : vscDarkPlus}
        language={language}
        PreTag="div"
        customStyle={{ backgroundColor: 'transparent', padding: '1rem 1.5rem', fontSize: '0.875rem', lineHeight: '1.5' }}
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    </div>
  );
});

const ReadingMode: React.FC<ReadingModeProps> = ({
  content, isEditing, editedContent, onEdit, onSave, onCancel, onContentChange,
  onGoBack, theme, bookId, currentModuleIndex,
}) => {
  const contentRef  = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<ReadingSettings>(() => {
    const saved = localStorage.getItem('pustakam-reading-settings');
    return {
      fontSize: 18, lineHeight: 1.8, fontFamily: 'nunito',
      theme: theme === 'dark' ? 'dark' : 'light',
      maxWidth: 'medium', textAlign: 'left',
      ...(saved ? JSON.parse(saved) : {}),
    };
  });
  const [isBookmarked,       setIsBookmarked]       = useState(false);
  const [showFloatingButtons, setShowFloatingButtons] = useState(false);
  const [bookmark,            setBookmark]            = useState<ReadingBookmark | null>(null);

  const getScrollEl = () => document.getElementById('main-scroll-area') || document.documentElement;

  useEffect(() => {
    const bm = readingProgressUtils.getBookmark(bookId);
    setBookmark(bm);
    setIsBookmarked(!!bm && bm.moduleIndex === currentModuleIndex);
  }, [bookId, currentModuleIndex]);

  useEffect(() => {
    setShowFloatingButtons(!isEditing);
  }, [isEditing]);

  useEffect(() => {
    if (isEditing) return;
    const el = document.getElementById('main-scroll-area') || window;
    let t: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const pos = getScrollEl().scrollTop;
        if (pos > 100) readingProgressUtils.saveBookmark(bookId, currentModuleIndex, pos);
      }, 500);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { clearTimeout(t); el.removeEventListener('scroll', onScroll); };
  }, [bookId, currentModuleIndex, isEditing]);

  useEffect(() => { localStorage.setItem('pustakam-reading-settings', JSON.stringify(settings)); }, [settings]);

  const toggleBookmark = () => {
    if (isBookmarked) {
      readingProgressUtils.deleteBookmark(bookId);
      setIsBookmarked(false);
      setBookmark(null);
    } else {
      const pos = getScrollEl().scrollTop;
      readingProgressUtils.saveBookmark(bookId, currentModuleIndex, pos);
      setBookmark(readingProgressUtils.getBookmark(bookId));
      setIsBookmarked(true);
    }
  };

  const handleGoToBookmark = () => {
    if (bookmark) getScrollEl().scrollTo({ top: bookmark.scrollPosition, behavior: 'smooth' });
  };

  const currentTheme = THEMES[settings.theme];

  if (isEditing) {
    return (
      <div className="animate-fade-in">
        <div className="flex justify-between items-center mb-4 sticky top-0 bg-[var(--color-bg)] z-30 pt-4 pb-2 border-b border-[var(--color-border)]">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-[var(--color-text-primary)]">
            <Edit className="w-5 h-5" /> Editing Mode
          </h3>
          <div className="flex gap-3">
            <button onClick={onCancel} className="btn btn-secondary"><X size={16} /> Cancel</button>
            <button onClick={onSave} className="btn btn-primary"><Save size={16} /> Save Changes</button>
          </div>
        </div>
        <textarea
          className="w-full h-[70vh] bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-4 text-[var(--color-text-primary)] font-mono text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/50"
          value={editedContent}
          onChange={e => onContentChange(e.target.value)}
          style={{ fontSize: `${settings.fontSize - 2}px` }}
        />
      </div>
    );
  }

  return (
    <>
      <div
        className={`reading-container theme-${settings.theme} overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.03] shadow-[0_20px_80px_rgba(0,0,0,0.22)] transition-colors duration-300`}
        style={{ backgroundColor: currentTheme.bg, color: currentTheme.text }}
      >
        {/* Toolbar */}
        <div className="z-20 flex flex-wrap justify-between items-center px-3 py-2 sm:px-4 border-b" style={{ borderColor: currentTheme.border, backgroundColor: currentTheme.bg }}>
          {/* Theme + zoom */}
          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-0">
            <div className="flex items-center gap-0.5 p-0.5 sm:p-1 rounded-lg" style={{ backgroundColor: currentTheme.contentBg }}>
              {(['light', 'sepia', 'dark'] as const).map(t => (
                <button key={t} onClick={() => setSettings(p => ({ ...p, theme: t }))} className="p-1.5 sm:p-2 rounded-md transition-all"
                  style={{ backgroundColor: settings.theme === t ? currentTheme.accent : 'transparent', color: settings.theme === t ? '#FFF' : currentTheme.secondary }}>
                  {t === 'light' ? <Sun size={16} /> : t === 'sepia' ? <Palette size={16} /> : <Moon size={16} />}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 sm:gap-2 ml-2">
              <button onClick={() => setSettings(p => ({ ...p, fontSize: Math.max(12, p.fontSize - 1) }))} className="p-1.5 sm:p-2 rounded-lg hover:bg-black/5" style={{ color: currentTheme.secondary }}>
                <ZoomOut size={16} />
              </button>
              <span className="min-w-[2.5rem] text-center text-sm font-mono" style={{ color: currentTheme.secondary }}>{settings.fontSize}px</span>
              <button onClick={() => setSettings(p => ({ ...p, fontSize: Math.min(28, p.fontSize + 1) }))} className="p-1.5 sm:p-2 rounded-lg hover:bg-black/5" style={{ color: currentTheme.secondary }}>
                <ZoomIn size={16} />
              </button>
            </div>
          </div>

          {/* Font selector */}
          <div className="relative group hidden md:flex items-center ml-4">
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all"
              style={{ backgroundColor: currentTheme.contentBg, color: currentTheme.text, borderColor: currentTheme.border }}>
              <span className="opacity-70">Font:</span>
              <span>{FONT_LABELS[settings.fontFamily]}</span>
              <ChevronDown size={14} className="opacity-50" />
            </button>
            <div className="absolute top-full left-0 mt-2 w-48 rounded-xl shadow-xl border overflow-hidden z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200"
              style={{ backgroundColor: currentTheme.contentBg, borderColor: currentTheme.border }}>
              {(['rubik', 'nunito', 'crimson', 'mono'] as const).map(f => (
                <button key={f} onClick={() => setSettings(p => ({ ...p, fontFamily: f }))}
                  className="w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:brightness-95"
                  style={{ fontFamily: FONT_FAMILIES[f], color: settings.fontFamily === f ? currentTheme.accent : currentTheme.text, backgroundColor: settings.fontFamily === f ? `${currentTheme.accent}15` : 'transparent' }}>
                  <span>{FONT_LABELS[f]}</span>
                  {settings.fontFamily === f && <Check size={14} />}
                </button>
              ))}
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
            {bookmark && (
              <button onClick={handleGoToBookmark} className="btn btn-secondary btn-sm flex items-center gap-1 sm:gap-2"
                style={{ borderColor: currentTheme.border, color: currentTheme.secondary }}>
                <Bookmark size={14} />
                <span className="hidden md:flex">Go to Bookmark</span>
              </button>
            )}
            <button onClick={onEdit} className="btn btn-secondary btn-sm flex items-center gap-1 sm:gap-2"
              style={{ borderColor: currentTheme.border, color: currentTheme.secondary }}>
              <Edit size={14} /> <span className="hidden md:flex">Edit</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div ref={contentRef} className="p-4 sm:p-8">
          <article
            className={`prose prose-lg max-w-none transition-all duration-300 mx-auto ${settings.theme !== 'light' ? 'prose-invert' : ''}`}
            style={{ fontFamily: FONT_FAMILIES[settings.fontFamily], fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight, maxWidth: MAX_WIDTHS[settings.maxWidth], textAlign: settings.textAlign as any, color: currentTheme.text }}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code: ({ className, children, ...props }) => {
                  if (!className?.includes('language-')) return <code className={className} {...props}>{children}</code>;
                  return <CodeBlock {...props} theme={theme} readingTheme={settings.theme} className={className}>{children}</CodeBlock>;
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </article>
        </div>
      </div>

      {/* Floating back button */}
      <div className={`reading-back-btn transition-all duration-300 ${showFloatingButtons ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        <button onClick={onGoBack} className="reading-floating-btn" title="Back to Library">
          <ArrowLeft size={18} />
          <span className="tooltip">Back</span>
        </button>
      </div>

      {/* Floating bookmark */}
      <div className={`reading-floating-controls transition-all duration-300 ${showFloatingButtons ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        <button onClick={toggleBookmark} className={`reading-floating-btn ${isBookmarked ? 'bookmark-active' : ''}`}>
          {isBookmarked ? <BookmarkCheck size={18} className="bookmark-check-icon" /> : <Bookmark size={18} />}
          <span className="tooltip">{isBookmarked ? 'Bookmarked' : 'Bookmark'}</span>
        </button>
      </div>
    </>
  );
};

const DetailTabButton = ({ label, Icon, isActive, onClick }: { label: ReactNode; Icon: React.ElementType; isActive: boolean; onClick: () => void; }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${isActive
      ? 'border-orange-500/25 bg-orange-500/[0.08] text-[var(--color-text-primary)] shadow-[0_12px_32px_rgba(249,115,22,0.08)]'
      : 'border-white/[0.08] bg-white/[0.025] text-[var(--color-text-secondary)] hover:border-white/[0.14] hover:text-[var(--color-text-primary)]'}`}
  >
    <Icon className="w-4 h-4" /> {label}
  </button>
);

// ============================================================================
// HOME VIEW (create / list landing)
// ============================================================================
const HomeView = ({
  onNewBook, onShowList, hasApiKey, bookCount, theme,
  formData, setFormData, showAdvanced, setShowAdvanced,
  handleCreateRoadmap, handleEnhanceWithAI, isEnhancing, localIsGenerating, onOpenSettings,
}: {
  onNewBook: () => void;
  onShowList: () => void;
  hasApiKey: boolean;
  bookCount: number;
  theme: 'light' | 'dark';
  formData: BookSession;
  setFormData: React.Dispatch<React.SetStateAction<BookSession>>;
  showAdvanced: boolean;
  setShowAdvanced: (show: boolean) => void;
  handleCreateRoadmap: (data: BookSession) => void;
  handleEnhanceWithAI: () => void;
  isEnhancing: boolean;
  localIsGenerating: boolean;
  onOpenSettings: () => void;
}) => (
  <div
    className={`flex-1 flex flex-col items-center px-6 pb-12 w-full transition-all duration-500 ${showAdvanced ? 'min-h-screen overflow-y-auto pt-24' : 'h-screen overflow-hidden pt-20'}`}
    style={{ background: 'var(--color-bg)', fontFamily: 'Rubik, sans-serif' }}
  >
    <div className="w-full max-w-2xl mx-auto animate-subtle-fade">
      <div className="text-center mb-8">
        <div className="mb-5 hidden items-center justify-center md:flex">
          <span className="inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-400/10 px-4 py-1.5 text-[11px] uppercase tracking-[0.22em] text-orange-200/90">
            <Sparkles className="h-3.5 w-3.5" /> Pustakam Injin
          </span>
        </div>
        <img src={theme === 'dark' ? '/white-logo.png' : '/black-logo.png'} alt="Pustakam" className="w-14 h-14 mx-auto mb-5" />
        <h1 className="text-4xl md:text-[56px] font-bold text-[var(--color-text-primary)] tracking-tight leading-[0.96]">
          Build Better<br /><span className="text-orange-500">Learning Books.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[var(--color-text-secondary)] md:text-base">
          Start with one idea. Injin turns it into a clean, structured book.
        </p>
      </div>

      {/* Input bar */}
      <div className="grok-input-bar">
        <textarea
          value={formData.goal}
          onChange={e => {
            setFormData(p => ({ ...p, goal: e.target.value }));
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey && formData.goal.trim() && hasApiKey && !localIsGenerating) {
              e.preventDefault();
              handleCreateRoadmap(formData);
            }
          }}
          placeholder="Describe the book you want to create"
          className="flex-1 bg-transparent border-none outline-none text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] text-base resize-none"
          rows={1}
          style={{ minHeight: '24px', maxHeight: '200px' }}
        />
        <button
          onClick={() => { if (!showAdvanced) setShowAdvanced(true); handleEnhanceWithAI(); }}
          disabled={!formData.goal.trim() || isEnhancing || !hasApiKey}
          className="grok-input-icon shrink-0 flex items-center gap-1.5 text-sm"
          title="Enhance prompt with AI"
        >
          {isEnhancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          <span className="hidden sm:inline">{isEnhancing ? 'Refining…' : 'Enhance'}</span>
        </button>
      </div>

      {/* Action chips */}
      <div className="grok-chips">
        <button onClick={() => setShowAdvanced(!showAdvanced)} className="grok-chip">
          <Settings size={16} /> Guided
          <ChevronDown size={12} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>
        {bookCount > 0 && (
          <button onClick={onShowList} className="grok-chip">
            <List size={16} /> My Library ({bookCount})
          </button>
        )}
        <button onClick={onOpenSettings} className="grok-chip"><Settings size={16} /> Settings</button>
      </div>

      {/* Advanced options */}
      {showAdvanced && (
        <div className="mt-6 p-6 bg-[var(--color-card)] border border-[var(--color-border)] rounded-[28px] shadow-xl"
          style={{ animation: 'dropdownSlideIn 0.25s cubic-bezier(0.16,1,0.3,1)', transformOrigin: 'top center' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold mb-2 text-[var(--color-text-primary)]">Target Audience</label>
              <input type="text" value={formData.targetAudience}
                onChange={e => setFormData(p => ({ ...p, targetAudience: e.target.value }))}
                placeholder="e.g. Beginners, Professionals"
                className="w-full h-11 bg-[var(--color-bg)] border-2 border-[var(--color-border)] rounded-xl px-4 text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)]/50 focus:border-[var(--color-text-secondary)]/50 focus:ring-4 focus:ring-[var(--color-text-secondary)]/10 transition-all outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-[var(--color-text-primary)]">Complexity Level</label>
              <CustomSelect
                value={formData.complexityLevel || 'intermediate'}
                onChange={val => setFormData(p => ({ ...p, complexityLevel: val as any }))}
                options={[{ value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Intermediate' }, { value: 'advanced', label: 'Advanced' }]}
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2 text-[var(--color-text-primary)]">Context & Goals (Optional)</label>
            <textarea value={formData.reasoning}
              onChange={e => setFormData(p => ({ ...p, reasoning: e.target.value }))}
              placeholder="Why are you writing this book? What should the reader achieve?"
              className="w-full bg-[var(--color-bg)] border-2 border-[var(--color-border)] rounded-xl p-4 text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)]/50 focus:border-[var(--color-text-secondary)]/50 outline-none resize-none text-sm" rows={3} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 pt-4 border-t border-[var(--color-border)]">
            <div>
              <label className="block text-sm font-semibold mb-2 text-[var(--color-text-primary)]">Generation Mode</label>
              <div className="flex p-1 bg-[var(--color-bg)] border-2 border-[var(--color-border)] rounded-xl">
                {[{ value: 'stellar', label: 'Stellar', icon: Sparkles, color: 'cyan' }, { value: 'blackhole', label: 'Street', icon: Crown, color: 'orange' }].map(({ value, label, icon: Icon, color }) => (
                  <button key={value} type="button"
                    onClick={() => setFormData(p => ({ ...p, generationMode: value as any, language: value === 'stellar' ? 'en' : p.language }))}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${formData.generationMode === value
                      ? `bg-gradient-to-r from-${color}-500/20 to-${color}-500/20 text-${color}-400 border border-${color}-500/30 shadow-inner`
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}>
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-[var(--color-text-primary)]">Output Language</label>
              <CustomSelect
                value={formData.language || 'en'}
                onChange={val => setFormData(p => ({ ...p, language: val as any }))}
                options={[
                  { value: 'en', label: 'English (Standard)' },
                  ...(formData.generationMode === 'blackhole' ? [
                    { value: 'hi', label: 'Hindi (Tapori)' },
                    { value: 'mr', label: 'Marathi (Tapori)' },
                  ] : []),
                ]}
              />
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-[var(--color-border)]">
            <button
              onClick={() => hasApiKey ? handleCreateRoadmap(formData) : onOpenSettings()}
              disabled={!formData.goal.trim() || localIsGenerating}
              className="w-full h-12 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {localIsGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              Generate Book Roadmap
            </button>
          </div>
        </div>
      )}

      <p className="text-center text-xs text-[var(--color-text-secondary)] mt-8 opacity-60">
        Press Enter to generate • Secure GLM proxy required
      </p>
    </div>
  </div>
);

// ============================================================================
// BOOK LIST GRID
// ============================================================================
const BookListGrid = ({
  books, onSelectBook, onDeleteBook, setView, setShowListInMain,
}: {
  books: BookProject[];
  onSelectBook: (id: string) => void;
  onDeleteBook: (id: string) => void;
  setView: (view: AppView) => void;
  setShowListInMain: (show: boolean) => void;
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const getBookIcon = (title: string): React.ElementType => {
    const t = title.toLowerCase();
    if (t.includes('ai') || t.includes('intelligence') || t.includes('machine')) return Brain;
    if (t.includes('code') || t.includes('program') || t.includes('dev'))        return Code;
    if (t.includes('music') || t.includes('song'))                                return Music;
    if (t.includes('health') || t.includes('fitness'))                            return Heart;
    if (t.includes('money') || t.includes('finance'))                             return TrendingUp;
    return Book;
  };

  const filtered = books.filter(b => b.title.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--color-bg)', fontFamily: 'Rubik, sans-serif' }}>
      <div className="flex-shrink-0 w-full sticky top-0 z-40 bg-[var(--color-bg)]/92 pb-6 pt-6 px-8 lg:px-12 backdrop-blur-xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.26em] text-orange-200/70">Library</p>
            <div className="flex items-baseline gap-3">
              <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">Your Bookshelf</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">{books.length} {books.length === 1 ? 'project' : 'projects'}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input type="text" placeholder="Search books" value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-52 rounded-full border border-white/10 bg-white/[0.03] pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 transition-all focus:w-60 focus:border-orange-400/40 focus:outline-none" />
            </div>
            <button onClick={() => setShowListInMain(false)}
              className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4 inline mr-2" /> Back
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="w-full max-w-[1400px] mx-auto px-8 lg:px-12 pb-10">
          {filtered.length === 0 ? (
            <div className="text-center py-24 bg-white/[0.02] rounded-2xl border border-white/5 border-dashed">
              <div className="w-16 h-16 mx-auto mb-6 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                <BookOpen className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">{searchQuery ? 'No books found' : 'No books yet'}</h3>
              <p className="text-gray-500 mb-6 max-w-sm mx-auto text-sm">
                {searchQuery ? 'Try adjusting your search.' : 'Create your first AI-generated book.'}
              </p>
              {!searchQuery && (
                <button onClick={() => { setView('create'); setShowListInMain(false); }}
                  className="px-5 py-2.5 text-sm font-medium text-gray-400 hover:text-white border border-white/10 hover:border-white/20 rounded-full transition-all inline-flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> Create Book
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map(book => {
                const wordCount = book.modules.reduce((a, m) => a + (m.wordCount || 0), 0) || book.totalWords || 0;
                const Icon = getBookIcon(book.title);
                return (
                  <div key={book.id} onClick={() => onSelectBook(book.id)}
                    className="group relative cursor-pointer overflow-hidden rounded-[20px] border border-white/[0.08] bg-white/[0.025] p-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/[0.14] hover:bg-white/[0.04]">
                    <div className="flex items-center gap-3">
                      <div className={`relative h-20 w-[58px] shrink-0 overflow-hidden rounded-[16px] border border-white/10 bg-gradient-to-br ${getBookCoverTone(book.title)} shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]`}>
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.2),transparent_38%),linear-gradient(180deg,rgba(8,8,8,0.02),rgba(8,8,8,0.44))]" />
                        <div className="absolute inset-x-0 bottom-0 p-2">
                          <div className="mb-1 inline-flex rounded-full border border-white/15 bg-black/20 p-1 text-white/90 backdrop-blur-md">
                            <Icon className="h-2.5 w-2.5" />
                          </div>
                          <p className="line-clamp-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/90">{book.title}</p>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="break-words text-[15px] font-semibold leading-5 text-[var(--color-text-primary)]">{book.title}</h3>
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--color-text-secondary)]">
                              <span className="inline-flex items-center gap-1.5"><Clock size={11} />{new Date(book.createdAt).toLocaleDateString()}</span>
                              {wordCount > 0 && <span className="inline-flex items-center gap-1.5"><Sparkles size={11} />{wordCount.toLocaleString()} words</span>}
                            </div>
                          </div>
                          <button onClick={e => { e.stopPropagation(); onDeleteBook(book.id); }}
                            className="rounded-full p-2 text-gray-400 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export function BookView({
  books, currentBookId, onCreateBookRoadmap, onGenerateAllModules, onRetryFailedModules,
  onAssembleBook, onSelectBook, onDeleteBook, onUpdateBookStatus, hasApiKey, view, setView,
  onUpdateBookContent, showListInMain, setShowListInMain, isMobile = false,
  generationStatus, generationStats, onPauseGeneration, onResumeGeneration,
  isGenerating, onRetryDecision, availableModels, theme, onOpenSettings,
  showAlertDialog, showToast, onReadingModeChange, settings,
}: BookViewProps) {
  const [detailTab, setDetailTab] = useState<'overview' | 'analytics' | 'read'>('overview');
  const [localIsGenerating, setLocalIsGenerating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [formData, setFormData] = useState<BookSession>({
    goal: '',
    language: settings?.defaultLanguage || 'en',
    targetAudience: '',
    complexityLevel: 'intermediate',
    reasoning: '',
    generationMode: settings?.defaultGenerationMode || 'stellar',
    preferences: { includeExamples: true, includePracticalExercises: false, includeQuizzes: false },
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [pdfProgress, setPdfProgress] = useState(0);

  const currentBook = currentBookId ? books.find(b => b.id === currentBookId) : null;

  // Sync settings → form defaults
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      generationMode: settings?.defaultGenerationMode || 'stellar',
      language: settings?.defaultLanguage || 'en',
    }));
  }, [settings?.defaultGenerationMode, settings?.defaultLanguage]);

  useEffect(() => {
    if (currentBook) {
      setLocalIsGenerating(['generating_roadmap', 'generating_content', 'assembling'].includes(currentBook.status));
      setIsEditing(false);
      if (currentBook.status === 'completed') {
        const bm = readingProgressUtils.getBookmark(currentBook.id);
        setDetailTab(bm ? 'read' : 'overview');
      } else {
        setDetailTab('overview');
      }
    } else {
      setDetailTab('overview');
    }
  }, [currentBook]);

  useEffect(() => {
    if (onReadingModeChange) onReadingModeChange(detailTab === 'read' && view === 'detail' && !!currentBook);
  }, [detailTab, view, currentBook, onReadingModeChange]);

  useEffect(() => {
    return () => { if (currentBookId) bookService.cancelActiveRequests(currentBookId); };
  }, [currentBookId]);

  // ── HOISTED ENHANCE HANDLER (single definition, used by both list & create views) ──
  const handleEnhanceWithAI = async () => {
    if (!formData.goal.trim()) return;
    if (!hasApiKey) {
      showAlertDialog({
        type: 'warning', title: 'Setup Required',
        message: 'Enable the Injin Stack proxy in setup to use the AI refiner.',
        confirmText: 'Open Setup', onConfirm: onOpenSettings,
      });
      return;
    }
    setIsEnhancing(true);
    try {
      const enhanced = await bookService.enhanceBookInput(formData.goal, formData.generationMode);
      setFormData({
        goal: enhanced.goal,
        language: 'en',
        targetAudience: enhanced.targetAudience,
        complexityLevel: enhanced.complexityLevel,
        reasoning: enhanced.reasoning || '',
        generationMode: formData.generationMode,
        preferences: enhanced.preferences,
      });
      showToast('Idea refined! ✨ Review and adjust as needed.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Refinement failed', 'error');
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleGoBackToLibrary = () => {
    setView('list');
    onSelectBook(null);
    setShowListInMain(true);
  };

  const handleCreateRoadmap = async (session: BookSession) => {
    if (!session.goal.trim()) { showToast('Please enter a learning goal.', 'warning'); return; }
    if (!hasApiKey) {
      showAlertDialog({ type: 'warning', title: 'Setup Required', message: 'Enable the Injin Stack proxy before generating.', confirmText: 'Open Setup', onConfirm: onOpenSettings });
      return;
    }
    await onCreateBookRoadmap(session);
    setFormData({ goal: '', language: 'en', targetAudience: '', complexityLevel: 'intermediate', reasoning: '', generationMode: 'stellar', preferences: { includeExamples: true, includePracticalExercises: false, includeQuizzes: false } });
    setShowAdvanced(false);
  };

  const handleStartGeneration = () => {
    if (!currentBook?.roadmap) { showToast('No roadmap found. Generate a roadmap first.', 'warning'); return; }
    const session: BookSession = {
      goal: currentBook.goal, language: 'en', targetAudience: '',
      complexityLevel: currentBook.roadmap.difficultyLevel || 'intermediate',
      preferences: { includeExamples: true, includePracticalExercises: false, includeQuizzes: false },
      reasoning: currentBook.reasoning, generationMode: currentBook.generationMode,
    };
    onGenerateAllModules(currentBook, session);
  };

  const handleStartAssembly = () => {
    if (!currentBook) return;
    const session: BookSession = {
      goal: currentBook.goal, language: 'en', targetAudience: '',
      complexityLevel: currentBook.roadmap?.difficultyLevel || 'intermediate',
      preferences: { includeExamples: true, includePracticalExercises: false, includeQuizzes: false },
      reasoning: currentBook.reasoning, generationMode: currentBook.generationMode,
    };
    onAssembleBook(currentBook, session);
  };

  const handlePauseGeneration = () => { if (currentBook) onPauseGeneration?.(currentBook.id); };

  const handleResumeGeneration = async () => {
    if (!currentBook?.roadmap) { showToast('No roadmap found. Cannot resume.', 'error'); return; }
    const session: BookSession = {
      goal: currentBook.goal, language: 'en', targetAudience: '',
      complexityLevel: currentBook.roadmap.difficultyLevel || 'intermediate',
      preferences: { includeExamples: true, includePracticalExercises: false, includeQuizzes: false },
      reasoning: currentBook.reasoning, generationMode: currentBook.generationMode,
    };
    onResumeGeneration?.(currentBook, session);
  };

  const handleDownloadPdf = async () => {
    if (!currentBook) return;
    setPdfProgress(1);
    try {
      await pdfService.generatePdf(currentBook, setPdfProgress);
      showToast('PDF downloaded!', 'success');
      setTimeout(() => setPdfProgress(0), 2000);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'PDF generation failed';
      showAlertDialog({ type: 'error', title: 'PDF Generation Failed', message: msg, confirmText: 'Dismiss' });
      setPdfProgress(0);
    }
  };

  const getStatusIcon = (status: BookProject['status']) => {
    if (['generating_roadmap', 'generating_content', 'assembling'].includes(status)) return <StatusLoader />;
    const map: Record<BookProject['status'], React.ElementType> = {
      planning: Clock, generating_roadmap: Loader2, roadmap_completed: ListChecks,
      generating_content: Loader2, assembling: Box, completed: CheckCircle, error: AlertCircle,
    };
    const Icon = map[status] || Loader2;
    const color = status === 'completed' ? 'text-green-500' : status === 'error' ? 'text-red-500' : 'text-cyan-500';
    return <Icon className={`w-4 h-4 ${color}`} />;
  };

  const getStatusText = (status: BookProject['status']) =>
    ({ planning: 'Planning', generating_roadmap: 'Creating Roadmap', roadmap_completed: 'Ready to Write', generating_content: 'Writing Chapters', assembling: 'Finalizing Book', completed: 'Completed', error: 'Error' }[status] || 'Unknown');

  // ============================================================================
  // RENDER — LIST VIEW
  // ============================================================================
  if (view === 'list') {
    if (showListInMain) {
      return (
        <BookListGrid
          books={books}
          onSelectBook={onSelectBook}
          onDeleteBook={onDeleteBook}
          setView={setView}
          setShowListInMain={setShowListInMain}
        />
      );
    }
    return (
      <HomeView
        onNewBook={() => setView('create')}
        onShowList={() => setShowListInMain(true)}
        hasApiKey={hasApiKey}
        bookCount={books.length}
        theme={theme}
        formData={formData}
        setFormData={setFormData}
        showAdvanced={showAdvanced}
        setShowAdvanced={setShowAdvanced}
        handleCreateRoadmap={handleCreateRoadmap}
        handleEnhanceWithAI={handleEnhanceWithAI}
        isEnhancing={isEnhancing}
        localIsGenerating={localIsGenerating}
        onOpenSettings={onOpenSettings}
      />
    );
  }

  // ============================================================================
  // RENDER — CREATE VIEW
  // ============================================================================
  if (view === 'create') {
    return (
      <div className="w-full max-w-2xl mx-auto px-6 py-10 animate-fade-in-up">
        <button onClick={() => { setView('list'); setShowListInMain(false); }}
          className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors mb-8 group">
          <div className="w-8 h-8 rounded-full bg-[var(--color-card)] border border-[var(--color-border)] flex items-center justify-center group-hover:border-orange-500/50 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </div>
          Back to Library
        </button>

        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center p-3 mb-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-500">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-3xl md:text-[52px] font-bold mb-3 text-[var(--color-text-primary)] tracking-tight leading-[0.96]">
            Build Better <span className="text-orange-500">Learning Books.</span>
          </h1>
        </div>

        <div className="space-y-8 bg-[var(--color-card)] backdrop-blur-xl border border-[var(--color-border)] p-8 rounded-[30px] shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
          <div>
            <label className="block text-sm font-semibold mb-2 text-[var(--color-text-primary)]">What would you like to write about?</label>
            <div className="relative">
              <textarea
                value={formData.goal}
                onChange={e => setFormData(p => ({ ...p, goal: e.target.value }))}
                placeholder="e.g., 'A comprehensive guide to organic gardening for beginners'"
                className="w-full bg-[var(--color-bg)] border-2 border-[var(--color-border)] rounded-xl p-4 text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)]/50 focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10 outline-none resize-none text-base leading-relaxed"
                rows={4} required
              />
              <div className="absolute bottom-3 right-3">
                <button onClick={handleEnhanceWithAI} disabled={!formData.goal.trim() || isEnhancing}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-500 hover:bg-orange-500 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {isEnhancing ? <Loader2 className="animate-spin w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                  {isEnhancing ? 'Refining…' : 'Enhance with AI'}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold mb-2 text-[var(--color-text-primary)]">Target Audience</label>
              <input type="text" value={formData.targetAudience}
                onChange={e => setFormData(p => ({ ...p, targetAudience: e.target.value }))}
                placeholder="e.g. Beginners, Professionals"
                className="w-full h-11 bg-[var(--color-bg)] border-2 border-[var(--color-border)] rounded-xl px-4 text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)]/50 focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-[var(--color-text-primary)]">Complexity Level</label>
              <CustomSelect
                value={formData.complexityLevel || 'intermediate'}
                onChange={val => setFormData(p => ({ ...p, complexityLevel: val as any }))}
                options={[{ value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Intermediate' }, { value: 'advanced', label: 'Advanced' }]}
              />
            </div>
          </div>

          <button
            onClick={() => handleCreateRoadmap(formData)}
            disabled={!formData.goal.trim() || !hasApiKey || localIsGenerating}
            className="btn w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-lg font-bold py-4 rounded-xl shadow-xl shadow-orange-500/20 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
          >
            {localIsGenerating ? (
              <><Loader2 className="animate-spin w-5 h-5" /><span>Designing Roadmap…</span></>
            ) : (
              <><Sparkles size={20} /><span>Generate Book Roadmap</span></>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER — DETAIL VIEW
  // ============================================================================
  if (view === 'detail' && currentBook) {
    const areAllModulesDone =
      currentBook.roadmap &&
      currentBook.modules.length === currentBook.roadmap.modules.length &&
      currentBook.modules.every(m => m.status === 'completed');
    const failedModules    = currentBook.modules.filter(m => m.status === 'error');
    const completedModules = currentBook.modules.filter(m => m.status === 'completed');
    const isPaused         = generationStatus?.status === 'paused';
    const totalModuleCount = Math.max(currentBook.roadmap?.modules.length || currentBook.modules.length, 1);
    const totalWords       = currentBook.modules.reduce((s, m) => s + (m.wordCount || 0), 0) || currentBook.totalWords || 0;
    const estimatedReadTime = Math.max(10, Math.round(totalWords / 220));

    return (
      <div className="min-h-[calc(100vh-48px)]" style={{ background: 'var(--color-bg)', fontFamily: 'Rubik, sans-serif' }}>
        <div className="w-full max-w-6xl mx-auto px-6 py-10">
          <div className="mb-8">
            <button onClick={() => { setView('list'); onSelectBook(null); setShowListInMain(true); }}
              className="mb-5 flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to My Books
            </button>

            {/* Book header card */}
            <div className="overflow-hidden rounded-[30px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))]">
              <div className="relative overflow-hidden border-b border-white/[0.08] bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.10),transparent_30%)] p-7 md:p-8">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.26em] text-orange-200/70">Book Workspace</p>
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_320px] lg:items-end">
                  <div>
                    <h1 className="mb-3 text-3xl font-bold tracking-tight text-white md:text-[44px] md:leading-[0.98]">{currentBook.title}</h1>
                    <p className="max-w-2xl text-sm leading-7 text-white/50">{currentBook.goal}</p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {[
                        { icon: FileText, text: `${totalModuleCount} modules` },
                        { icon: Sparkles, text: `${totalWords.toLocaleString()} words` },
                        { icon: Clock, text: `${estimatedReadTime} min read` },
                      ].map(({ icon: Icon, text }) => (
                        <span key={text} className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
                          <Icon className="h-3.5 w-3.5" /> {text}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Status', value: <div className="flex items-center gap-2 text-sm font-semibold text-white">{getStatusIcon(currentBook.status)}{getStatusText(currentBook.status)}</div> },
                      { label: 'Progress', value: `${completedModules.length}/${totalModuleCount} modules` },
                      { label: 'Updated', value: new Date(currentBook.updatedAt).toLocaleDateString() },
                      { label: 'Mode', value: currentBook.generationMode === 'blackhole' ? 'Street Mode' : 'Stellar Mode' },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-[22px] border border-white/[0.08] bg-white/[0.025] p-4">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">{label}</p>
                        <div className="mt-2 text-sm font-semibold text-white">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tab bar (completed books only) */}
          {currentBook.status === 'completed' && (
            <div className="mb-8 flex items-center gap-3">
              <DetailTabButton label="Overview"  Icon={ListChecks} isActive={detailTab === 'overview'}  onClick={() => setDetailTab('overview')} />
              <DetailTabButton label="Analytics" Icon={BarChart3}  isActive={detailTab === 'analytics'} onClick={() => setDetailTab('analytics')} />
              <DetailTabButton label="Read Book" Icon={BookText}   isActive={detailTab === 'read'}      onClick={() => setDetailTab('read')} />
            </div>
          )}

          {/* Tab content */}
          {detailTab === 'analytics' && currentBook.status === 'completed' ? (
            <BookAnalytics book={currentBook} />
          ) : detailTab === 'read' && currentBook.status === 'completed' ? (
            <ReadingMode
              content={currentBook.finalBook || ''}
              isEditing={isEditing}
              editedContent={editedContent}
              onEdit={() => { setEditedContent(currentBook.finalBook || ''); setIsEditing(true); }}
              onSave={() => { onUpdateBookContent(currentBook.id, editedContent); setIsEditing(false); setEditedContent(''); showToast('Changes saved.', 'success'); }}
              onCancel={() => { setIsEditing(false); setEditedContent(''); }}
              onContentChange={setEditedContent}
              onGoBack={handleGoBackToLibrary}
              theme={theme}
              bookId={currentBook.id}
              currentModuleIndex={0}
            />
          ) : (
            <>
              {/* Generation progress panel */}
              {(isGenerating || isPaused || generationStatus?.status === 'waiting_retry') && generationStatus && generationStats && (
                <EmbeddedProgressPanel
                  generationStatus={generationStatus}
                  stats={generationStats}
                  onCancel={() => showAlertDialog({ type: 'confirm', title: 'Cancel Generation', message: 'Cancel generation? Progress will be saved.', confirmText: 'Yes, Cancel', cancelText: 'Keep Generating', onConfirm: () => bookService.cancelActiveRequests(currentBook.id) })}
                  onPause={handlePauseGeneration}
                  onResume={handleResumeGeneration}
                  onRetryDecision={onRetryDecision}
                  availableModels={availableModels}
                  bookTitle={currentBook.title}
                />
              )}

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
                {/* Roadmap */}
                {currentBook.roadmap && (
                  <div className="rounded-[30px] border border-white/[0.08] bg-white/[0.025] p-6 md:p-7">
                    <div className="mb-6 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-orange-200/70">Roadmap</p>
                        <h3 className="mt-2 text-2xl font-semibold text-white">Learning Flow</h3>
                      </div>
                      <div className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
                        {completedModules.length}/{totalModuleCount} complete
                      </div>
                    </div>
                    <div className="space-y-3">
                      {currentBook.roadmap.modules.map((mod, idx) => {
                        const done   = currentBook.modules.find(m => m.roadmapModuleId === mod.id);
                        const active = generationStatus?.currentModule?.id === mod.id;
                        return (
                          <div key={mod.id} className={`group flex items-start gap-4 rounded-[22px] border px-4 py-4 transition-all ${active ? 'border-orange-500/25 bg-orange-500/[0.05]' : done?.status === 'completed' ? 'border-emerald-500/20 bg-emerald-500/[0.05]' : done?.status === 'error' ? 'border-red-500/20 bg-red-500/[0.04]' : 'border-white/[0.08] bg-white/[0.015] hover:border-white/[0.14]'}`}>
                            <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${done?.status === 'completed' ? 'border-emerald-400/20 bg-emerald-400/15 text-emerald-200' : done?.status === 'error' ? 'border-red-400/20 bg-red-400/15 text-red-200' : active ? 'border-orange-400/20 bg-orange-400/15 text-orange-100' : 'border-white/[0.08] bg-white/[0.04] text-white/50'}`}>
                              {done?.status === 'completed' ? <Check size={15} /> : done?.status === 'error' ? <X size={15} /> : active ? <Loader2 size={15} className="animate-spin" /> : String(idx + 1).padStart(2, '0')}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-base font-semibold text-white">{mod.title}</h4>
                                {done?.status === 'completed' && <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">Done</span>}
                                {active && <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-orange-100">Writing</span>}
                              </div>
                              <p className="mt-1 text-sm leading-6 text-white/50">{mod.description || mod.estimatedTime}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Right sidebar actions */}
                <div className="space-y-6">
                  {/* Generate modules CTA */}
                  {currentBook.status === 'roadmap_completed' && !areAllModulesDone && !isGenerating && !isPaused && generationStatus?.status !== 'waiting_retry' && (
                    <div className="rounded-[30px] border border-white/[0.08] bg-white/[0.025] p-6">
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-orange-200/70">Next Step</p>
                      <h3 className="mt-3 text-2xl font-semibold text-white">Generate Chapters</h3>
                      <p className="mt-2 text-sm leading-6 text-white/50">
                        {completedModules.length > 0 ? `Resume from ${completedModules.length} completed module(s).` : 'Start the writing pass.'}
                      </p>
                      <button onClick={handleStartGeneration} disabled={localIsGenerating} className="btn btn-primary mt-5 w-full py-2.5">
                        {localIsGenerating ? <><Loader2 className="animate-spin" /> Generating…</> : <><Play className="w-4 h-4" />{completedModules.length > 0 ? 'Resume Generation' : 'Generate All Modules'}</>}
                      </button>
                    </div>
                  )}

                  {/* Assembly CTA */}
                  {areAllModulesDone && currentBook.status !== 'completed' && !localIsGenerating && !isGenerating && !isPaused && (
                    <div className="rounded-[30px] border border-emerald-500/20 bg-emerald-500/[0.05] p-6 space-y-5 animate-fade-in-up">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-200/70">Ready</p>
                        <h3 className="mt-3 text-2xl font-semibold text-white">Assemble Final Book</h3>
                        <p className="mt-2 text-sm leading-6 text-white/50">All chapters complete. Build the final exportable book.</p>
                      </div>
                      <button onClick={handleStartAssembly} className="btn btn-primary w-full py-2.5">
                        <Box className="w-5 h-5" /> Assemble Final Book
                      </button>
                    </div>
                  )}

                  {/* Assembling state */}
                  {currentBook.status === 'assembling' && (
                    <div className="rounded-[30px] border border-green-500/25 bg-white/[0.025] p-6 space-y-6 animate-assembling-glow">
                      <div className="relative h-14 w-14">
                        <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping" />
                        <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10"><Box className="w-7 h-7 text-green-400" /></div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-200/70">Assembly</p>
                        <h3 className="mt-3 text-2xl font-semibold text-white">Finalizing Your Book</h3>
                        <p className="mt-2 text-sm leading-6 text-white/50">Chapters are being stitched together for export.</p>
                      </div>
                      <div className="w-full overflow-hidden rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] h-2">
                        <div className="h-full rounded-full bg-gradient-to-r from-green-500 via-emerald-400 to-green-500 animate-slide-in-out" />
                      </div>
                    </div>
                  )}

                  {/* Download panel */}
                  {currentBook.status === 'completed' && detailTab === 'overview' && (
                    <div className="rounded-[30px] border border-white/[0.08] bg-white/[0.025] p-6">
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-orange-200/70">Exports</p>
                      <h3 className="mt-3 text-2xl font-semibold text-white">Download Your Book</h3>
                      <p className="mt-2 text-sm leading-6 text-white/50">Export a polished PDF or take the markdown source.</p>
                      <div className="mt-5 space-y-3">
                        <button onClick={handleDownloadPdf} disabled={pdfProgress > 0 && pdfProgress < 100}
                          className="group flex w-full items-center justify-between rounded-[22px] border border-white/[0.08] bg-black/20 p-4 hover:border-white/[0.14] disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.05] text-white"><Download className="w-5 h-5" /></div>
                            <div className="text-left">
                              <div className="font-semibold text-white">Professional PDF</div>
                              <div className="text-sm text-white/50">{pdfProgress > 0 && pdfProgress < 100 ? `Generating… ${pdfProgress}%` : 'Print-ready document'}</div>
                            </div>
                          </div>
                          <span className="text-sm text-white/50 group-hover:text-white transition-colors">Export</span>
                        </button>
                        <button onClick={() => {
                          if (!currentBook.finalBook) return;
                          const blob = new Blob([currentBook.finalBook], { type: 'text/markdown;charset=utf-8' });
                          const url  = URL.createObjectURL(blob);
                          const a    = document.createElement('a');
                          a.href     = url;
                          a.download = `${currentBook.title.replace(/[^a-z0-9\s-]/gi, '').replace(/\s+/g, '_').toLowerCase()}_book.md`;
                          document.body.appendChild(a); a.click();
                          document.body.removeChild(a); URL.revokeObjectURL(url);
                          showToast('Markdown downloaded.', 'success');
                        }}
                          className="group flex w-full items-center justify-between rounded-[22px] border border-white/[0.08] bg-black/20 p-4 hover:border-white/[0.14] transition-all">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300"><Download className="w-5 h-5" /></div>
                            <div className="text-left">
                              <div className="font-semibold text-white">Markdown Source</div>
                              <div className="text-sm text-white/50">Easy to edit and version</div>
                            </div>
                          </div>
                          <span className="text-sm text-white/50 group-hover:text-white transition-colors">Export</span>
                        </button>
                      </div>
                      {pdfProgress > 0 && pdfProgress < 100 && (
                        <div className="mt-4">
                          <div className="w-full overflow-hidden rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] h-2">
                            <div className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300 transition-all duration-300" style={{ width: `${pdfProgress}%` }} />
                          </div>
                          <p className="mt-2 text-center text-xs text-white/50">Generating PDF… {pdfProgress}%</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stats snapshot */}
                  <div className="rounded-[30px] border border-white/[0.08] bg-white/[0.025] p-6">
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-orange-200/70">Snapshot</p>
                    <div className="mt-4 space-y-4">
                      {[
                        { label: 'Completed modules', value: `${completedModules.length}/${totalModuleCount}` },
                        { label: 'Failed modules',    value: failedModules.length },
                        { label: 'Words',             value: totalWords.toLocaleString() },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex items-center justify-between text-sm">
                          <span className="text-white/50">{label}</span>
                          <span className="font-semibold text-white">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return null;
}
