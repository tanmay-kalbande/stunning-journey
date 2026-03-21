// src/components/BookView.tsx - COMPLETE FIXED VERSION
import React, { useEffect, ReactNode, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Book,
  Download,
  Trash2,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Brain,
  Sparkles,
  BarChart3,
  ListChecks,
  Play,
  Box,
  ArrowLeft,
  Check,
  BookText,
  RefreshCw,
  Edit,
  Save,
  X,
  FileText,
  List,
  Settings,
  Moon,
  ZoomIn,
  ZoomOut,
  BookOpen,
  BookmarkCheck,
  Copy,
  AlertTriangle,
  CheckCircle2,
  Pause,
  Zap,
  Sun,
  Palette,
  Bookmark,
  ChevronDown,
  Search,
  Code,
  Music,
  Heart,
  Cpu,
  TrendingUp,
  Eye,
  Coins,
  Utensils,
  MessageCircle,
  Users,
  GraduationCap,
  Atom,
  Target,
  Briefcase,
  Crown
} from 'lucide-react';
import { APISettings } from '../types';
import { BookProject, BookSession, ReadingBookmark } from '../types/book';
import { bookService } from '../services/bookService';
import { BookAnalytics } from './BookAnalytics';
import { CustomSelect } from './CustomSelect';
import { pdfService } from '../services/pdfService';
import { readingProgressUtils } from '../utils/readingProgress';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================
type AppView = 'list' | 'create' | 'detail';
interface GenerationStatus {
  currentModule?: {
    id: string;
    title: string;
    attempt: number;
    progress: number;
    generatedText?: string;
  };
  totalProgress: number;
  status: 'idle' | 'generating' | 'completed' | 'error' | 'paused' | 'waiting_retry';
  logMessage?: string;
  totalWordsGenerated?: number;
  aiStage?: 'analyzing' | 'writing' | 'examples' | 'polishing' | 'complete';
  retryInfo?: {
    moduleTitle: string;
    error: string;
    retryCount: number;
    maxRetries: number;
    waitTime?: number;
  };
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
  dark: {
    bg: '#0F0F0F',
    contentBg: '#1A1A1A',
    text: '#E5E5E5',
    secondary: '#A0A0A0',
    border: '#333333',
    accent: '#6B7280',
  },
  sepia: {
    bg: '#F5F1E8',
    contentBg: '#FAF7F0',
    text: '#3C2A1E',
    secondary: '#8B7355',
    border: '#D4C4A8',
    accent: '#B45309',
  },
  light: {
    bg: '#FFFFFF',
    contentBg: '#F9F9F9',
    text: '#1A1A1A',
    secondary: '#555555',
    border: '#E0E0E0',
    accent: '#3B82F6',
  },
};
const FONT_FAMILIES = {
  mono: 'ui-monospace, "SF Mono", "Monaco", "Cascadia Code", monospace',
  nunito: "'Nunito', 'Segoe UI', sans-serif", // Smooth, rounded
  crimson: "'Crimson Pro', serif", // Old style professional
  rubik: "'Outfit', sans-serif", // The bold font from landing page (actually Outfit, checking index.html...)
};

const FONT_LABELS = {
  rubik: 'Rubik',
  nunito: 'Smooth',
  crimson: 'Book',
  mono: 'Code',
};
const MAX_WIDTHS = {
  narrow: '65ch',
  medium: '75ch',
  wide: '85ch',
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 1) return '--';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================
const GradientProgressBar = ({ progress = 0, active = true }: { progress?: number, active?: boolean }) => (
  <div className="relative w-full h-2.5 bg-[var(--color-card)] rounded-full overflow-hidden border border-[var(--color-border)]">
    <div
      className="absolute inset-0 bg-gradient-to-r from-gray-500 via-gray-400 to-gray-500 transition-all duration-700 ease-out"
      style={{
        width: `${progress}%`,
        backgroundSize: '200% 100%',
        animation: active ? 'gradient-flow 3s ease infinite' : 'none',
      }}
    />
  </div>
);

// Modern status loader for sidebar/list view - Grok style 3x3 dots
const StatusLoader = () => (
  <div className="status-loader">
    <div className="status-loader-dot" />
    <div className="status-loader-dot" />
    <div className="status-loader-dot" />
    <div className="status-loader-dot" />
    <div className="status-loader-dot" />
    <div className="status-loader-dot" />
    <div className="status-loader-dot" />
    <div className="status-loader-dot" />
    <div className="status-loader-dot" />
  </div>
);

const AIWaveAnimation = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  interface Pixel {
    id: number;
    color: string;
    opacity: string;
  }
  const [pixels, setPixels] = useState<Pixel[]>([]);

  useEffect(() => {
    // App-themed colors: orange, amber, gray palette (Grok vibe)
    const colors = [
      'bg-orange-500', 'bg-orange-400', 'bg-amber-500',
      'bg-amber-400', 'bg-orange-600', 'bg-amber-600',
      'bg-gray-500', 'bg-gray-600',
    ];

    const generatePixels = () => {
      if (containerRef.current) {
        const pixelSize = 10;
        const gap = 4;
        const pixelSpace = pixelSize + gap;
        const containerWidth = containerRef.current.offsetWidth;
        const containerHeight = containerRef.current.offsetHeight;

        const numCols = Math.floor(containerWidth / pixelSpace);
        const numRows = Math.floor(containerHeight / pixelSpace);
        const totalPixels = numCols * numRows;

        if (totalPixels > 0) {
          const newPixels = Array(totalPixels)
            .fill(0)
            .map((_, i) => ({
              id: i,
              color: colors[Math.floor(Math.random() * colors.length)],
              opacity: Math.random() > 0.4 ? 'opacity-100' : 'opacity-40',
            }));
          setPixels(newPixels);
        }
      }
    };

    const observer = new ResizeObserver(() => {
      generatePixels();
    });

    const currentContainer = containerRef.current;
    if (currentContainer) {
      observer.observe(currentContainer);
    }

    const interval = setInterval(generatePixels, 200);

    return () => {
      clearInterval(interval);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex flex-wrap content-start gap-1 w-full h-10 pl-1 overflow-hidden rounded-lg"
    >
      {pixels.map((p) => (
        <div
          key={p.id}
          className={`w-2.5 h-2.5 rounded-sm ${p.color} ${p.opacity} transition-all duration-150`}
        />
      ))}
    </div>
  );
};

// Contextual icon based on book title/topic
const getContextualIcon = (title: string): React.ElementType => {
  const t = title.toLowerCase();

  // Technology & Programming
  if (t.includes('code') || t.includes('program') || t.includes('software') || t.includes('develop')) return Code;
  if (t.includes('ai') || t.includes('artificial') || t.includes('machine') || t.includes('neural') || t.includes('learning')) return Brain;
  if (t.includes('data') || t.includes('analytics') || t.includes('statistics')) return TrendingUp;

  // Creative & Arts
  if (t.includes('music') || t.includes('song') || t.includes('melody')) return Music;
  if (t.includes('art') || t.includes('design') || t.includes('creative') || t.includes('paint')) return Palette;
  if (t.includes('photo') || t.includes('image') || t.includes('visual')) return Eye;

  // Business & Finance
  if (t.includes('business') || t.includes('startup') || t.includes('entrepreneur')) return TrendingUp;
  if (t.includes('money') || t.includes('finance') || t.includes('invest') || t.includes('wealth')) return Coins;
  if (t.includes('market') || t.includes('sales') || t.includes('growth')) return TrendingUp;

  // Health & Wellness
  if (t.includes('health') || t.includes('fitness') || t.includes('exercise') || t.includes('workout')) return Heart;
  if (t.includes('mental') || t.includes('mindful') || t.includes('meditation') || t.includes('calm')) return Sparkles;
  if (t.includes('nutrition') || t.includes('diet') || t.includes('food')) return Utensils;

  // Communication & Leadership
  if (t.includes('communication') || t.includes('speak') || t.includes('listen') || t.includes('conversation')) return MessageCircle;
  if (t.includes('leader') || t.includes('manage') || t.includes('team')) return Users;

  // Education & Learning
  if (t.includes('learn') || t.includes('study') || t.includes('education') || t.includes('teach')) return GraduationCap;
  if (t.includes('science') || t.includes('physics') || t.includes('chemistry') || t.includes('math')) return Atom;

  // Personal Development
  if (t.includes('habit') || t.includes('success') || t.includes('goal') || t.includes('future') || t.includes('mindset')) return Target;
  if (t.includes('career') || t.includes('job') || t.includes('profession')) return Briefcase;

  // Default to a book/sparkles icon
  return Sparkles;
};

const getBookCoverTone = (title: string) => {
  const t = title.toLowerCase();
  if (t.includes('finance') || t.includes('money') || t.includes('business')) return 'from-emerald-400/45 via-cyan-400/20 to-transparent';
  if (t.includes('ai') || t.includes('code') || t.includes('tech')) return 'from-orange-400/45 via-amber-300/25 to-transparent';
  if (t.includes('health') || t.includes('life')) return 'from-rose-400/40 via-orange-300/20 to-transparent';
  return 'from-blue-400/35 via-violet-300/20 to-transparent';
};

// Keep PixelAnimation as a legacy alias
const PixelAnimation = AIWaveAnimation;


const RetryDecisionPanel = ({
  retryInfo,
  onRetry,
  onSwitchModel,
  onSkip,
  availableModels,
}: {
  retryInfo: {
    moduleTitle: string;
    error: string;
    retryCount: number;
    maxRetries: number;
    waitTime?: number;
  };
  onRetry: () => void;
  onSwitchModel: () => void;
  onSkip: () => void;
  availableModels: Array<{ provider: string; model: string; name: string }>;
}) => {
  const [countdown, setCountdown] = useState(Math.ceil((retryInfo.waitTime || 0) / 1000));

  useEffect(() => {
    if (countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  const isRateLimit = retryInfo.error.toLowerCase().includes('rate limit') ||
    retryInfo.error.toLowerCase().includes('429');

  const isNetworkError = retryInfo.error.toLowerCase().includes('network') ||
    retryInfo.error.toLowerCase().includes('connection');

  return (
    <div className="bg-red-900/20 backdrop-blur-xl border border-red-500/50 rounded-xl overflow-hidden animate-fade-in-up">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 flex items-center justify-center bg-red-500/20 rounded-lg border border-red-500/30">
              <AlertCircle className="w-6 h-6 text-red-400 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Generation Failed</h3>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Attempt {retryInfo.retryCount} of {retryInfo.maxRetries}
              </p>
            </div>
          </div>
          <div className="px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-full text-xs font-semibold text-red-300">
            Waiting
          </div>
        </div>
        <div className="mb-4 p-4 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg">
          <h4 className="font-medium text-[var(--color-text-primary)] mb-2 flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            {retryInfo.moduleTitle}
          </h4>
          <div className="text-sm text-[var(--color-text-secondary)] mb-3">
            <span className="text-red-400 font-medium">Error:</span> {retryInfo.error}
          </div>
          <div className="flex items-center gap-2">
            {isRateLimit && (
              <div className="flex items-center gap-1.5 text-xs bg-yellow-500/10 text-yellow-400 px-2 py-1 rounded-md border border-yellow-500/20">
                <Clock className="w-3 h-3" />
                Rate Limit - Wait recommended
              </div>
            )}
            {isNetworkError && (
              <div className="flex items-center gap-1.5 text-xs bg-gray-500/10 text-gray-400 px-2 py-1 rounded-md border border-gray-500/20">
                <AlertTriangle className="w-3 h-3" />
                Network Issue
              </div>
            )}
          </div>
        </div>
        <div className="mb-6 p-4 bg-gray-500/5 border border-gray-500/20 rounded-lg">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
            <div className="text-sm text-[var(--color-text-secondary)]">
              <p className="font-medium text-[var(--color-text-primary)] mb-2">Recommended Actions:</p>
              <ul className="space-y-1.5 text-xs text-[var(--color-text-secondary)]">
                {isRateLimit && (
                  <>
                    <li>✓ Wait {countdown > 0 ? `${countdown}s` : 'a moment'} and retry with same model</li>
                    <li>✓ Or switch to a different AI model immediately</li>
                  </>
                )}
                {isNetworkError && (
                  <>
                    <li>✓ Check your internet connection</li>
                    <li>✓ Retry in a few seconds</li>
                  </>
                )}
                {!isRateLimit && !isNetworkError && (
                  <>
                    <li>✓ Try a different AI model</li>
                    <li>✓ Or retry after a short wait</li>
                  </>
                )}
                <li>⚠️ Skipping will mark this module as failed</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <button
            onClick={onRetry}
            disabled={countdown > 0}
            className="w-full btn bg-green-600 hover:bg-green-700 disabled:bg-[var(--color-card)] disabled:text-[var(--color-text-secondary)] disabled:cursor-not-allowed rounded-lg text-white font-semibold py-3 transition-all shadow-lg hover:shadow-green-500/30 flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            {countdown > 0 ? `Retry in ${countdown}s` : 'Retry Same Model'}
          </button>
          {availableModels.length > 0 && (
            <button
              onClick={onSwitchModel}
              className="w-full btn bg-gray-700 hover:bg-gray-800 rounded-lg text-white font-semibold py-3 transition-all shadow-lg hover:shadow-gray-500/30 flex items-center justify-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Switch AI Model ({availableModels.length} available)
            </button>
          )}
          <button
            onClick={onSkip}
            className="w-full btn border border-[var(--color-border)] hover:bg-[var(--color-card)] rounded-lg text-[var(--color-text-secondary)] font-medium py-3 transition-all hover:border-red-500/50 hover:text-red-400 flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" />
            Skip This Module
          </button>
        </div>
        <div className="mt-4 text-xs text-[var(--color-text-secondary)] flex items-center gap-1.5 justify-center">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
          <span>Your progress has been saved. You can also close this tab.</span>
        </div>
      </div>
    </div>
  );
};

const EmbeddedProgressPanel = ({
  generationStatus,
  stats,
  onCancel,
  onPause,
  onResume,
  onRetryDecision,
  availableModels,
  bookTitle,
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
  // Get contextual icon based on book title
  const ContextIcon = bookTitle ? getContextualIcon(bookTitle) : Sparkles;
  const streamBoxRef = useRef<HTMLDivElement>(null);

  const isPaused = generationStatus.status === 'paused';
  const isGenerating = generationStatus.status === 'generating';
  const isWaitingRetry = generationStatus.status === 'waiting_retry';

  useEffect(() => {
    if (streamBoxRef.current && generationStatus.currentModule?.generatedText) {
      streamBoxRef.current.scrollTop = streamBoxRef.current.scrollHeight;
    }
  }, [generationStatus.currentModule?.generatedText]);

  const overallProgress = (stats.completedModules / (stats.totalModules || 1)) * 100;

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
    <div className={`bg-[var(--color-card)] backdrop-blur-xl border rounded-xl overflow-hidden animate-fade-in-up ${isPaused ? 'border-slate-500/50' : 'border-[var(--color-border)]'
      }`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {isPaused ? (
              <div className="w-12 h-12 flex items-center justify-center bg-slate-500/20 rounded-lg border border-slate-500/30">
                <Pause className="w-6 h-6 text-slate-400" />
              </div>
            ) : (
              <div className="w-12 h-12 flex items-center justify-center bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 rounded-lg border border-cyan-500/30">
                <ContextIcon className="w-6 h-6 text-cyan-400 animate-pulse" />
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                {isPaused ? 'Generation Paused' : 'Generating Chapters...'}
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {stats.completedModules} of {stats.totalModules} complete
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1.5 border rounded-full text-xs font-semibold ${isPaused
              ? 'bg-slate-500/20 border-slate-500/30 text-slate-300'
              : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
              }`}>
              {Math.round(overallProgress)}%
            </div>
            <div className="text-sm font-mono text-[var(--color-text-secondary)]">
              {stats.totalWordsGenerated.toLocaleString()} words
            </div>
          </div>
        </div>
        <div className="mb-4">
          <GradientProgressBar
            progress={overallProgress}
            active={isGenerating}
          />
        </div>
        {isPaused && (
          <div className="mb-4 p-4 bg-slate-500/10 border border-slate-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <Pause className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-300 mb-1">
                  Generation Paused
                </p>
                <p className="text-xs text-slate-400/80">
                  Your progress is saved. You can resume anytime or close this tab safely.
                </p>
              </div>
            </div>
          </div>
        )}
        {isGenerating && generationStatus.currentModule && (
          <>
            <div className="mt-5 mb-4">
              <PixelAnimation />
            </div>
            {generationStatus.currentModule.generatedText && (
              <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                    <Zap className="w-4 h-4 text-cyan-400" />
                    {generationStatus.currentModule.title}
                  </h4>
                  {generationStatus.currentModule.attempt > 1 && (
                    <div className="flex items-center gap-1.5 text-xs text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded-md border border-cyan-500/20">
                      <RefreshCw className="w-3 h-3" />
                      <span>Attempt {generationStatus.currentModule.attempt}</span>
                    </div>
                  )}
                </div>
                <div
                  ref={streamBoxRef}
                  className="text-sm text-[var(--color-text-secondary)] leading-relaxed max-h-32 overflow-y-auto font-mono streaming-text-box"
                >
                  {generationStatus.currentModule.generatedText}
                  <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-1" />
                </div>
              </div>
            )}
          </>
        )}
        <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>
                {isPaused
                  ? `Paused • ${stats.completedModules}/${stats.totalModules} done`
                  : `${formatTime(stats.estimatedTimeRemaining)} remaining`
                }
              </span>
            </div>
            <div className="flex items-center gap-3">
              {(isGenerating || isPaused) && onCancel && (
                <button onClick={onCancel} className="px-4 py-2 border border-[var(--color-border)] hover:bg-[var(--color-card)] rounded-lg text-sm font-medium transition-all hover:border-red-500/50 hover:text-red-400" title="Stop generation and save progress" >
                  <X className="w-4 h-4 inline mr-1.5" /> Cancel
                </button>
              )}
              {isPaused ? (
                onResume && (
                  <button onClick={onResume} className="px-5 py-2.5 bg-green-600 hover:bg-green-700 rounded-lg text-white font-semibold transition-all shadow-lg hover:shadow-green-500/30 flex items-center gap-2" title="Resume generation from where you left off" >
                    <Play className="w-4 h-4" /> Resume Generation
                  </button>
                )
              ) : isGenerating && onPause && (
                <button
                  onClick={onPause}
                  className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/90 font-medium transition-all flex items-center gap-2"
                  title="Pause and save progress"
                >
                  <Pause className="w-4 h-4 opacity-70" /> Pause
                </button>
              )}
            </div>
          </div>
          <div className="mt-3 text-xs text-[var(--color-text-secondary)] flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>
              {isPaused
                ? 'Progress is saved. You can close this tab safely.'
                : 'You can pause anytime. Progress will be saved automatically.'
              }
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const CodeBlock = React.memo(({ children, className, theme, readingTheme }: { children: ReactNode, className?: string, theme: 'light' | 'dark', readingTheme?: string }) => {
  const [isCopied, setIsCopied] = useState(false);
  const language = className?.replace(/language-/, '') || 'text';

  const handleCopy = () => {
    if (isCopied) return;

    navigator.clipboard.writeText(String(children)).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  const themeStyles = {
    dark: {
      containerBg: '#0D1117',
      headerBg: 'rgba(22, 27, 34, 0.7)',
      headerText: '#8B949E',
      buttonHover: 'hover:bg-gray-700',
    },
    sepia: {
      containerBg: '#F0EAD6',
      headerBg: 'rgba(232, 225, 209, 0.7)',
      headerText: '#8B7355',
      buttonHover: 'hover:bg-[#D4C4A8]',
    },
    light: {
      containerBg: '#f8f8f8',
      headerBg: 'rgba(239, 239, 239, 0.7)',
      headerText: '#555555',
      buttonHover: 'hover:bg-gray-200',
    }
  };

  const currentThemeStyles = themeStyles[readingTheme as keyof typeof themeStyles] || themeStyles.dark;

  return (
    <div
      className={`relative rounded-lg my-4 code-block-container overflow-hidden`}
      style={{
        backgroundColor: currentThemeStyles.containerBg,
      }}
    >
      <div
        className={`flex items-center justify-between px-4 py-2 backdrop-blur-sm`}
        style={{
          backgroundColor: currentThemeStyles.headerBg,
          color: currentThemeStyles.headerText
        }}
      >
        <span className="text-xs font-semibold uppercase tracking-wider">{language}</span>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 p-1.5 rounded-md text-xs transition-all ${currentThemeStyles.buttonHover} ${isCopied ? 'text-green-400' : ''}`}
          title="Copy code"
        >
          {isCopied ? <Check size={14} /> : <Copy size={14} />}
          {isCopied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <SyntaxHighlighter
        style={readingTheme === 'light' || readingTheme === 'sepia' ? prism : vscDarkPlus}
        language={language}
        PreTag="div"
        className={`!m-0 !p-0`}
        customStyle={{
          backgroundColor: 'transparent',
          padding: '1rem 1.5rem',
          fontSize: '0.875rem',
          lineHeight: '1.5',
        }}
        codeTagProps={{
          style: {
            fontFamily: 'inherit'
          }
        }}
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    </div>
  );
});

// ✅ FIXED READING MODE WITH WORKING BOOKMARKS
const ReadingMode: React.FC<ReadingModeProps> = ({
  content,
  isEditing,
  editedContent,
  onEdit,
  onSave,
  onCancel,
  onContentChange,
  onGoBack,
  theme,
  bookId,
  currentModuleIndex
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<ReadingSettings>(() => {
    const saved = localStorage.getItem('pustakam-reading-settings');
    const parsed = saved ? JSON.parse(saved) : {};
    return {
      fontSize: 18,
      lineHeight: 1.8,
      fontFamily: 'nunito', // Defaulting to Nunito as requested
      theme: theme === 'dark' ? 'dark' : 'light',
      maxWidth: 'medium',
      textAlign: 'left',
      fontWeight: 500, // Slightly lighter for Nunito
      ...parsed,
    };
  });

  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showFloatingButtons, setShowFloatingButtons] = useState(false);
  const [bookmark, setBookmark] = useState<ReadingBookmark | null>(null);


  // ✅ FIX: Helper functions to get the correct scrolling element
  const getScrollEventsTarget = (): HTMLElement | Window => {
    return document.getElementById('main-scroll-area') || window;
  };

  const getScrollableElement = (): HTMLElement => {
    // document.documentElement is for window scrolling (reports scrollTop)
    // main-scroll-area is for the main element scrolling
    return document.getElementById('main-scroll-area') || document.documentElement;
  };

  // ✅ FIX: Load bookmark on mount
  useEffect(() => {
    const currentBookmark = readingProgressUtils.getBookmark(bookId);
    setBookmark(currentBookmark);

    if (currentBookmark && currentBookmark.moduleIndex === currentModuleIndex) {
      setIsBookmarked(true);
    } else {
      setIsBookmarked(false);
    }
  }, [bookId, currentModuleIndex]);

  // ✅ FIX: Show floating buttons after component mounts
  useEffect(() => {
    if (!isEditing) {
      setShowFloatingButtons(true);
    } else {
      setShowFloatingButtons(false);
    }
  }, [isEditing]);

  // ✅ FIX: Auto-save scroll position (debounced) - NOW USES CORRECT SCROLL ELEMENT
  useEffect(() => {
    if (isEditing) return;

    const scrollTarget = getScrollEventsTarget();
    const scrollElement = getScrollableElement();
    let scrollTimeout: NodeJS.Timeout;

    const handleScroll = () => {
      // setIsScrolling(true); // removed
      clearTimeout(scrollTimeout);

      scrollTimeout = setTimeout(() => {
        const scrollPosition = scrollElement.scrollTop; // ✅ Corrected
        if (scrollPosition > 100) {
          readingProgressUtils.saveBookmark(bookId, currentModuleIndex, scrollPosition);
          console.log('✓ Auto-saved bookmark at:', scrollPosition);
        }
        // setIsScrolling(false); // removed
      }, 500);
    };

    scrollTarget.addEventListener('scroll', handleScroll, { passive: true }); // ✅ Corrected

    return () => {
      clearTimeout(scrollTimeout);
      scrollTarget.removeEventListener('scroll', handleScroll); // ✅ Corrected
    };
  }, [bookId, currentModuleIndex, isEditing]);

  useEffect(() => {
    localStorage.setItem('pustakam-reading-settings', JSON.stringify(settings));
  }, [settings]);

  // ✅ FIX: Toggle bookmark with proper feedback - NOW USES CORRECT SCROLL ELEMENT
  const toggleBookmark = () => {
    const scrollPosition = getScrollableElement().scrollTop; // ✅ Corrected

    if (isBookmarked) {
      // Remove bookmark
      readingProgressUtils.deleteBookmark(bookId);
      setIsBookmarked(false);
      setBookmark(null);

      // showToast('Bookmark removed', '🔖');

    } else {
      // Add bookmark
      readingProgressUtils.saveBookmark(bookId, currentModuleIndex, scrollPosition);

      const newBookmark = readingProgressUtils.getBookmark(bookId);
      setBookmark(newBookmark);
      setIsBookmarked(true);

      // showToast(`Bookmark saved at ${Math.round(scrollPosition)}px`, '✅');
    }
  };

  // ✅ FIX: Go to bookmark with smooth scroll - NOW USES CORRECT SCROLL ELEMENT
  const handleGoToBookmark = () => {
    if (bookmark) {
      console.log('📍 Going to bookmark:', bookmark.scrollPosition);

      getScrollableElement().scrollTo({ // ✅ Corrected
        top: bookmark.scrollPosition,
        behavior: 'smooth'
      });

      // showToast('Jumped to last position', '📖', 'bg-orange-500/95');
    }
  };

  // ✅ NEW: Toast notification helper
  const showToast = (message: string, icon: string = '✓', bgColor: string = 'bg-green-500/95') => {
    const toast = document.createElement('div');
    toast.className = 'bookmark-toast';
    toast.style.background = bgColor;
    toast.innerHTML = `
      <div class="flex items-center gap-2">
        <span style="font-size: 16px;">${icon}</span>
        <span>${message}</span>
      </div>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('hiding');
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 300);
    }, 2000);
  };

  const currentTheme = THEMES[settings.theme];

  if (isEditing) {
    return (
      <div className="animate-fade-in">
        <div className="flex justify-between items-center mb-4 sticky top-0 bg-[var(--color-bg)] z-30 pt-4 pb-2 border-b border-[var(--color-border)]">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-[var(--color-text-primary)]">
            <Edit className="w-5 h-5" />
            Editing Mode
          </h3>
          <div className="flex gap-3">
            <button onClick={onCancel} className="btn btn-secondary">
              <X size={16} /> Cancel
            </button>
            <button onClick={onSave} className="btn btn-primary">
              <Save size={16} /> Save Changes
            </button>
          </div>
        </div>
        <textarea
          className="w-full h-[70vh] bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-4 text-[var(--color-text-primary)] font-mono text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
          value={editedContent}
          onChange={(e) => onContentChange(e.target.value)}
          style={{ fontSize: `${settings.fontSize - 2}px` }}
        />
      </div>
    );
  }

  const readingAreaStyles = {
    backgroundColor: currentTheme.bg,
    color: currentTheme.text,
  };

  const contentStyles = {
    fontFamily: FONT_FAMILIES[settings.fontFamily],
    fontSize: `${settings.fontSize}px`,
    lineHeight: settings.lineHeight,
    maxWidth: MAX_WIDTHS[settings.maxWidth],
    textAlign: settings.textAlign as any,
    color: currentTheme.text,
  };

  return (
    <>
      <div
        className={`reading-container theme-${settings.theme} overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.03] shadow-[0_20px_80px_rgba(0,0,0,0.22)] transition-colors duration-300`}
        style={readingAreaStyles}
      >
        <div
          className="z-20 flex flex-wrap justify-between items-center px-3 py-2 sm:px-4 border-b"
          style={{ borderColor: currentTheme.border, backgroundColor: currentTheme.bg }}
        >
          {/* Left Controls: Theme and Zoom */}
          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-0"> {/* Added mb-2 for mobile stacking */}
            <div className="flex items-center gap-0.5 p-0.5 sm:p-1 rounded-lg" style={{ backgroundColor: currentTheme.contentBg }}>
              {(['light', 'sepia', 'dark'] as const).map((themeOption) => (
                <button
                  key={themeOption}
                  onClick={() => setSettings(prev => ({ ...prev, theme: themeOption }))}
                  className={`p-1.5 sm:p-2 rounded-md transition-all`}
                  style={{
                    backgroundColor: settings.theme === themeOption ? currentTheme.accent : 'transparent',
                    color: settings.theme === themeOption ? '#FFFFFF' : currentTheme.secondary,
                  }}
                  title={`${themeOption.charAt(0).toUpperCase() + themeOption.slice(1)} theme`}
                >
                  {themeOption === 'light' ? <Sun size={16} /> : themeOption === 'sepia' ? <Palette size={16} /> : <Moon size={16} />}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 sm:gap-2 ml-2">
              <button
                onClick={() => setSettings(prev => ({ ...prev, fontSize: Math.max(12, prev.fontSize - 1) }))}
                className="p-1.5 sm:p-2 rounded-lg transition-colors hover:bg-black/5" style={{ color: currentTheme.secondary }}
                title="Decrease font size"
              >
                <ZoomOut size={16} />
              </button>
              <span className="min-w-[2.5rem] text-center text-sm font-mono" style={{ color: currentTheme.secondary }}>{settings.fontSize}px</span>
              <button
                onClick={() => setSettings(prev => ({ ...prev, fontSize: Math.min(28, prev.fontSize + 1) }))}
                className="p-1.5 sm:p-2 rounded-lg transition-colors hover:bg-black/5" style={{ color: currentTheme.secondary }}
                title="Increase font size"
              >
                <ZoomIn size={16} />
              </button>
            </div>
          </div>

          {/* Font Family Selector - NEW */}
          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-0 ml-4 hidden md:flex">
            {/* Font Selector Dropdown */}
            <div className="relative group">
              <button
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border"
                style={{
                  backgroundColor: currentTheme.contentBg,
                  color: currentTheme.text,
                  borderColor: currentTheme.border
                }}
              >
                <span className="opacity-70">Font:</span>
                <span>{FONT_LABELS[settings.fontFamily as keyof typeof FONT_LABELS] || 'Custom'}</span>
                <ChevronDown size={14} className="opacity-50" />
              </button>

              {/* Dropdown Menu */}
              <div
                className="absolute top-full left-0 mt-2 w-48 rounded-xl shadow-xl border overflow-hidden z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-left"
                style={{
                  backgroundColor: currentTheme.contentBg,
                  borderColor: currentTheme.border
                }}
              >
                {(['rubik', 'nunito', 'crimson', 'mono'] as const).map((font) => (
                  <button
                    key={font}
                    onClick={() => setSettings(prev => ({ ...prev, fontFamily: font }))}
                    className="w-full text-left px-4 py-2.5 text-sm hover:brightness-95 flex items-center justify-between"
                    style={{
                      fontFamily: FONT_FAMILIES[font],
                      color: settings.fontFamily === font ? currentTheme.accent : currentTheme.text,
                      backgroundColor: settings.fontFamily === font ? `${currentTheme.accent}15` : 'transparent'
                    }}
                  >
                    <span>{FONT_LABELS[font]}</span>
                    {settings.fontFamily === font && <Check size={14} />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Controls: Go to Bookmark & Edit */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
            {bookmark && (
              <button
                onClick={handleGoToBookmark}
                className="btn btn-secondary btn-sm flex items-center gap-1 sm:gap-2"
                style={{ borderColor: currentTheme.border, color: currentTheme.secondary }}
                title={`Go to last read position (${Math.round(bookmark.percentComplete)}% complete)`}
              >
                <Bookmark size={14} />
                <span className="hidden md:flex">Go to Bookmark</span> {/* Hidden on small, shown on medium+ */}
              </button>
            )}

            <button onClick={onEdit} className="btn btn-secondary btn-sm flex items-center gap-1 sm:gap-2" style={{ borderColor: currentTheme.border, color: currentTheme.secondary }} title="Edit Content">
              <Edit size={14} />
              <span className="hidden md:flex">Edit</span> {/* Hidden on small, shown on medium+ */}
            </button>
          </div>
        </div>
        <div ref={contentRef} className="p-4 sm:p-8">
          <article
            className={`prose prose-lg max-w-none transition-all duration-300 mx-auto ${settings.theme === 'dark' || settings.theme === 'sepia' ? 'prose-invert' : ''
              }`}
            style={contentStyles}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // Note: react-markdown v9+ removed `inline` prop
                // Block code has className like "language-xxx", inline code doesn't
                code: ({ node, className, children, ...props }) => {
                  // Check if it's a code block (has language class) vs inline code
                  const isCodeBlock = className?.includes('language-');
                  if (!isCodeBlock) {
                    return <code className={className} {...props}>{children}</code>;
                  }
                  return <CodeBlock {...props} theme={theme} readingTheme={settings.theme} className={className}>{children}</CodeBlock>;
                }
              }}
              className="focus:outline-none"
            >
              {content}
            </ReactMarkdown>
          </article>
        </div>
      </div>

      {/* ✅ MINIMAL Back Button */}
      <div
        className={`reading-back-btn transition-all duration-300 ${showFloatingButtons ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
      >
        <button
          onClick={onGoBack}
          className="reading-floating-btn"
          title="Back to Library"
          aria-label="Back to Library"
        >
          <ArrowLeft size={18} />
          <span className="tooltip">Back</span>
        </button>
      </div>

      {/* ✅ MINIMAL Floating Controls (Bookmark) */}
      <div
        className={`reading-floating-controls transition-all duration-300 ${showFloatingButtons ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
      >
        <button
          onClick={toggleBookmark}
          className={`reading-floating-btn ${isBookmarked ? 'bookmark-active' : ''}`}
          title={isBookmarked ? 'Remove Bookmark' : 'Add Bookmark'}
          aria-label={isBookmarked ? 'Remove Bookmark' : 'Add Bookmark'}
        >
          {isBookmarked ? (
            <BookmarkCheck size={18} className="bookmark-check-icon" />
          ) : (
            <Bookmark size={18} />
          )}
          <span className="tooltip">
            {isBookmarked ? 'Bookmarked' : 'Bookmark'}
          </span >
        </button>
      </div>
    </>
  );
};

const HomeView = ({
  onNewBook,
  onShowList,
  hasApiKey,
  bookCount,
  theme,
  formData,
  setFormData,
  showAdvanced,
  setShowAdvanced,
  handleCreateRoadmap,
  handleEnhanceWithAI,
  isEnhancing,
  localIsGenerating,
  onOpenSettings,
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
    className={`flex-1 flex flex-col items-center px-6 pb-12 w-full transition-all duration-500 ${showAdvanced ? 'min-h-screen overflow-y-auto pt-24' : 'h-screen overflow-hidden pt-20'
      }`}
    style={{ background: 'var(--color-bg)', fontFamily: 'Rubik, sans-serif' }}
  >
    {/* Dynamic Spacer — centers content below the fixed 80px header */}
    <div
      className="transition-all duration-700 ease-in-out overflow-hidden"
      style={{
        height: showAdvanced ? '0' : 'max(8vh, 0px)',
        minHeight: showAdvanced ? '0' : 0,
        opacity: showAdvanced ? 0 : 1,
        flexShrink: 1
      }}
    />
    <div className="w-full max-w-2xl mx-auto animate-subtle-fade">
      <div className="text-center mb-8">
        <div className="mb-5 hidden items-center justify-center md:flex">
          <span className="inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-400/10 px-4 py-1.5 text-[11px] uppercase tracking-[0.22em] text-orange-200/90">
            <Sparkles className="h-3.5 w-3.5" />
            Pustakam Injin
          </span>
        </div>
        <img
          src={theme === 'dark' ? '/white-logo.png' : '/black-logo.png'}
          alt="Pustakam"
          className="w-14 h-14 mx-auto mb-5"
        />
        <h1 className="text-4xl md:text-[56px] font-bold text-[var(--color-text-primary)] tracking-tight leading-[0.96]">
          Build Better<br />
          <span className="text-orange-500">Learning Books.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[var(--color-text-secondary)] md:text-base">
          Start with one idea. Injin turns it into a clean, structured book.
        </p>
      </div>

      {/* Glass-effect boxy Input Bar */}
      <div className="grok-input-bar">

        <textarea
          value={formData.goal}
          onChange={(e) => {
            setFormData((p) => ({ ...p, goal: e.target.value }));
            // Auto-resize the textarea
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
          }}
          onKeyDown={(e) => {
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

        {/* Enhance Idea button */}
        <button
          onClick={() => {
            if (!showAdvanced) setShowAdvanced(true);
            handleEnhanceWithAI();
          }}
          disabled={!formData.goal.trim() || isEnhancing || !hasApiKey}
          className="grok-input-icon shrink-0 flex items-center gap-1.5 text-sm"
          title="Refine your prompt with AI and open guided options"
        >
          {isEnhancing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">{isEnhancing ? 'Refining...' : 'Enhance'}</span>
        </button>
      </div>

      {/* Action Chips */}
      <div className="grok-chips">
        {/* Auto/Options chip (moved from input bar) */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="grok-chip"
        >
          <Settings size={16} />
          Guided
          <ChevronDown size={12} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>

        {bookCount > 0 && (
          <button onClick={onShowList} className="grok-chip">
            <List size={16} />
            My Library ({bookCount})
          </button>
        )}

        <button onClick={onOpenSettings} className="grok-chip">
          <Settings size={16} />
          Settings
        </button>
      </div>

      {/* Advanced Options Dropdown */}
      {showAdvanced && (
        <div
          className="mt-6 p-6 bg-[var(--color-card)] border border-[var(--color-border)] rounded-[28px] shadow-xl"
          style={{
            animation: 'dropdownSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            transformOrigin: 'top center'
          }}
        >
          {/* Configuration Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="audience" className="block text-sm font-semibold mb-2 text-[var(--color-text-primary)]">
                Target Audience
              </label>
              <input
                id="audience"
                type="text"
                value={formData.targetAudience}
                onChange={(e) => setFormData((p) => ({ ...p, targetAudience: e.target.value }))}
                placeholder="e.g. Beginners, Professionals"
                className="w-full h-11 bg-[var(--color-bg)] border-2 border-[var(--color-border)] rounded-xl px-4 text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)]/50 focus:border-[var(--color-text-secondary)]/50 focus:ring-4 focus:ring-[var(--color-text-secondary)]/10 transition-all outline-none"
              />
            </div>
            <div>
              <label htmlFor="complexity" className="block text-sm font-semibold mb-2 text-[var(--color-text-primary)]">
                Complexity Level
              </label>
              <CustomSelect
                value={formData.complexityLevel || 'intermediate'}
                onChange={(val) => setFormData((p) => ({ ...p, complexityLevel: val as any }))}
                options={[
                  { value: 'beginner', label: 'Beginner' },
                  { value: 'intermediate', label: 'Intermediate' },
                  { value: 'advanced', label: 'Advanced' },
                ]}
              />
            </div>
          </div>

          {/* Context & Goals */}
          <div className="mb-4">
            <label htmlFor="reasoning" className="block text-sm font-semibold mb-2 text-[var(--color-text-primary)]">
              Context & Goals (Optional)
            </label>
            <textarea
              id="reasoning"
              value={formData.reasoning}
              onChange={(e) => setFormData((p) => ({ ...p, reasoning: e.target.value }))}
              placeholder="Why are you writing this book? What should the reader achieve?"
              className="w-full bg-[var(--color-bg)] border-2 border-[var(--color-border)] rounded-xl p-4 text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)]/50 focus:border-[var(--color-text-secondary)]/50 focus:ring-4 focus:ring-[var(--color-text-secondary)]/10 transition-all outline-none resize-none text-sm"
              rows={3}
            />
          </div>

          {/* Personality & Language */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 pt-4 border-t border-[var(--color-border)]">
            <div>
              <label className="block text-sm font-semibold mb-2 text-[var(--color-text-primary)]">
                Generation Mode
              </label>
              <div className="flex p-1 bg-[var(--color-bg)] border-2 border-[var(--color-border)] rounded-xl">
                <button
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, generationMode: 'stellar', language: 'en' }))}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${formData.generationMode === 'stellar'
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/30 shadow-inner'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                    }`}
                >
                  <Sparkles size={14} />
                  Stellar
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, generationMode: 'blackhole' }))}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${formData.generationMode === 'blackhole'
                    ? 'bg-gradient-to-r from-orange-500/20 to-purple-500/20 text-orange-400 border border-orange-500/30 shadow-inner'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                    }`}
                >
                  <Crown size={14} />
                  Blackhole
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-[var(--color-text-primary)]">
                Output Language
              </label>
              <CustomSelect
                value={formData.language || 'en'}
                onChange={(val) => setFormData((p) => ({ ...p, language: val as any }))}
                options={[
                  { value: 'en', label: 'English (Standard)' },
                  ...(formData.generationMode === 'blackhole' ? [
                    { value: 'hi', label: 'Hindi (Tapori)' },
                    { value: 'mr', label: 'Marathi (Tapori)' }
                  ] : [])
                ]}
              />
            </div>
          </div>

          {/* Structure Preferences */}
          <div>
            <label className="block text-sm font-semibold mb-3 text-[var(--color-text-primary)]">
              Structure Preferences
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${formData.preferences?.includeExamples ? 'border-[var(--color-text-secondary)]/50 bg-[var(--color-text-secondary)]/5' : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-text-secondary)]/30'}`}>
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${formData.preferences?.includeExamples ? 'border-[var(--color-text-primary)] bg-[var(--color-text-primary)] text-[var(--color-bg)]' : 'border-[var(--color-text-secondary)]/50'}`}>
                  {formData.preferences?.includeExamples && <Check size={12} strokeWidth={3} />}
                </div>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={formData.preferences?.includeExamples}
                  onChange={(e) => setFormData((p) => ({ ...p, preferences: { ...p.preferences!, includeExamples: e.target.checked } }))}
                />
                <span className="text-sm font-medium text-[var(--color-text-primary)]">Include Examples</span>
              </label>

              <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${formData.preferences?.includePracticalExercises ? 'border-[var(--color-text-secondary)]/50 bg-[var(--color-text-secondary)]/5' : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-text-secondary)]/30'}`}>
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${formData.preferences?.includePracticalExercises ? 'border-[var(--color-text-primary)] bg-[var(--color-text-primary)] text-[var(--color-bg)]' : 'border-[var(--color-text-secondary)]/50'}`}>
                  {formData.preferences?.includePracticalExercises && <Check size={12} strokeWidth={3} />}
                </div>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={formData.preferences?.includePracticalExercises}
                  onChange={(e) => setFormData((p) => ({ ...p, preferences: { ...p.preferences!, includePracticalExercises: e.target.checked } }))}
                />
                <span className="text-sm font-medium text-[var(--color-text-primary)]">Practical Exercises</span>
              </label>
            </div>
          </div>

          {/* New Generate Button in Advanced Options */}
          <div className="mt-8 pt-4 border-t border-[var(--color-border)]">
            <button
              onClick={() => {
                if (hasApiKey) {
                  handleCreateRoadmap(formData);
                } else {
                  onOpenSettings();
                }
              }}
              disabled={!formData.goal.trim() || localIsGenerating}
              className="w-full h-12 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold rounded-xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {localIsGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              <span className="text-base">Generate Book Roadmap</span>
            </button>
            {!hasApiKey && (
              <p className="text-center text-xs text-orange-400 mt-2">
                * Enable the Injin Stack proxy in setup before generating.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Footer hint */}
      <p className="text-center text-xs text-[var(--color-text-secondary)] mt-8 opacity-60">
        Press Enter to generate • Secure GLM proxy required
      </p>
    </div>
  </div>
);

const BookListGrid = ({
  books,
  onSelectBook,
  onDeleteBook,
  setView,
  setShowListInMain,
}: {
  books: BookProject[];
  onSelectBook: (id: string) => void;
  onDeleteBook: (id: string) => void;
  setView: (view: AppView) => void;
  setShowListInMain: (show: boolean) => void;
}) => {
  const [, setHoveredBookId] = useState<string | null>(null);


  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'in-progress' | 'completed' | 'error'>('all');

  const filteredBooks = React.useMemo(() => {
    return books.filter(book => {
      const matchesSearch = book.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'in-progress' && ['generating_roadmap', 'generating_content', 'assembling'].includes(book.status)) ||
        (statusFilter === 'completed' && book.status === 'completed') ||
        (statusFilter === 'error' && book.status === 'error');
      return matchesSearch && matchesStatus;
    });
  }, [books, searchQuery, statusFilter]);

  const getBookIcon = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes('ai') || t.includes('intelligence') || t.includes('machine') || t.includes('neural')) return Brain;
    if (t.includes('code') || t.includes('program') || t.includes('js') || t.includes('python') || t.includes('react') || t.includes('dev')) return Code;
    if (t.includes('music') || t.includes('song')) return Music;
    if (t.includes('heart') || t.includes('health') || t.includes('fitness') || t.includes('life')) return Heart;
    if (t.includes('money') || t.includes('finance') || t.includes('business') || t.includes('invest')) return TrendingUp;
    if (t.includes('art') || t.includes('design') || t.includes('paint')) return Palette;
    if (t.includes('tech') || t.includes('digital') || t.includes('hardware')) return Cpu;
    if (t.includes('science') || t.includes('math') || t.includes('physics')) return Sparkles;
    return Book;
  };

  const getStatusBadge = (status: BookProject['status']) =>
    ({
      planning: 'Draft',
      generating_roadmap: 'Roadmap',
      roadmap_completed: 'Ready',
      generating_content: 'Writing',
      assembling: 'Assembling',
      completed: 'Completed',
      error: 'Needs Fix',
    }[status] || 'Unknown');

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--color-bg)', fontFamily: 'Rubik, sans-serif' }}>
      <div className="flex-shrink-0 w-full sticky top-0 z-40 bg-[var(--color-bg)]/92 pb-6 pt-6 px-8 lg:px-12 backdrop-blur-xl transition-colors duration-300">
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
              <input
                type="text"
                placeholder="Search books"
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                className="w-52 rounded-full border border-gray-200 bg-gray-100 pl-10 pr-4 py-2 text-sm text-gray-900 placeholder-gray-500 transition-all focus:w-60 focus:border-orange-500/40 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:focus:border-orange-400/40"
              />
            </div>
            <button onClick={() => setShowListInMain(false)} className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-500 transition-all hover:border-gray-300 hover:text-gray-900 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-400 dark:hover:border-white/20 dark:hover:text-white">
              <ArrowLeft className="w-4 h-4 inline mr-2" /> Back
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="w-full max-w-[1400px] mx-auto px-8 lg:px-12 pb-10">
          {filteredBooks.length === 0 ? (
            <div className="text-center py-24 bg-gray-50 dark:bg-white/[0.02] rounded-2xl border border-gray-200 dark:border-white/5 border-dashed">
              <div className="w-16 h-16 mx-auto mb-6 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center border border-gray-200 dark:border-white/10">
                <BookOpen className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{searchQuery || statusFilter !== 'all' ? 'No books found' : 'No books yet'}</h3>
              <p className="text-gray-500 mb-6 max-w-sm mx-auto text-sm">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your search.'
                  : 'Create your first AI-generated book to get started.'}
              </p>
              <button
                onClick={() => {
                  setView('create');
                  setShowListInMain(false);
                }}
                className="px-5 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white border border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 rounded-full transition-all inline-flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Create Book
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {filteredBooks.map((book) => {
                const completedModules = book.modules.filter((m) => m.status === 'completed').length;
                const totalModules = book.modules.length;
                const wordCount = book.modules.reduce((acc, m) => acc + (m.wordCount || 0), 0) || book.totalWords || 0;
                const Icon = getBookIcon(book.title);
                const completionRatio = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

                return (
                  <div
                    key={book.id}
                    onMouseEnter={() => setHoveredBookId(book.id)}
                    onMouseLeave={() => setHoveredBookId(null)}
                    onClick={() => onSelectBook(book.id)}
                    className="group relative cursor-pointer overflow-hidden rounded-[20px] border border-gray-200/80 bg-white/96 p-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-orange-500/20 dark:border-white/[0.08] dark:bg-white/[0.025] dark:hover:border-white/[0.14] dark:hover:bg-white/[0.04]"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`relative h-20 w-[60px] shrink-0 overflow-hidden rounded-[16px] border border-white/10 bg-gradient-to-br ${getBookCoverTone(book.title)} shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]`}>
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.2),transparent_38%),linear-gradient(180deg,rgba(8,8,8,0.02),rgba(8,8,8,0.44))]" />
                        <div className="absolute inset-x-0 bottom-0 p-2">
                          <div className="mb-1 inline-flex rounded-full border border-white/15 bg-black/20 p-1 text-white/90 backdrop-blur-md">
                            <Icon className="h-2.5 w-2.5" />
                          </div>
                          <p className="line-clamp-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/90">
                            {book.title}
                          </p>
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="inline-flex items-center rounded-full border border-orange-500/15 bg-orange-500/[0.07] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-orange-300">
                            {getStatusBadge(book.status)}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteBook(book.id);
                            }}
                            className="rounded-full p-2 text-gray-400 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        <h3 className="line-clamp-2 text-[15px] font-semibold leading-tight text-[var(--color-text-primary)]" style={{ fontFamily: 'Rubik, sans-serif' }}>
                          {book.title}
                        </h3>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-[10px] font-medium text-[var(--color-text-secondary)]">
                            <FileText size={10} />
                            {totalModules} modules
                          </span>
                          {wordCount > 0 && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-[10px] font-medium text-[var(--color-text-secondary)]">
                              <Sparkles size={10} />
                              {wordCount.toLocaleString()}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-[10px] font-medium text-[var(--color-text-secondary)]">
                            <Clock size={10} />
                            {new Date(book.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 border-t border-white/[0.08] pt-3">
                      <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
                        <span>{completedModules}/{Math.max(totalModules, 1)} done</span>
                        <span>{completionRatio}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-orange-500 via-orange-400 to-amber-300 transition-all"
                          style={{ width: `${completionRatio}%` }}
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-end text-[11px] font-medium text-[var(--color-text-secondary)]">
                        <span className="text-orange-400 transition-colors group-hover:text-orange-300">
                          Open {'->'}
                        </span>
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



const DetailTabButton = ({
  label,
  Icon,
  isActive,
  onClick,
}: {
  label: ReactNode;
  Icon: React.ElementType;
  isActive: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${isActive
      ? 'border-orange-500/25 bg-orange-500/[0.08] text-[var(--color-text-primary)] shadow-[0_12px_32px_rgba(249,115,22,0.08)]'
      : 'border-white/[0.08] bg-white/[0.025] text-[var(--color-text-secondary)] hover:border-white/[0.14] hover:text-[var(--color-text-primary)]'
      }`}
  >
    <Icon className="w-4 h-4" />
    {label}
  </button>
);

export function BookView({
  books,
  currentBookId,
  onCreateBookRoadmap,
  onGenerateAllModules,
  onRetryFailedModules,
  onAssembleBook,
  onSelectBook,
  onDeleteBook,
  onUpdateBookStatus,
  hasApiKey,
  view,
  setView,
  onUpdateBookContent,
  showListInMain,
  setShowListInMain,
  isMobile = false,
  generationStatus,
  generationStats,
  onPauseGeneration,
  onResumeGeneration,
  isGenerating,
  onRetryDecision,
  availableModels,
  theme,
  onOpenSettings,
  showAlertDialog,
  showToast, // ✅ Destructure showToast
  onReadingModeChange,
  settings
}: BookViewProps) {
  const [detailTab, setDetailTab] = useState<'overview' | 'analytics' | 'read'>('overview');
  const [localIsGenerating, setLocalIsGenerating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formData, setFormData] = useState<BookSession>({
    goal: '',
    language: settings?.defaultLanguage || 'en',
    targetAudience: '',
    complexityLevel: 'intermediate',
    reasoning: '',
    generationMode: settings?.defaultGenerationMode || 'stellar',
    preferences: {
      includeExamples: true,
      includePracticalExercises: false,
      includeQuizzes: false,
    },
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const currentBook = currentBookId ? books.find(b => b.id === currentBookId) : null;
  const [pdfProgress, setPdfProgress] = useState(0);

  // Sync mode and language with global settings
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      generationMode: settings?.defaultGenerationMode || 'stellar',
      language: settings?.defaultLanguage || 'en'
    }));
  }, [settings?.defaultGenerationMode, settings?.defaultLanguage]);

  const [isEnhancing, setIsEnhancing] = React.useState(false);

  const handleStartGeneration = () => {
    if (!currentBook?.roadmap) {
      console.error('No roadmap available to generate modules.');
      // showToast('No roadmap available to generate modules.', 'error');
      return;
    }

    const session: BookSession = {
      goal: currentBook.goal,
      language: 'en',
      targetAudience: '',
      complexityLevel: currentBook.roadmap.difficultyLevel || 'intermediate',
      preferences: {
        includeExamples: true,
        includePracticalExercises: false,
        includeQuizzes: false
      },
      reasoning: currentBook.reasoning,
      generationMode: currentBook.generationMode
    };

    onGenerateAllModules(currentBook, session);
  };

  const handleStartAssembly = () => {
    if (!currentBook) return;

    const session: BookSession = {
      goal: currentBook.goal,
      language: 'en',
      targetAudience: '',
      complexityLevel: currentBook.roadmap?.difficultyLevel || 'intermediate',
      preferences: {
        includeExamples: true,
        includePracticalExercises: false,
        includeQuizzes: false
      },
      reasoning: currentBook.reasoning,
      generationMode: currentBook.generationMode
    };

    onAssembleBook(currentBook, session);
  };

  useEffect(() => {
    if (currentBook) {
      const isGen = ['generating_roadmap', 'generating_content', 'assembling'].includes(
        currentBook.status
      );
      setLocalIsGenerating(isGen);
      setIsEditing(false);

      if (currentBook.status === 'completed') {
        const bookmark = readingProgressUtils.getBookmark(currentBook.id);
        setDetailTab(bookmark ? 'read' : 'overview');
      } else {
        setDetailTab('overview');
      }
    } else {
      setDetailTab('overview');
    }
  }, [currentBook]);

  // Notify parent about reading mode state
  useEffect(() => {
    if (onReadingModeChange) {
      onReadingModeChange(detailTab === 'read' && view === 'detail' && !!currentBook);
    }
  }, [detailTab, view, currentBook, onReadingModeChange]);

  useEffect(() => {
    return () => {
      if (currentBookId) bookService.cancelActiveRequests(currentBookId);
    };
  }, [currentBookId]);

  const handleGoBackToLibrary = () => {
    setView('list');
    onSelectBook(null);
    setShowListInMain(true);
  };

  const handleCreateRoadmap = async (session: BookSession) => {
    if (!session.goal.trim()) {
      // showToast('Please enter a learning goal.', 'warning');
      return;
    }
    if (!hasApiKey) {
      showAlertDialog({
        type: 'warning',
        title: 'Setup Required',
        message: 'Enable the Injin Stack proxy in setup before generating books.',
        confirmText: 'Open Setup',
        onConfirm: onOpenSettings
      });
      return;
    }
    await onCreateBookRoadmap(session);

    // Clear form after successful book creation
    setFormData({
      goal: '',
      language: 'en',
      targetAudience: '',
      complexityLevel: 'intermediate',
      reasoning: '',
      generationMode: 'stellar',
      preferences: {
        includeExamples: true,
        includePracticalExercises: false,
        includeQuizzes: false,
      },
    });
    setShowAdvanced(false);
  };

  const handleGenerateAllModules = async (book: BookProject, session: BookSession) => {
    if (!book.roadmap) {
      showAlertDialog({
        type: 'warning',
        title: 'Missing Roadmap',
        message: 'No roadmap available to generate modules.',
        confirmText: 'Got it'
      });
      return;
    }
    await onGenerateAllModules(book, session);
  };

  const handlePauseGeneration = () => {
    if (currentBook) {
      onPauseGeneration?.(currentBook.id);
    }
  };

  const handleResumeGeneration = async () => {
    if (!currentBook?.roadmap) {
      console.error('No roadmap available to resume generation.');
      // showToast('No roadmap available to resume generation.', 'error');
      return;
    }

    const session: BookSession = {
      goal: currentBook.goal,
      language: 'en',
      targetAudience: '',
      complexityLevel: currentBook.roadmap.difficultyLevel || 'intermediate',
      preferences: { includeExamples: true, includePracticalExercises: false, includeQuizzes: false },
      reasoning: currentBook.reasoning,
      generationMode: currentBook.generationMode
    };

    await onResumeGeneration?.(currentBook, session);
  };

  const handleRetryFailedModules = async (book: BookProject, session: BookSession) => {
    const failedModules = book.modules.filter(m => m.status === 'error');
    if (failedModules.length === 0) {
      console.info('There are no failed modules to retry.');
      // showToast('There are no failed modules to retry.', 'info');
      return;
    }
    await onRetryFailedModules(book, session);
  };

  const handleAssembleBook = async (book: BookProject, session: BookSession) => {
    await onAssembleBook(book, session);
  };


  const handleDownloadPdf = async () => {
    if (!currentBook) return;
    setPdfProgress(1);
    try {
      await pdfService.generatePdf(currentBook, setPdfProgress);
      setTimeout(() => setPdfProgress(0), 2000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'PDF generation failed';
      showAlertDialog({
        type: 'error',
        title: 'PDF Generation Failed',
        message: errorMessage + '\n\nTry these steps:\n1. Hard refresh the page (Ctrl+Shift+R)\n2. Clear browser cache\n3. Download Markdown (.md) version instead',
        confirmText: 'Dismiss'
      });
      setPdfProgress(0);
    }
  };

  const handleStartEditing = () => {
    if (currentBook?.finalBook) {
      setEditedContent(currentBook.finalBook);
      setIsEditing(true);
    }
  };

  const handleCancelEditing = () => {
    setIsEditing(false);
    setEditedContent('');
  };

  const handleSaveChanges = () => {
    if (currentBook && editedContent) {
      onUpdateBookContent(currentBook.id, editedContent);
      setIsEditing(false);
      setEditedContent('');
    }
  };



  const getStatusIcon = (status: BookProject['status']) => {
    // Use modern StatusLoader for generating states
    if (['generating_roadmap', 'generating_content', 'assembling'].includes(status)) {
      return <StatusLoader />;
    }

    const iconMap: Record<BookProject['status'], React.ElementType> = {
      planning: Clock,
      generating_roadmap: Loader2,
      roadmap_completed: ListChecks,
      generating_content: Loader2,
      assembling: Box,
      completed: CheckCircle,
      error: AlertCircle,
    };
    const Icon = iconMap[status] || Loader2;
    const colorClass = status === 'completed'
      ? 'text-green-500'
      : status === 'error'
        ? 'text-red-500'
        : 'text-cyan-500';
    return <Icon className={`w-4 h-4 ${colorClass}`} />;
  };

  const getStatusText = (status: BookProject['status']) =>
  ({
    planning: 'Planning',
    generating_roadmap: 'Creating Roadmap',
    roadmap_completed: 'Ready to Write',
    generating_content: 'Writing Chapters',
    assembling: 'Finalizing Book',
    completed: 'Completed',
    error: 'Error',
  }[status] || 'Unknown');

  // ============================================================================
  // VIEW RENDERING
  // ============================================================================
  if (view === 'list') {
    if (showListInMain)
      return (
        <BookListGrid
          books={books}
          onSelectBook={onSelectBook}
          onDeleteBook={onDeleteBook}
          setView={setView}
          setShowListInMain={setShowListInMain}
        />
      );

    // handleEnhanceWithAI defined here for HomeView
    const handleEnhanceWithAI = async () => {
      if (!formData.goal.trim()) {
        // showToast('Please describe what you want to learn first.', 'warning');
        return;
      }

      if (!hasApiKey) {
        showAlertDialog({
          type: 'warning',
          title: 'Setup Required',
          message: 'Enable the Injin Stack proxy in setup to use the AI refiner.',
          confirmText: 'Open Setup',
          onConfirm: onOpenSettings
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
          preferences: enhanced.preferences
        });

        // showToast('Idea Refined! ✨ Review and adjust as needed.', 'success');
      } catch (error) {
        console.error('Refinement failed:', error);
        // const errorMessage = error instanceof Error ? error.message : 'Refinement failed';
        // showToast(errorMessage, 'error');
      } finally {
        setIsEnhancing(false);
      }
    };

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

  if (view === 'create') {
    const handleEnhanceWithAI = async () => {
      if (!formData.goal.trim()) {
        // showToast('Please describe what you want to learn first.', 'warning');
        return;
      }

      if (!hasApiKey) {
        showAlertDialog({
          type: 'warning',
          title: 'Setup Required',
          message: 'Enable the Injin Stack proxy in setup to use the AI refiner.',
          confirmText: 'Open Setup',
          onConfirm: onOpenSettings
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
          preferences: enhanced.preferences
        });

        // showToast('Idea Refined! ✨ Review and adjust as needed.', 'success');
      } catch (error) {
        console.error('Refinement failed:', error);
        // const errorMessage = error instanceof Error ? error.message : 'Refinement failed';
        // showToast(errorMessage, 'error');
      } finally {
        setIsEnhancing(false);
      }
    };

    return (
      <div className="w-full max-w-2xl mx-auto px-6 py-10 animate-fade-in-up">
        <button
          onClick={() => {
            setView('list');
            setShowListInMain(false);
          }}
          className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors mb-8 group"
        >
          <div className="w-8 h-8 rounded-full bg-[var(--color-card)] border border-[var(--color-border)] flex items-center justify-center group-hover:border-orange-500/50 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </div>
          Back to Library
        </button>

        <div className="mb-8 text-center">
          <div className="mb-5 hidden items-center justify-center md:flex">
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-400/10 px-4 py-1.5 text-[11px] uppercase tracking-[0.22em] text-orange-200/90">
              <Sparkles className="h-3.5 w-3.5" />
              Pustakam Injin
            </span>
          </div>
          <div className="inline-flex items-center justify-center p-3 mb-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-500">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-3xl md:text-[52px] font-bold mb-3 text-[var(--color-text-primary)] tracking-tight leading-[0.96]">
            Build Better <span className="text-orange-500">Learning Books.</span>
          </h1>
          <p className="text-[var(--color-text-secondary)] text-base md:text-lg max-w-xl mx-auto leading-relaxed">
            Start with one idea and shape it into a polished, structured book.
          </p>
        </div>

        <div className="space-y-8 bg-[var(--color-card)] backdrop-blur-xl border border-[var(--color-border)] p-8 rounded-[30px] shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
          {/* Main Input Section */}
          <div>
            <label htmlFor="goal" className="block text-sm font-semibold mb-2 text-[var(--color-text-primary)] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
              What would you like to write about?
            </label>
            <div className="relative group">
              <textarea
                id="goal"
                value={formData.goal}
                onChange={(e) => setFormData((p) => ({ ...p, goal: e.target.value }))}
                placeholder="e.g., 'A comprehensive guide to organic gardening for beginners', 'The history of artificial intelligence', or 'Mastering personal finance in your 20s'"
                className="w-full bg-[var(--color-bg)] border-2 border-[var(--color-border)] rounded-xl p-4 text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)]/50 focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10 transition-all outline-none resize-none text-base leading-relaxed"
                rows={4}
                required
              />
              <div className="absolute bottom-3 right-3">
                <button
                  onClick={handleEnhanceWithAI}
                  disabled={!formData.goal.trim() || isEnhancing}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-500 hover:bg-orange-500 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Use AI to refine your idea into a detailed prompt"
                >
                  {isEnhancing ? (
                    <Loader2 className="animate-spin w-3 h-3" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  {isEnhancing ? 'Refining...' : 'Enhance with AI'}
                </button>
              </div>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] mt-2 ml-1">
              Tip: Be specific about your topic and target audience for the best results.
            </p>
          </div>

          {/* SEPARATOR */}
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-[var(--color-border)]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[var(--color-card)] px-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Configuration</span>
            </div>
          </div>

          {/* Configuration Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="audience" className="block text-sm font-semibold mb-2 text-[var(--color-text-primary)]">
                Target Audience
              </label>
              <input
                id="audience"
                type="text"
                value={formData.targetAudience}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, targetAudience: e.target.value }))
                }
                placeholder="e.g. Beginners, Professionals"
                className="w-full h-11 bg-[var(--color-bg)] border-2 border-[var(--color-border)] rounded-xl px-4 text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)]/50 focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10 transition-all outline-none"
              />
            </div>
            <div>
              <label htmlFor="complexity" className="block text-sm font-semibold mb-2 text-[var(--color-text-primary)]">
                Complexity Level
              </label>
              <div className="relative">
                <CustomSelect
                  value={formData.complexityLevel || 'intermediate'}
                  onChange={(val) =>
                    setFormData((p) => ({ ...p, complexityLevel: val as any }))
                  }
                  options={[
                    { value: 'beginner', label: 'Beginner' },
                    { value: 'intermediate', label: 'Intermediate' },
                    { value: 'advanced', label: 'Advanced' },
                  ]}
                />
              </div>
            </div>
            <div>
              <label htmlFor="generationMode" className="block text-sm font-semibold mb-2 text-[var(--color-text-primary)]">
                AI Personality Mode
              </label>
              <div className="relative">
                <CustomSelect
                  value={formData.generationMode}
                  onChange={(val) =>
                    setFormData((p) => ({ ...p, generationMode: val as any }))
                  }
                  options={[
                    { value: 'stellar', label: 'Stellar Mode (Clean/Shiny)' },
                    { value: 'blackhole', label: 'Street Mode (Raw Chaos)' },
                  ]}
                />
              </div>
            </div>
          </div>

          {/* Advanced Options Toggle */}
          <div className="pt-2">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="group flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-orange-500 transition-colors"
            >
              <div className={`p-1 rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] group-hover:border-orange-500/30 transition-all ${showAdvanced ? 'bg-orange-500/10 text-orange-500' : ''} `}>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${showAdvanced ? 'rotate-180' : ''} `} />
              </div>
              {showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options'}
            </button>

            {showAdvanced && (
              <div className="mt-6 space-y-6 pt-6 border-t border-[var(--color-border)] animate-fade-in-down">
                <div>
                  <label htmlFor="reasoning" className="block text-sm font-semibold mb-2 text-[var(--color-text-primary)]">
                    Context & Goals (Optional)
                  </label>
                  <textarea
                    id="reasoning"
                    value={formData.reasoning}
                    onChange={(e) => setFormData((p) => ({ ...p, reasoning: e.target.value }))}
                    placeholder="Why are you writing this book? What should the reader achieve?"
                    className="w-full bg-[var(--color-bg)] border-2 border-[var(--color-border)] rounded-xl p-4 text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)]/50 focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10 transition-all outline-none resize-none text-sm"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-3 text-[var(--color-text-primary)]">
                    Structure Preferences
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${formData.preferences?.includeExamples ? 'border-orange-500/50 bg-orange-500/5' : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-text-secondary)]/30'} `}>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${formData.preferences?.includeExamples ? 'border-orange-500 bg-orange-500 text-white' : 'border-[var(--color-text-secondary)]/50'} `}>
                        {formData.preferences?.includeExamples && <Check size={12} strokeWidth={3} />}
                      </div>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={formData.preferences?.includeExamples}
                        onChange={(e) => setFormData((p) => ({ ...p, preferences: { ...p.preferences!, includeExamples: e.target.checked } }))}
                      />
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">Include Examples</span>
                    </label>

                    <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${formData.preferences?.includePracticalExercises ? 'border-orange-500/50 bg-orange-500/5' : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-text-secondary)]/30'} `}>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${formData.preferences?.includePracticalExercises ? 'border-orange-500 bg-orange-500 text-white' : 'border-[var(--color-text-secondary)]/50'} `}>
                        {formData.preferences?.includePracticalExercises && <Check size={12} strokeWidth={3} />}
                      </div>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={formData.preferences?.includePracticalExercises}
                        onChange={(e) => setFormData((p) => ({ ...p, preferences: { ...p.preferences!, includePracticalExercises: e.target.checked } }))}
                      />
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">Practical Exercises</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => handleCreateRoadmap(formData)}
            disabled={!formData.goal.trim() || !hasApiKey || localIsGenerating}
            className="btn w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-lg font-bold py-4 rounded-xl shadow-xl shadow-orange-500/20 hover:shadow-orange-500/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
          >
            {localIsGenerating ? (
              <>
                <Loader2 className="animate-spin w-5 h-5" />
                <span>Designing Roadmap...</span>
              </>
            ) : (
              <>
                <Sparkles size={20} className="text-white/90" />
                <span>Generate Book Roadmap</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  if (view === 'detail' && currentBook) {
    const areAllModulesDoneNew =
      currentBook.roadmap &&
      currentBook.modules.length === currentBook.roadmap.modules.length &&
      currentBook.modules.every((m) => m.status === 'completed');
    const failedModulesNew = currentBook.modules.filter((m) => m.status === 'error');
    const completedModulesNew = currentBook.modules.filter((m) => m.status === 'completed');
    const isPausedNew = generationStatus?.status === 'paused';
    const totalModuleCount = Math.max(currentBook.roadmap?.modules.length || currentBook.modules.length, 1);
    const totalWords =
      currentBook.modules.reduce((sum, module) => sum + (module.wordCount || 0), 0) ||
      currentBook.totalWords ||
      (currentBook.finalBook ? currentBook.finalBook.trim().split(/\s+/).length : 0);
    const estimatedReadTime = Math.max(10, Math.round(totalWords / 220) || 10);

    return (
      <div className="min-h-[calc(100vh-48px)]" style={{ background: 'var(--color-bg)', fontFamily: 'Rubik, sans-serif' }}>
        <div className="w-full max-w-6xl mx-auto px-6 py-10">
          <div className="mb-8">
            <button
              onClick={() => {
                setView('list');
                onSelectBook(null);
                setShowListInMain(true);
              }}
              className="mb-5 flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to My Books
            </button>

            <div className="overflow-hidden rounded-[30px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
              <div className="relative overflow-hidden border-b border-white/[0.08] bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.10),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-7 md:p-8">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.26em] text-orange-200/70">Book Workspace</p>
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_320px] lg:items-end">
                  <div className="flex items-start gap-5">
                    <div className={`relative hidden h-44 w-32 shrink-0 overflow-hidden rounded-[26px] border border-white/10 bg-gradient-to-br ${getBookCoverTone(currentBook.title)} shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] md:block`}>
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_35%),linear-gradient(180deg,rgba(8,8,8,0.04),rgba(8,8,8,0.45))]" />
                      <div className="absolute inset-x-0 bottom-0 p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70">Pustakam Injin</p>
                        <h2 className="mt-2 line-clamp-4 text-xl font-semibold leading-tight text-white">
                          {currentBook.title}
                        </h2>
                      </div>
                    </div>

                    <div className="max-w-3xl">
                      <h1 className="mb-3 text-3xl font-bold tracking-tight text-[var(--color-text-primary)] md:text-[44px] md:leading-[0.98]">
                        {currentBook.title}
                      </h1>
                      <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)]">
                        {currentBook.goal}
                      </p>
                      <div className="mt-5 flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
                          <FileText className="h-3.5 w-3.5" />
                          {totalModuleCount} modules
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
                          <Sparkles className="h-3.5 w-3.5" />
                          {totalWords.toLocaleString()} words
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
                          <Clock className="h-3.5 w-3.5" />
                          {estimatedReadTime} min read
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 lg:min-w-[320px]">
                    <div className="rounded-[22px] border border-white/[0.08] bg-white/[0.025] p-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">Status</p>
                      <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
                        {getStatusIcon(currentBook.status)}
                        {getStatusText(currentBook.status)}
                      </div>
                    </div>
                    <div className="rounded-[22px] border border-white/[0.08] bg-white/[0.025] p-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">Progress</p>
                      <div className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">
                        {completedModulesNew.length}/{totalModuleCount} modules
                      </div>
                    </div>
                    <div className="rounded-[22px] border border-white/[0.08] bg-white/[0.025] p-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">Updated</p>
                      <div className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">
                        {new Date(currentBook.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="rounded-[22px] border border-white/[0.08] bg-white/[0.025] p-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">Mode</p>
                      <div className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">
                        {currentBook.generationMode === 'street' ? 'Street Mode' : 'Stellar Mode'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {currentBook.status === 'completed' && (
            <div className="mb-8">
              <div className="flex items-center gap-3">
                <DetailTabButton label="Overview" Icon={ListChecks} isActive={detailTab === 'overview'} onClick={() => setDetailTab('overview')} />
                <DetailTabButton label="Analytics" Icon={BarChart3} isActive={detailTab === 'analytics'} onClick={() => setDetailTab('analytics')} />
                <DetailTabButton label="Read Book" Icon={BookText} isActive={detailTab === 'read'} onClick={() => setDetailTab('read')} />
              </div>
            </div>
          )}

          <div className="space-y-6">
            {detailTab === 'analytics' && currentBook.status === 'completed' ? (
              <BookAnalytics book={currentBook} />
            ) : detailTab === 'read' && currentBook.status === 'completed' ? (
              <ReadingMode
                content={currentBook.finalBook || ''}
                isEditing={isEditing}
                editedContent={editedContent}
                onEdit={handleStartEditing}
                onSave={handleSaveChanges}
                onCancel={handleCancelEditing}
                onContentChange={setEditedContent}
                onGoBack={handleGoBackToLibrary}
                theme={theme}
                bookId={currentBook.id}
                currentModuleIndex={0}
              />
            ) : (
              <>
                {(isGenerating || isPausedNew || generationStatus?.status === 'waiting_retry') &&
                  generationStatus &&
                  generationStats && (
                    <EmbeddedProgressPanel
                      generationStatus={generationStatus}
                      stats={generationStats}
                      onCancel={() => {
                        showAlertDialog({
                          type: 'confirm',
                          title: 'Cancel Generation',
                          message: 'Cancel generation? Progress will be saved.',
                          confirmText: 'Yes, Cancel',
                          cancelText: 'Keep Generating',
                          onConfirm: () => bookService.cancelActiveRequests(currentBook.id)
                        });
                      }}
                      onPause={handlePauseGeneration}
                      onResume={handleResumeGeneration}
                      onRetryDecision={onRetryDecision}
                      availableModels={availableModels}
                      bookTitle={currentBook.title}
                    />
                  )}

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
                  {currentBook.roadmap && (
                    <div className="rounded-[30px] border border-white/[0.08] bg-white/[0.025] p-6 md:p-7">
                      <div className="mb-6 flex items-center justify-between gap-4">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-orange-200/70">Roadmap</p>
                          <h3 className="mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">Learning Flow</h3>
                        </div>
                        <div className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
                          {completedModulesNew.length}/{totalModuleCount} complete
                        </div>
                      </div>
                      <div className="space-y-3">
                        {currentBook.roadmap.modules.map((module, index) => {
                          const completedModule = currentBook.modules.find((m) => m.roadmapModuleId === module.id);
                          const isActive = generationStatus?.currentModule?.id === module.id;
                          return (
                            <div
                              key={module.id}
                              className={`group flex items-start gap-4 rounded-[22px] border px-4 py-4 transition-all ${
                                isActive
                                  ? 'border-orange-500/25 bg-orange-500/[0.05]'
                                  : completedModule?.status === 'completed'
                                    ? 'border-emerald-500/20 bg-emerald-500/[0.05]'
                                    : completedModule?.status === 'error'
                                      ? 'border-red-500/20 bg-red-500/[0.04]'
                                      : 'border-white/[0.08] bg-white/[0.015] hover:border-white/[0.14] hover:bg-white/[0.03]'
                              }`}
                            >
                              <div
                                className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${
                                  completedModule?.status === 'completed'
                                    ? 'border-emerald-400/20 bg-emerald-400/15 text-emerald-200'
                                    : completedModule?.status === 'error'
                                      ? 'border-red-400/20 bg-red-400/15 text-red-200'
                                      : isActive
                                        ? 'border-orange-400/20 bg-orange-400/15 text-orange-100'
                                        : 'border-white/[0.08] bg-white/[0.04] text-[var(--color-text-secondary)]'
                                }`}
                              >
                                {completedModule?.status === 'completed' ? <Check size={15} /> : completedModule?.status === 'error' ? <X size={15} /> : isActive ? <Loader2 size={15} className="animate-spin" /> : String(index + 1).padStart(2, '0')}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="text-base font-semibold text-[var(--color-text-primary)]">
                                    {module.title}
                                  </h4>
                                  {completedModule?.status === 'completed' && (
                                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
                                      Done
                                    </span>
                                  )}
                                  {isActive && (
                                    <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-orange-100">
                                      Writing
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">{module.description || module.estimatedTime}</p>
                              </div>
                              <div className="hidden pt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-secondary)] md:block">
                                {module.estimatedTime}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="space-y-6">
                    {currentBook.status === 'roadmap_completed' &&
                      !areAllModulesDoneNew &&
                      !isGenerating &&
                      !isPausedNew &&
                      generationStatus?.status !== 'waiting_retry' && (
                        <div className="rounded-[30px] border border-white/[0.08] bg-white/[0.025] p-6">
                          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-orange-200/70">Next Step</p>
                          <h3 className="mt-3 text-2xl font-semibold text-[var(--color-text-primary)]">Generate Chapters</h3>
                          <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                            {completedModulesNew.length > 0
                              ? `Resume from ${completedModulesNew.length} completed modules with saved progress.`
                              : 'Start the writing pass and generate the full chapter set.'}
                          </p>
                          <div className="mt-5 rounded-[22px] border border-white/[0.08] bg-black/20 p-4">
                            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Recovery is built in</p>
                            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                              Progress is saved automatically, failed sections can retry, and you can safely return later.
                            </p>
                          </div>
                          <button onClick={handleStartGeneration} disabled={localIsGenerating} className="btn btn-primary mt-5 w-full py-2.5">
                            {localIsGenerating ? <><Loader2 className="animate-spin" /> Generating...</> : <><Play className="w-4 h-4" />{completedModulesNew.length > 0 ? 'Resume Generation' : 'Generate All Modules'}</>}
                          </button>
                        </div>
                      )}

                    {areAllModulesDoneNew &&
                      currentBook.status !== 'completed' &&
                      !localIsGenerating &&
                      !isGenerating &&
                      !isPausedNew && (
                        <div className="rounded-[30px] border border-emerald-500/20 bg-emerald-500/[0.05] p-6 space-y-5 animate-fade-in-up">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-200/70">Ready</p>
                            <h3 className="mt-3 text-2xl font-semibold text-[var(--color-text-primary)]">Assemble Final Book</h3>
                            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                              All chapters are complete. Build the final exportable book now.
                            </p>
                          </div>
                          <button onClick={handleStartAssembly} className="btn btn-primary w-full py-2.5">
                            <Box className="w-5 h-5" />
                            Assemble Final Book
                          </button>
                        </div>
                      )}

                    {currentBook.status === 'assembling' && (
                      <div className="rounded-[30px] border border-green-500/25 bg-white/[0.025] p-6 space-y-6 animate-assembling-glow">
                        <div className="relative h-14 w-14">
                          <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping"></div>
                          <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10">
                            <Box className="w-7 h-7 text-green-400" />
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-200/70">Assembly</p>
                          <h3 className="mt-3 text-2xl font-semibold text-[var(--color-text-primary)]">Finalizing Your Book</h3>
                          <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                            Chapters are being stitched together and polished for export.
                          </p>
                        </div>
                        <div className="w-full overflow-hidden rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] h-2">
                          <div className="h-full rounded-full bg-gradient-to-r from-green-500 via-emerald-400 to-green-500 animate-slide-in-out"></div>
                        </div>
                      </div>
                    )}

                    {currentBook.status === 'completed' && detailTab === 'overview' && (
                      <div className="rounded-[30px] border border-white/[0.08] bg-white/[0.025] p-6">
                        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-orange-200/70">Exports</p>
                        <h3 className="mt-3 text-2xl font-semibold text-[var(--color-text-primary)]">Download Your Book</h3>
                        <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                          Export a polished PDF or take the markdown source for editing.
                        </p>

                        <div className="mt-5 space-y-3">
                          <button
                            onClick={handleDownloadPdf}
                            disabled={pdfProgress > 0 && pdfProgress < 100}
                            className="group flex w-full items-center justify-between rounded-[22px] border border-white/[0.08] bg-black/20 p-4 transition-all hover:border-white/[0.14] disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.05] text-white">
                                <Download className="w-5 h-5" />
                              </div>
                              <div className="text-left">
                                <div className="font-semibold text-[var(--color-text-primary)]">Professional PDF</div>
                                <div className="text-sm text-[var(--color-text-secondary)]">
                                  {pdfProgress > 0 && pdfProgress < 100 ? `Generating... ${pdfProgress}%` : 'Print-ready document'}
                                </div>
                              </div>
                            </div>
                            <span className="text-sm text-[var(--color-text-secondary)] transition-colors group-hover:text-[var(--color-text-primary)]">Export</span>
                          </button>

                          <button
                            onClick={() => {
                              if (currentBook.finalBook) {
                                const blob = new Blob([currentBook.finalBook], { type: 'text/markdown;charset=utf-8' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `${currentBook.title.replace(/[^a-z0-9\s-]/gi, '').replace(/\s+/g, '_').toLowerCase()}_book.md`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                              }
                            }}
                            className="group flex w-full items-center justify-between rounded-[22px] border border-white/[0.08] bg-black/20 p-4 transition-all hover:border-white/[0.14]"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
                                <Download className="w-5 h-5" />
                              </div>
                              <div className="text-left">
                                <div className="font-semibold text-[var(--color-text-primary)]">Markdown Source</div>
                                <div className="text-sm text-[var(--color-text-secondary)]">Easy to edit and version</div>
                              </div>
                            </div>
                            <span className="text-sm text-[var(--color-text-secondary)] transition-colors group-hover:text-[var(--color-text-primary)]">Export</span>
                          </button>
                        </div>

                        {pdfProgress > 0 && pdfProgress < 100 && (
                          <div className="mt-4">
                            <div className="w-full overflow-hidden rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] h-2">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300 transition-all duration-300"
                                style={{ width: `${pdfProgress}%` }}
                              />
                            </div>
                            <p className="mt-2 text-center text-xs text-[var(--color-text-secondary)]">
                              Generating PDF... {pdfProgress}%
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="rounded-[30px] border border-white/[0.08] bg-white/[0.025] p-6">
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-orange-200/70">Snapshot</p>
                      <div className="mt-4 space-y-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[var(--color-text-secondary)]">Completed modules</span>
                          <span className="font-semibold text-[var(--color-text-primary)]">{completedModulesNew.length}/{totalModuleCount}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[var(--color-text-secondary)]">Failed modules</span>
                          <span className="font-semibold text-[var(--color-text-primary)]">{failedModulesNew.length}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[var(--color-text-secondary)]">Words</span>
                          <span className="font-semibold text-[var(--color-text-primary)]">{totalWords.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (false && view === 'detail' && currentBook) {
    const areAllModulesDone =
      currentBook.roadmap &&
      currentBook.modules.length === currentBook.roadmap.modules.length &&
      currentBook.modules.every((m) => m.status === 'completed');
    const failedModules = currentBook.modules.filter((m) => m.status === 'error');
    const completedModules = currentBook.modules.filter((m) => m.status === 'completed');
    const isPaused = generationStatus?.status === 'paused';

    return (
      <div className="min-h-[calc(100vh-48px)]" style={{ background: 'var(--color-bg)', fontFamily: 'Rubik, sans-serif' }}>
        <div className="w-full max-w-5xl mx-auto px-6 py-10">
          <div className="mb-8">
            <button
              onClick={() => {
                setView('list');
                onSelectBook(null);
                setShowListInMain(true);
              }}
              className="mb-5 flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to My Books
            </button>
            <div className="overflow-hidden rounded-[24px] border border-[var(--color-border)] bg-[var(--color-card)] shadow-none">
              <div className="relative overflow-hidden border-b border-[var(--color-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01)),radial-gradient(circle_at_top,rgba(249,115,22,0.08),transparent_30%)] p-7">
                <div className="absolute right-6 top-6 hidden h-12 w-12 rounded-full border border-white/10 bg-white/5 backdrop-blur-md md:block" />
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.26em] text-orange-200/70">Book Workspace</p>
                <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                  <div className="max-w-3xl">
                    <h1 className="mb-2 text-3xl font-bold tracking-tight text-[var(--color-text-primary)] md:text-4xl">{currentBook.title}</h1>
                    <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)]">
                      {currentBook.goal}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:min-w-[280px]">
                    <div className="rounded-[18px] border border-[var(--color-border)] bg-white/[0.02] p-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">Status</p>
                      <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
                        {getStatusIcon(currentBook.status)}
                        {getStatusText(currentBook.status)}
                      </div>
                    </div>
                    <div className="rounded-[18px] border border-[var(--color-border)] bg-white/[0.02] p-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">Progress</p>
                      <div className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">
                        {completedModules.length}/{Math.max(currentBook.roadmap?.modules.length || currentBook.modules.length, 1)} modules
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {currentBook.status === 'completed' && (
            <div className="mb-8">
              <div className="flex items-center gap-3">
                <DetailTabButton
                  label="Overview"
                  Icon={ListChecks}
                  isActive={detailTab === 'overview'}
                  onClick={() => setDetailTab('overview')}
                />
                <DetailTabButton
                  label="Analytics"
                  Icon={BarChart3}
                  isActive={detailTab === 'analytics'}
                  onClick={() => setDetailTab('analytics')}
                />
                <DetailTabButton
                  label="Read Book"
                  Icon={BookText}
                  isActive={detailTab === 'read'}
                  onClick={() => setDetailTab('read')}
                />
              </div>
            </div>
          )}

          <div className="space-y-6">
            {detailTab === 'analytics' && currentBook.status === 'completed' ? (
              <BookAnalytics book={currentBook} />
            ) : detailTab === 'read' && currentBook.status === 'completed' ? (
              <ReadingMode
                content={currentBook.finalBook || ''}
                isEditing={isEditing}
                editedContent={editedContent}
                onEdit={handleStartEditing}
                onSave={handleSaveChanges}
                onCancel={handleCancelEditing}
                onContentChange={setEditedContent}
                onGoBack={handleGoBackToLibrary}
                theme={theme}
                bookId={currentBook.id}
                currentModuleIndex={0}
              />
            ) : (
              <>
                {(isGenerating || isPaused || generationStatus?.status === 'waiting_retry') &&
                  generationStatus &&
                  generationStats && (
                    <EmbeddedProgressPanel
                      generationStatus={generationStatus}
                      stats={generationStats}
                      onCancel={() => {
                        showAlertDialog({
                          type: 'confirm',
                          title: 'Cancel Generation',
                          message: 'Cancel generation? Progress will be saved.',
                          confirmText: 'Yes, Cancel',
                          cancelText: 'Keep Generating',
                          onConfirm: () => bookService.cancelActiveRequests(currentBook.id)
                        });
                      }}
                      onPause={handlePauseGeneration}
                      onResume={handleResumeGeneration}
                      onRetryDecision={onRetryDecision}
                      availableModels={availableModels}
                      bookTitle={currentBook.title}
                    />
                  )}

                {currentBook.status === 'roadmap_completed' &&
                  !areAllModulesDone &&
                  !isGenerating &&
                  !isPaused &&
                  generationStatus?.status !== 'waiting_retry' && (
                    <div className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-none">
                      <div className="flex items-center gap-4 mb-5">
                        <div className="w-10 h-10 flex items-center justify-center bg-gray-500/10 rounded-lg">
                          <Play className="w-5 h-5 text-gray-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                            Ready to Generate Content
                          </h3>
                          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                            {completedModules.length > 0
                              ? `Resume from ${completedModules.length} completed modules`
                              : 'Start generating all modules'}
                          </p>
                        </div>
                      </div>
                      <div className="bg-gray-500/5 border border-gray-500/20 rounded-lg p-4 mb-5">
                        <div className="flex items-start gap-3">
                          <Sparkles className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                          <div className="text-sm text-[var(--color-text-secondary)]">
                            <p className="font-medium text-[var(--color-text-primary)] mb-2">Smart Recovery Enabled</p>
                            <ul className="space-y-1 text-xs text-[var(--color-text-secondary)]">
                              <li>✓ Progress is saved automatically</li>
                              <li>✓ Failed modules will be retried with smart options</li>
                              <li>✓ You can safely close and resume later</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={handleStartGeneration}
                        disabled={localIsGenerating}
                        className="btn btn-primary w-full py-2.5"
                      >
                        {localIsGenerating ? (
                          <><Loader2 className="animate-spin" /> Generating...</>
                        ) : (
                          <><Play className="w-4 h-4" />
                            {completedModules.length > 0
                              ? 'Resume Generation'
                              : 'Generate All Modules'}
                          </>
                        )}
                      </button>
                    </div>
                  )}

                {areAllModulesDone &&
                  currentBook.status !== 'completed' &&
                  !localIsGenerating &&
                  !isGenerating &&
                  !isPaused && (
                    <div className="bg-[var(--color-card)] border border-green-500/30 rounded-[22px] p-6 space-y-5 animate-fade-in-up">
                      <div className="text-center">
                        <div className="w-12 h-12 flex items-center justify-center bg-green-500/10 rounded-full mx-auto mb-3">
                          <CheckCircle className="w-7 h-7 text-green-400" />
                        </div>
                        <h3 className="text-xl font-bold text-[var(--color-text-primary)]">Generation Complete!</h3>
                        <p className="text-sm text-[var(--color-text-secondary)] mt-1.5">
                          All chapters written. Ready to assemble.
                        </p>
                      </div>
                      <button onClick={handleStartAssembly} className="btn btn-primary w-full py-2.5">
                        <Box className="w-5 h-5" />
                        Assemble Final Book
                      </button>
                    </div>
                  )}

                {currentBook.status === 'assembling' && (
                  <div className="bg-[var(--color-card)] backdrop-blur-xl border border-[var(--color-border)] rounded-[22px] p-7 space-y-6 animate-assembling-glow text-center">
                    <div className="relative w-14 h-14 mx-auto">
                      <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping"></div>
                      <div className="relative w-14 h-14 flex items-center justify-center bg-green-500/10 rounded-full">
                        <Box className="w-7 h-7 text-green-400" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-[var(--color-text-primary)]">Assembling Your Book</h3>
                      <p className="text-gray-400 mb-6 max-w-sm mx-auto text-sm">
                        Finalizing chapters and preparing for download...
                      </p>
                    </div>
                    <div className="w-full bg-[var(--color-bg)] rounded-full h-2 overflow-hidden border border-[var(--color-border)]">
                      <div className="h-full bg-gradient-to-r from-green-500 via-emerald-400 to-green-500 rounded-full animate-slide-in-out"></div>
                    </div>
                  </div>
                )}

                {currentBook.status === 'completed' && detailTab === 'overview' && (
                  <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-[22px] p-6">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-10 h-10 flex items-center justify-center bg-gray-500/10 rounded-lg">
                        <Download className="w-5 h-5 text-gray-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                          Download Your Book
                        </h3>
                        <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                          Export as professional PDF or Markdown format
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <button
                        onClick={handleDownloadPdf}
                        disabled={pdfProgress > 0 && pdfProgress < 100}
                        className="flex items-center justify-between p-4 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg hover:border-gray-400 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 flex items-center justify-center bg-gray-500/10 rounded-lg">
                            <Download className="w-5 h-5 text-gray-400" />
                          </div>
                          <div className="text-left">
                            <div className="font-semibold group-hover:text-gray-400 transition-colors text-[var(--color-text-primary)]">
                              Professional PDF
                            </div>
                            <div className="text-sm text-[var(--color-text-secondary)]">
                              {pdfProgress > 0 && pdfProgress < 100
                                ? `Generating... ${pdfProgress}% `
                                : 'Print-ready document'}
                            </div>
                          </div>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          if (currentBook.finalBook) {
                            const blob = new Blob([currentBook.finalBook], { type: 'text/markdown;charset=utf-8' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${currentBook.title.replace(/[^a-z0-9\s-]/gi, '').replace(/\s+/g, '_').toLowerCase()} _book.md`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                          }
                        }}
                        className="flex items-center justify-between p-4 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg hover:border-green-500 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 flex items-center justify-center bg-green-500/10 rounded-lg">
                            <Download className="w-5 h-5 text-green-500" />
                          </div>
                          <div className="text-left">
                            <div className="font-semibold group-hover:text-green-400 transition-colors text-[var(--color-text-primary)]">
                              Markdown File
                            </div>
                            <div className="text-sm text-[var(--color-text-secondary)]">
                              Easy to edit & version
                            </div>
                          </div>
                        </div>
                      </button>
                    </div>

                    {pdfProgress > 0 && pdfProgress < 100 && (
                      <div className="mt-4">
                        <div className="w-full bg-[var(--color-bg)] rounded-full h-2 overflow-hidden border border-[var(--color-border)]">
                          <div
                            className="h-full bg-gradient-to-r from-orange-500 via-purple-500 to-pink-500 rounded-full transition-all duration-300"
                            style={{ width: `${pdfProgress}% ` }}
                          />
                        </div>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-2 text-center">
                          Generating PDF... {pdfProgress}%
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {currentBook.roadmap && (
                  <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-7">
                    <div className="flex items-center gap-3 mb-5">
                      <ListChecks className="w-5 h-5 text-purple-400" />
                      <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Learning Roadmap</h3>
                    </div>
                    <div className="space-y-3">
                      {currentBook.roadmap.modules.map((module, index) => {
                        const completedModule = currentBook.modules.find(
                          (m) => m.roadmapModuleId === module.id
                        );
                        const isActive =
                          generationStatus?.currentModule?.id === module.id;
                        return (
                          <div
                            key={module.id}
                            className={`flex items-center gap-3.5 p-3.5 rounded-lg border transition-all ${isActive
                              ? 'bg-gray-100 dark:bg-gray-500/10 border-gray-300 dark:border-gray-500/40'
                              : completedModule?.status === 'completed'
                                ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
                                : completedModule?.status === 'error'
                                  ? 'border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/5'
                                  : 'bg-white dark:bg-[var(--color-bg)] border-gray-200 dark:border-[var(--color-border)]'
                              }`}
                          >
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${completedModule?.status === 'completed'
                                ? 'bg-emerald-500 text-white'
                                : completedModule?.status === 'error'
                                  ? 'bg-red-500 text-white'
                                  : isActive
                                    ? 'bg-gray-600 text-white animate-pulse'
                                    : 'bg-[var(--color-card)] text-[var(--color-text-secondary)]'
                                }`}
                            >
                              {completedModule?.status === 'completed' ? (
                                <Check size={14} />
                              ) : completedModule?.status === 'error' ? (
                                <X size={14} />
                              ) : isActive ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                index + 1
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-base text-[var(--color-text-primary)]">
                                {module.title}
                              </h4>
                              <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">{module.estimatedTime}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
  return null;
}
