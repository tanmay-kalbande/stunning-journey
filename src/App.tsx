// ============================================================================
// FILE: src/App.tsx
// ============================================================================
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { LoadingScreen } from './components/LoadingScreen';
import { InstallPrompt } from './components/InstallPrompt';
import { SettingsModal } from './components/SettingsModal';
import { useGenerationStats } from './components/GenerationProgressPanel';
import { APISettings, ModelProvider } from './types';
import { usePWA } from './hooks/usePWA';
import { WifiOff } from 'lucide-react';
import { storageUtils } from './utils/storage';
import { bookService } from './services/bookService';
import { planService } from './services/planService';
import { BookView } from './components/BookView';
import { BookProject, BookSession } from './types/book';
import { generateId } from './utils/helpers';
import { TopHeader } from './components/TopHeader';
import { CustomAlertDialog } from './components/CustomAlertDialog';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthModal } from './components/AuthModal';
import { WelcomeModal } from './components/WelcomeModal';
import LandingPage from './components/LandingPage';
import AboutPage from './components/AboutPage';
import TermsPage from './components/TermsPage';
import PrivacyPage from './components/PrivacyPage';
import NebulaBackground from './components/NebulaBackground';
import APIDocsPage from './components/APIDocsPage';
import UsageGuidePage from './components/UsageGuidePage';
import CompliancePage from './components/CompliancePage';
import { DisclaimerPage } from './components/DisclaimerPage';
import BlogPage from './components/BlogPage';
import { Toast, ToastType } from './components/Toast';
import { APP_AI_BRANDLINE, ZHIPU_MODELS } from './constants/ai';

type AppView = 'list' | 'create' | 'detail';
type Theme = 'light' | 'dark';

interface GenerationStatus {
  currentModule?: { id: string; title: string; attempt: number; progress: number; generatedText?: string; };
  totalProgress: number;
  status: 'idle' | 'generating' | 'completed' | 'error' | 'paused' | 'waiting_retry';
  logMessage?: string;
  totalWordsGenerated?: number;
  retryInfo?: { moduleTitle: string; error: string; retryCount: number; maxRetries: number; waitTime?: number; };
}

function App() {
  const [showLocalLanding, setShowLocalLanding] = useState(true);
  const [books, setBooks] = useState<BookProject[]>([]);
  const [settings, setSettings] = useState<APISettings>(() => storageUtils.getSettings());
  const [currentBookId, setCurrentBookId] = useState<string | null>(null);
  const [view, setView] = useState<AppView>('list');
  const [showListInMain, setShowListInMain] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineMessage, setShowOfflineMessage] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>({ status: 'idle', totalProgress: 0, totalWordsGenerated: 0 });
  const [generationStartTime, setGenerationStartTime] = useState<Date>(new Date());
  const [showModelSwitch, setShowModelSwitch] = useState(false);
  const [modelSwitchOptions, setModelSwitchOptions] = useState<Array<{ provider: ModelProvider; model: string; name: string }>>([]);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('pustakam-theme') as Theme) || 'dark');
  const [isReadingMode, setIsReadingMode] = useState(false);

  // Auth state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'subscribe'>('signin');
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [isAuthTransitioning, setIsAuthTransitioning] = useState(false);
  const [isLoadingScreenVisible, setIsLoadingScreenVisible] = useState(true);
  const [isLoadingScreenExiting, setIsLoadingScreenExiting] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  // Legal pages state
  const [showAboutPage, setShowAboutPage] = useState(false);
  const [showTermsPage, setShowTermsPage] = useState(false);
  const [showPrivacyPage, setShowPrivacyPage] = useState(false);
  const [showAPIDocsPage, setShowAPIDocsPage] = useState(false);
  const [showUsageGuidePage, setShowUsageGuidePage] = useState(false);
  const [showCompliancePage, setShowCompliancePage] = useState(false);
  const [showDisclaimerPage, setShowDisclaimerPage] = useState(false);
  const [showBlogPage, setShowBlogPage] = useState(false);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ message, type });
  }, []);

  const { isAuthenticated, isSupabaseEnabled, isLoading, user, profile, signOut, refreshProfile } = useAuth();

  // Alert dialog state
  const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
  const [alertDialogProps, setAlertDialogProps] = useState<{
    type: 'info' | 'warning' | 'error' | 'success' | 'confirm';
    title: string;
    message: string | React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
  }>({ type: 'info', title: '', message: '' });

  const showAlertDialog = useCallback((props: {
    type: 'info' | 'warning' | 'error' | 'success' | 'confirm';
    title: string;
    message: string | React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
  }) => {
    setAlertDialogProps(props);
    setIsAlertDialogOpen(true);
  }, []);

  const handleAlertDialogClose = useCallback(() => {
    setIsAlertDialogOpen(false);
    setAlertDialogProps({ type: 'info', title: '', message: '' });
  }, []);

  const { isInstallable, isInstalled, installApp, dismissInstallPrompt } = usePWA();

  const currentBook = useMemo(
    () => (currentBookId ? books.find(b => b.id === currentBookId) : null),
    [currentBookId, books]
  );

  const isGenerating = useMemo(() => {
    if (!currentBook) return false;
    return currentBook.status === 'generating_content' || generationStatus.status === 'generating';
  }, [currentBook?.status, generationStatus.status]);

  const totalWordsGenerated = useMemo(
    () => currentBook?.modules.reduce((sum, m) => sum + (m.status === 'completed' ? m.wordCount : 0), 0) || 0,
    [currentBook?.modules]
  );

  // Memoize alternative models to avoid recalculating on every render
  const alternativeModels = useMemo(
    () => ZHIPU_MODELS
      .filter(option => option.model !== settings.selectedModel)
      .map(({ provider, model, name }) => ({ provider, model, name })),
    [settings.selectedModel]
  );

  const generationStats = useGenerationStats(
    currentBook?.roadmap?.totalModules || 0,
    currentBook?.modules.filter(m => m.status === 'completed').length || 0,
    currentBook?.modules.filter(m => m.status === 'error').length || 0,
    generationStartTime,
    generationStatus.totalWordsGenerated || totalWordsGenerated
  );

  useEffect(() => {
    localStorage.setItem('pustakam-theme', theme);
    document.documentElement.className = theme;
  }, [theme]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    books.forEach(book => {
      if (book.status === 'completed') {
        try { localStorage.removeItem(`pause_flag_${book.id}`); }
        catch (e) { console.warn('Failed to clear pause flag:', e); }
      }
    });
  }, []);

  useEffect(() => {
    bookService.updateSettings(settings);
    bookService.setProgressCallback(handleBookProgressUpdate);
    bookService.setGenerationStatusCallback((bookId, status) => {
      setGenerationStatus(prev => ({
        ...prev,
        ...status,
        totalWordsGenerated: status.totalWordsGenerated || prev.totalWordsGenerated,
      }));
    });
  }, [settings]);

  const hasLoadedUserBooksRef = React.useRef(false);

  useEffect(() => {
    if (!isLoading && hasLoadedUserBooksRef.current) {
      storageUtils.saveBooks(books, user?.id);
    }
  }, [books, user?.id, isLoading]);

  useEffect(() => { if (!currentBookId) setView('list'); }, [currentBookId]);

  useEffect(() => {
    if (!isLoading) setIsAuthTransitioning(false);
  }, [isAuthenticated, isLoading]);

  // Load user books when auth resolves
  useEffect(() => {
    if (isLoading) return;

    const loadedBooks = storageUtils.getBooks(user?.id);
    setBooks(loadedBooks);
    hasLoadedUserBooksRef.current = true;

    const holdTime = user ? 1500 : 0;
    setTimeout(() => {
      setIsLoadingScreenExiting(true);
      setTimeout(() => {
        setIsLoadingScreenVisible(false);
        setIsLoadingScreenExiting(false);
      }, 700);
    }, holdTime);

    if (user?.id && loadedBooks.length > 0) {
      planService.syncBooksCount(loadedBooks.length)
        .then(synced => { if (synced) refreshProfile(); })
        .catch(() => {});
    }

    setCurrentBookId(null);
  }, [user?.id, isLoading, refreshProfile]);

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); setShowOfflineMessage(false); };
    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineMessage(true);
      setTimeout(() => setShowOfflineMessage(false), 5000);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-advance status when all modules complete
  useEffect(() => {
    if (!currentBook) return;

    const areAllModulesDone =
      currentBook.roadmap &&
      currentBook.modules.length === currentBook.roadmap.modules.length &&
      currentBook.modules.every(m => m.status === 'completed');

    if (
      areAllModulesDone &&
      currentBook.status === 'generating_content' &&
      generationStatus.status !== 'generating' &&
      generationStatus.status !== 'paused' &&
      generationStatus.status !== 'waiting_retry'
    ) {
      setBooks(prev =>
        prev.map(book =>
          book.id === currentBook.id
            ? { ...book, status: 'roadmap_completed', progress: 90, updatedAt: new Date() }
            : book
        )
      );
      setGenerationStatus({
        status: 'completed',
        totalProgress: 100,
        logMessage: '✅ All modules completed!',
        totalWordsGenerated: currentBook.modules.reduce((s, m) => s + m.wordCount, 0),
      });
    }
  }, [currentBook, generationStatus.status]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const hasApiKey = import.meta.env.VITE_USE_PROXY === 'true';

  const shouldShowLanding =
    !isLoading &&
    !isAuthTransitioning &&
    ((isSupabaseEnabled && !isAuthenticated) || (!isSupabaseEnabled && showLocalLanding));

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleSelectBook = (id: string | null) => {
    setCurrentBookId(id);
    if (id) {
      setView('detail');
      const book = books.find(b => b.id === id);
      if (book?.status === 'completed') {
        try { localStorage.removeItem(`pause_flag_${id}`); } catch {}
        setGenerationStatus({
          status: 'idle',
          totalProgress: 0,
          totalWordsGenerated: book.modules.reduce((s, m) => s + m.wordCount, 0),
        });
      }
    }
  };

  const handleBookProgressUpdate = (bookId: string, updates: Partial<BookProject>) => {
    setBooks(prev => prev.map(b => b.id === bookId ? { ...b, ...updates, updatedAt: new Date() } : b));
  };

  const handleUpdateBookStatus = (bookId: string, newStatus: BookProject['status']) => {
    if (!bookId || !newStatus) return;
    setBooks(prev => prev.map(b => b.id === bookId ? { ...b, status: newStatus, updatedAt: new Date() } : b));
  };

  const handleCreateBookRoadmap = async (session: BookSession) => {
    if (!session.goal.trim()) {
      showAlertDialog({ type: 'warning', title: 'Input Required', message: 'Please enter a learning goal.', confirmText: 'Got it' });
      return;
    }
    if (!hasApiKey) {
      showAlertDialog({
        type: 'warning',
        title: 'Setup Required',
        message: 'The Injin Stack proxy is not enabled. Set VITE_USE_PROXY=true and add server env vars.',
        confirmText: 'Open Setup',
        onConfirm: () => setSettingsOpen(true),
      });
      return;
    }

    const bookId = generateId();
    try {
      localStorage.removeItem(`pause_flag_${bookId}`);
      localStorage.removeItem(`checkpoint_${bookId}`);
    } catch {}

    const newBook: BookProject = {
      id: bookId,
      title: session.goal.length > 100 ? session.goal.substring(0, 100) + '...' : session.goal,
      goal: session.goal,
      language: 'en',
      status: 'planning',
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      modules: [],
      category: 'general',
      reasoning: session.reasoning,
      generationMode: session.generationMode,
    };

    setBooks(prev => [...prev, newBook]);
    setCurrentBookId(bookId);
    setView('detail');

    try {
      const roadmap = await bookService.generateRoadmap(session, bookId);
      setBooks(prev => prev.map(book =>
        book.id === bookId
          ? { ...book, roadmap, status: 'roadmap_completed', progress: 10, title: session.goal }
          : book
      ));
      showToast('Roadmap created! Ready to generate chapters.', 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to generate roadmap';
      setBooks(prev => prev.map(b => b.id === bookId ? { ...b, status: 'error', error: msg } : b));
      showToast(`Roadmap failed: ${msg}`, 'error');
    }
  };

  const handleGenerateAllModules = async (book: BookProject, session: BookSession) => {
    if (isSupabaseEnabled && !isAuthenticated) { setShowAuthModal(true); return; }
    if (!book.roadmap) {
      showToast('No roadmap found. Generate a roadmap first.', 'warning');
      return;
    }
    if (!session?.goal?.trim()) {
      showAlertDialog({ type: 'error', title: 'Invalid Session', message: 'Book session data is incomplete. Try creating a new book.', confirmText: 'Dismiss' });
      return;
    }

    setGenerationStartTime(new Date());
    setGenerationStatus({ status: 'generating', totalProgress: 0, logMessage: 'Starting generation…', totalWordsGenerated: 0 });

    try {
      await bookService.generateAllModulesWithRecovery(book, session);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Generation failed';
      if (!msg.includes('GENERATION_PAUSED')) {
        setGenerationStatus({ status: 'error', totalProgress: 0, logMessage: `Generation failed: ${msg}` });
        showToast(`Generation stopped: ${msg}`, 'error');
      }
    }
  };

  const handlePauseGeneration = (bookId: string) => {
    showAlertDialog({
      type: 'confirm',
      title: 'Cancel Generation?',
      message: 'Progress will be saved. You can resume later.',
      confirmText: 'Yes, Cancel',
      cancelText: 'Keep Generating',
      onConfirm: () => {
        bookService.cancelActiveRequests(bookId);
        bookService.pauseGeneration(bookId);
        setGenerationStatus(prev => ({ ...prev, status: 'paused', logMessage: '⏸ Generation paused' }));
        showToast('Generation paused. Progress saved.', 'info');
      },
    });
  };

  const handleResumeGeneration = async (book: BookProject, session: BookSession) => {
    if (!book.roadmap) {
      showToast('No roadmap found. Cannot resume.', 'error');
      return;
    }

    bookService.resumeGeneration(book.id);
    setGenerationStartTime(new Date());
    setGenerationStatus({
      status: 'generating',
      totalProgress: 0,
      logMessage: 'Resuming generation…',
      totalWordsGenerated: book.modules.reduce((sum, m) => sum + (m.status === 'completed' ? m.wordCount : 0), 0),
    });

    try {
      await bookService.generateAllModulesWithRecovery(book, session);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Resume failed';
      if (!msg.includes('GENERATION_PAUSED')) {
        setGenerationStatus({ status: 'error', totalProgress: 0, logMessage: `Resume failed: ${msg}` });
        showToast(`Resume failed: ${msg}`, 'error');
      }
    }
  };

  const handleRetryFailedModules = async (book: BookProject, session: BookSession) => {
    const failedCount = book.modules.filter(m => m.status === 'error').length;
    if (failedCount === 0) {
      showToast('No failed modules to retry.', 'info');
      return;
    }

    setGenerationStartTime(new Date());
    setGenerationStatus({
      status: 'generating',
      totalProgress: 0,
      logMessage: `Retrying ${failedCount} failed module(s)…`,
      totalWordsGenerated: book.modules.reduce((sum, m) => sum + (m.status === 'completed' ? m.wordCount : 0), 0),
    });

    try {
      await bookService.retryFailedModules(book, session);
      showToast('Retry complete!', 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Retry failed';
      setGenerationStatus({ status: 'error', totalProgress: 0, logMessage: `Retry failed: ${msg}` });
      showToast(`Retry failed: ${msg}`, 'error');
    }
  };

  const handleAssembleBook = async (book: BookProject, session: BookSession) => {
    try {
      await bookService.assembleFinalBook(book, session);
      setGenerationStatus({ status: 'completed', totalProgress: 100, logMessage: '✅ Book completed!' });
      showToast('Book assembled! Ready to read.', 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Assembly failed';
      showToast(`Assembly failed: ${msg}`, 'error');
      setBooks(prev => prev.map(b => b.id === book.id ? { ...b, status: 'error', error: msg } : b));
    }
  };

  const handleDeleteBook = (id: string) => {
    showAlertDialog({
      type: 'confirm',
      title: 'Delete Book?',
      message: 'This cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: () => {
        setBooks(prev => prev.filter(b => b.id !== id));
        if (currentBookId === id) { setCurrentBookId(null); setView('list'); }
        try {
          localStorage.removeItem(`checkpoint_${id}`);
          localStorage.removeItem(`pause_flag_${id}`);
        } catch {}
        showToast('Book deleted.', 'info');
      },
    });
  };

  const handleSaveSettings = (newSettings: APISettings) => {
    setSettings(newSettings);
    storageUtils.saveSettings(newSettings);
    setSettingsOpen(false);
    showToast('Settings saved.', 'success');
  };

  const handleModelChange = (model: string, provider: ModelProvider) => {
    const newSettings = { ...settings, selectedModel: model, selectedProvider: provider };
    setSettings(newSettings);
    storageUtils.saveSettings(newSettings);
    showToast(`Switched to ${model}`, 'info');
  };

  const handleRetryDecision = async (decision: 'retry' | 'switch' | 'skip') => {
    if (!currentBook) return;

    if (decision === 'retry') {
      bookService.setRetryDecision(currentBook.id, 'retry');
    } else if (decision === 'switch') {
      bookService.setRetryDecision(currentBook.id, 'switch');
      if (alternativeModels.length === 0) {
        showAlertDialog({
          type: 'warning',
          title: 'No Alternatives',
          message: 'No alternative GLM models available. Check the proxy config in settings.',
          confirmText: 'Open Setup',
          onConfirm: () => setSettingsOpen(true),
        });
        return;
      }
      setModelSwitchOptions(alternativeModels);
      setShowModelSwitch(true);
    } else {
      showAlertDialog({
        type: 'confirm',
        title: 'Skip This Module?',
        message: 'It will be marked as failed and excluded from the final book.',
        confirmText: 'Yes, Skip',
        cancelText: 'Wait',
        onConfirm: () => bookService.setRetryDecision(currentBook.id, 'skip'),
      });
    }
  };

  const handleModelSwitch = async (provider: ModelProvider, model: string) => {
    const newSettings = { ...settings, selectedProvider: provider, selectedModel: model };
    setSettings(newSettings);
    storageUtils.saveSettings(newSettings);
    setShowModelSwitch(false);
    const name = modelSwitchOptions.find(m => m.model === model)?.name || model;
    showToast(`Switched to ${name}. Click Resume to continue.`, 'success');
    if (currentBook) {
      setGenerationStatus(prev => ({ ...prev, status: 'paused', logMessage: '⚙️ Model switched' }));
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (shouldShowLanding) {
    return (
      <>
        <LandingPage
          onLogin={() => { setAuthMode('signin'); setShowAuthModal(true); }}
          onGetStarted={() => {
            if (isSupabaseEnabled) { setAuthMode('signup'); setShowAuthModal(true); return; }
            setShowLocalLanding(false);
            setView('list');
          }}
          onSubscribe={() => { setAuthMode('subscribe'); setShowAuthModal(true); }}
          onShowAbout={() => setShowAboutPage(true)}
          onShowTerms={() => setShowTermsPage(true)}
          onShowPrivacy={() => setShowPrivacyPage(true)}
          onShowCompliance={() => setShowCompliancePage(true)}
          onShowDisclaimer={() => setShowDisclaimerPage(true)}
          onShowBlog={() => setShowBlogPage(true)}
        />
        <AuthModal
          isOpen={isSupabaseEnabled && showAuthModal}
          onClose={() => setShowAuthModal(false)}
          initialMode={authMode}
          onSuccess={() => {
            setIsAuthTransitioning(true);
            setIsLoadingScreenVisible(true);
            setShowAuthModal(false);
            setTimeout(() => {
              setIsLoadingScreenExiting(true);
              setTimeout(() => {
                setIsLoadingScreenVisible(false);
                setIsLoadingScreenExiting(false);
                setShowWelcomeModal(true);
              }, 700);
            }, 2500);
          }}
        />
        {showAboutPage && <AboutPage onClose={() => setShowAboutPage(false)} />}
        {showTermsPage && <TermsPage onClose={() => setShowTermsPage(false)} />}
        {showPrivacyPage && <PrivacyPage onClose={() => setShowPrivacyPage(false)} />}
        {showAPIDocsPage && <APIDocsPage onClose={() => setShowAPIDocsPage(false)} />}
        {showUsageGuidePage && <UsageGuidePage onClose={() => setShowUsageGuidePage(false)} />}
        {showCompliancePage && <CompliancePage onClose={() => setShowCompliancePage(false)} />}
        {showDisclaimerPage && <DisclaimerPage isOpen={showDisclaimerPage} onClose={() => setShowDisclaimerPage(false)} />}
        {showBlogPage && <BlogPage onClose={() => setShowBlogPage(false)} />}
        <Analytics />
      </>
    );
  }

  return (
    <div className="app-container">
      {theme === 'dark' ? <NebulaBackground opacity={0.6} /> : <div className="sun-background" />}

      <TopHeader
        settings={settings}
        books={books}
        currentBookId={currentBookId}
        onModelChange={handleModelChange}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenDocs={() => setShowUsageGuidePage(true)}
        onOpenAPIDocs={() => setShowAPIDocsPage(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenAuth={() => setShowAuthModal(true)}
        authEnabled={isSupabaseEnabled}
        isAuthenticated={!!user}
        user={user}
        userProfile={profile}
        onSignOut={signOut}
        showModelSelector={!showListInMain && !currentBookId && !isReadingMode}
        centerContent={
          showListInMain && !currentBookId
            ? <h1 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight">My Books</h1>
            : null
        }
      />

      <main id="main-scroll-area" className="main-content">
        {showOfflineMessage && (
          <div className="fixed top-20 right-4 z-50 content-card p-3 animate-fade-in-up">
            <div className="flex items-center gap-2 text-yellow-400">
              <WifiOff size={16} />
              <span className="text-sm">You're offline. Some features may be unavailable.</span>
            </div>
          </div>
        )}

        <BookView
          books={books}
          currentBookId={currentBookId}
          onCreateBookRoadmap={handleCreateBookRoadmap}
          onGenerateAllModules={handleGenerateAllModules}
          onRetryFailedModules={handleRetryFailedModules}
          onAssembleBook={handleAssembleBook}
          onSelectBook={handleSelectBook}
          onDeleteBook={handleDeleteBook}
          onUpdateBookStatus={handleUpdateBookStatus}
          hasApiKey={hasApiKey}
          view={view}
          setView={setView}
          onUpdateBookContent={(bookId, content) =>
            setBooks(prev => prev.map(b => b.id === bookId ? { ...b, finalBook: content, updatedAt: new Date() } : b))
          }
          showListInMain={showListInMain}
          setShowListInMain={setShowListInMain}
          isMobile={isMobile}
          generationStatus={generationStatus}
          generationStats={generationStats}
          onPauseGeneration={handlePauseGeneration}
          onResumeGeneration={handleResumeGeneration}
          isGenerating={isGenerating}
          onRetryDecision={handleRetryDecision}
          availableModels={alternativeModels}
          theme={theme}
          onOpenSettings={() => setSettingsOpen(true)}
          showAlertDialog={showAlertDialog}
          showToast={showToast}
          onReadingModeChange={setIsReadingMode}
          settings={settings}
        />
      </main>

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenAPIDocs={() => setShowAPIDocsPage(true)}
        onOpenUsageGuide={() => setShowUsageGuidePage(true)}
        onOpenCompliance={() => setShowCompliancePage(true)}
        showAlertDialog={showAlertDialog}
      />

      {/* Model switch modal */}
      {showModelSwitch && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--color-sidebar)] border border-[var(--color-border)] rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in-up">
            <h3 className="text-xl font-bold mb-2">Switch AI Model</h3>
            <p className="text-sm text-gray-400 mb-6">Select an alternative model to continue generation:</p>
            <div className="space-y-3 mb-6">
              {modelSwitchOptions.map(opt => (
                <button
                  key={`${opt.provider}-${opt.model}`}
                  onClick={() => handleModelSwitch(opt.provider as ModelProvider, opt.model)}
                  className="w-full p-4 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg hover:border-blue-500 transition-all text-left"
                >
                  <div className="font-semibold text-[var(--color-text-primary)]">{opt.name}</div>
                  <div className="text-sm text-gray-400 mt-1">{opt.provider} • {opt.model}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setShowModelSwitch(false)} className="w-full btn btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {isInstallable && !isInstalled && (
        <InstallPrompt onInstall={installApp} onDismiss={dismissInstallPrompt} />
      )}

      <CustomAlertDialog isOpen={isAlertDialogOpen} onClose={handleAlertDialogClose} {...alertDialogProps} />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => { setIsAuthTransitioning(true); setShowAuthModal(false); setShowWelcomeModal(true); }}
      />

      <WelcomeModal isOpen={showWelcomeModal} onClose={() => setShowWelcomeModal(false)} />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {showAboutPage && <AboutPage onClose={() => setShowAboutPage(false)} />}
      {showTermsPage && <TermsPage onClose={() => setShowTermsPage(false)} />}
      {showPrivacyPage && <PrivacyPage onClose={() => setShowPrivacyPage(false)} />}
      {showAPIDocsPage && <APIDocsPage onClose={() => setShowAPIDocsPage(false)} />}
      {showUsageGuidePage && <UsageGuidePage onClose={() => setShowUsageGuidePage(false)} />}
      {showCompliancePage && <CompliancePage onClose={() => setShowCompliancePage(false)} />}
      {showDisclaimerPage && <DisclaimerPage isOpen={showDisclaimerPage} onClose={() => setShowDisclaimerPage(false)} />}

      {isLoadingScreenVisible && (
        <LoadingScreen
          theme={theme}
          isExiting={isLoadingScreenExiting}
          message={isAuthTransitioning ? 'Entering your workspace…' : `Initializing ${APP_AI_BRANDLINE}…`}
        />
      )}

      <Analytics />
    </div>
  );
}

function AppWithProviders() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}

export default AppWithProviders;
