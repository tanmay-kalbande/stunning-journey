// ============================================================================
// FILE: src/App.tsx - WITH AUTH
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

  // Auth Modal State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'subscribe'>('signin');
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [isAuthTransitioning, setIsAuthTransitioning] = useState(false);
  const [isLoadingScreenVisible, setIsLoadingScreenVisible] = useState(true);
  const [isLoadingScreenExiting, setIsLoadingScreenExiting] = useState(false);

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  // Legal Pages State
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

  // Get auth state
  const { isAuthenticated, isSupabaseEnabled, isLoading, user, profile, signOut, refreshProfile } = useAuth();

  // Custom Alert Dialog State
  const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
  const [alertDialogProps, setAlertDialogProps] = useState<{
    type: 'info' | 'warning' | 'error' | 'success' | 'confirm';
    title: string;
    message: string | React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
  }>({ type: 'info', title: '', message: '' });

  // Helper to show custom alert dialog
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
    // Reset props to avoid stale data in subsequent dialogs
    setAlertDialogProps({ type: 'info', title: '', message: '' });
  }, []);

  const { isInstallable, isInstalled, installApp, dismissInstallPrompt } = usePWA();

  const currentBook = useMemo(() => currentBookId ? books.find(b => b.id === currentBookId) : null, [currentBookId, books]);

  const isGenerating = useMemo(() => {
    if (!currentBook) return false;
    return currentBook.status === 'generating_content' || generationStatus.status === 'generating';
  }, [currentBook?.status, generationStatus.status]);

  const totalWordsGenerated = currentBook?.modules.reduce((sum, m) => sum + (m.status === 'completed' ? m.wordCount : 0), 0) || 0;

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

    // Initial Load Animation - Wait for Data!
    // We don't auto-dismiss here anymore, we wait for the books useEffect
    // But we set a safety timeout just in case
    const safetyTimer = setTimeout(() => {
      // Only dismiss if the books effect failed to do so
      // This is accessed via shared state logic (not shown here but handled in the other effect)
    }, 8000);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(safetyTimer);
    };
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
      setGenerationStatus(prev => ({ ...prev, ...status, totalWordsGenerated: status.totalWordsGenerated || prev.totalWordsGenerated }));
    });
  }, [settings]);

  // Track whether we've completed initial load to prevent overwriting data
  const hasLoadedUserBooksRef = React.useRef(false);

  useEffect(() => {
    // Only save if:
    // 1. Auth has finished loading (so we have the correct user ID)
    // 2. We have successfully LOADED user-specific books once (so we're not overwriting with empty array)
    if (!isLoading && hasLoadedUserBooksRef.current) {
      console.log(`💾 Saving ${books.length} books for user: ${user?.id || 'anonymous'}`);
      storageUtils.saveBooks(books, user?.id);
    }
  }, [books, user?.id, isLoading]);

  useEffect(() => { if (!currentBookId) setView('list'); }, [currentBookId]);

  // Reset auth transitioning state when user signs out OR when authentication is established
  useEffect(() => {
    if (!isLoading) {
      // If we're not loading anymore, and we're either authenticated or definitely not,
      // we should stop the transition state
      setIsAuthTransitioning(false);
    }
  }, [isAuthenticated, isLoading]);

  // Load user-specific books when auth finishes loading or user changes
  useEffect(() => {
    // Wait for auth to finish loading before loading books
    // This ensures we have the correct user ID
    if (isLoading) return;

    const loadedBooks = storageUtils.getBooks(user?.id);
    console.log(`📚 Initial load: ${loadedBooks.length} books for user: ${user?.id || 'anonymous'}`);

    // Set books and mark as loaded in one go
    setBooks(loadedBooks);
    hasLoadedUserBooksRef.current = true;

    // Now that books are loaded (or empty array confirmed), dismiss loading screen
    // OPTIMIZATION: If user is NOT logged in (Landing Page), dismiss INSTANTLY (delay = 0).
    // If user IS logged in (Dashboard), keep premium delay (delay = 1500) to show off branding.
    const holdTime = user ? 1500 : 0;

    setTimeout(() => {
      setIsLoadingScreenExiting(true);
      setTimeout(() => {
        setIsLoadingScreenVisible(false);
        setIsLoadingScreenExiting(false);
      }, 700); // Transition duration
    }, holdTime);

    // Synchronize books count with database if logged in
    if (user?.id && loadedBooks.length > 0) {
      const syncCount = async () => {
        const synced = await planService.syncBooksCount(loadedBooks.length);
        if (synced) {
          // If sync happened, refresh the profile to update UI counters
          await refreshProfile();
        }
      };
      syncCount();
    }

    // Reset current book selection when user changes
    setCurrentBookId(null);
  }, [user?.id, isLoading, refreshProfile]);


  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); setShowOfflineMessage(false); };
    const handleOffline = () => { setIsOnline(false); setShowOfflineMessage(true); setTimeout(() => setShowOfflineMessage(false), 5000); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  useEffect(() => {
    if (!currentBook) return;

    const areAllModulesDone =
      currentBook.roadmap &&
      currentBook.modules.length === currentBook.roadmap.modules.length &&
      currentBook.modules.every(m => m.status === 'completed');

    if (areAllModulesDone &&
      currentBook.status === 'generating_content' &&
      generationStatus.status !== 'generating' &&
      generationStatus.status !== 'paused' &&
      generationStatus.status !== 'waiting_retry') {

      console.log('✓ All modules completed - updating to roadmap_completed');

      setBooks(prevBooks =>
        prevBooks.map(book =>
          book.id === currentBook.id
            ? { ...book, status: 'roadmap_completed', progress: 90, updatedAt: new Date() }
            : book
        )
      );

      setGenerationStatus({
        status: 'completed',
        totalProgress: 100,
        logMessage: '✅ All modules completed!',
        totalWordsGenerated: currentBook.modules.reduce((s, m) => s + m.wordCount, 0)
      });
    }
  }, [currentBook, generationStatus.status]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
  };

  const hasApiKey = import.meta.env.VITE_USE_PROXY === 'true';
  const shouldShowLanding =
    !isLoading &&
    !isAuthTransitioning &&
    ((isSupabaseEnabled && !isAuthenticated) || (!isSupabaseEnabled && showLocalLanding));

  const getAlternativeModels = () => {
    return ZHIPU_MODELS
      .filter(option => option.model !== settings.selectedModel)
      .map(({ provider, model, name }) => ({ provider, model, name }));
  };

  const showModelSwitchModal = (alternatives: any) => { setModelSwitchOptions(alternatives); setShowModelSwitch(true); };

  const handleModelSwitch = async (provider: ModelProvider, model: string) => {
    const newSettings = { ...settings, selectedProvider: provider, selectedModel: model };
    setSettings(newSettings);
    storageUtils.saveSettings(newSettings);
    setShowModelSwitch(false);
    setTimeout(() => {
      if (currentBook) {
        const modelName = modelSwitchOptions.find(m => m.provider === provider)?.name;
        showAlertDialog({
          type: 'success',
          title: 'Model Switched',
          message: `Successfully switched to ${modelName}. Click Resume to continue generation.`,
          confirmText: 'Got it',
        });
        setGenerationStatus(prev => ({ ...prev, status: 'paused', logMessage: '⚙️ Model switched' }));
      }
    }, 100);
  };

  const handleRetryDecision = async (decision: 'retry' | 'switch' | 'skip') => {
    if (!currentBook) return;
    if (decision === 'retry') {
      bookService.setRetryDecision(currentBook.id, 'retry');
    }
    else if (decision === 'switch') {
      bookService.setRetryDecision(currentBook.id, 'switch');
      const alternatives = getAlternativeModels();
      if (alternatives.length === 0) {
        showAlertDialog({
          type: 'warning',
          title: 'No Alternatives',
          message: 'No alternative GLM models are available right now. Open setup to verify the proxy configuration.',
          confirmText: 'Open Setup',
          onConfirm: () => setSettingsOpen(true)
        });
        return;
      }
      showModelSwitchModal(alternatives);
    }
    else if (decision === 'skip') {
      showAlertDialog({
        type: 'confirm',
        title: 'Confirm Skip Module',
        message: '⚠️ Skip this module? It will be marked as failed and will not be included in the final book.',
        confirmText: 'Yes, Skip',
        cancelText: 'No, Wait',
        onConfirm: () => bookService.setRetryDecision(currentBook.id, 'skip'),
      });
    }
  };

  const handleSelectBook = (id: string | null) => {
    setCurrentBookId(id);
    if (id) {
      setView('detail');
      const book = books.find(b => b.id === id);
      if (book?.status === 'completed') {
        try { localStorage.removeItem(`pause_flag_${id}`); } catch (e) { console.warn(e); }
        setGenerationStatus({ status: 'idle', totalProgress: 0, totalWordsGenerated: book.modules.reduce((s, m) => s + m.wordCount, 0) });
      }
    }
  };

  const handleBookProgressUpdate = (bookId: string, updates: Partial<BookProject>) => {
    setBooks(prev => prev.map(book => book.id === bookId ? { ...book, ...updates, updatedAt: new Date() } : book));
  };

  const handleUpdateBookStatus = (bookId: string, newStatus: BookProject['status']) => {
    if (!bookId || !newStatus) return;
    setBooks(prevBooks =>
      prevBooks.map(book =>
        book.id === bookId
          ? { ...book, status: newStatus, updatedAt: new Date() }
          : book
      )
    );
  };

  const handleCreateBookRoadmap = async (session: BookSession) => {
    if (!session.goal.trim()) {
      showAlertDialog({
        type: 'warning',
        title: 'Input Required',
        message: 'Please enter a learning goal.',
        confirmText: 'Got it',
      });
      return;
    }
    if (!hasApiKey) {
      showAlertDialog({
        type: 'warning',
        title: 'Setup Required',
        message: 'The Injin Stack proxy is not enabled yet. Turn on `VITE_USE_PROXY=true` and add the required server env vars before generating books.',
        confirmText: 'Open Setup',
        onConfirm: () => setSettingsOpen(true),
      });
      return;
    }

    const bookId = generateId();

    try {
      localStorage.removeItem(`pause_flag_${bookId}`);
      localStorage.removeItem(`checkpoint_${bookId}`);
    } catch (e) {
      console.warn('Failed to clear flags:', e);
    }

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
      generationMode: session.generationMode
    };

    setBooks(prev => [...prev, newBook]);
    setCurrentBookId(bookId);
    setView('detail');

    try {
      const roadmap = await bookService.generateRoadmap(session, bookId);
      setBooks(prev => prev.map(book =>
        book.id === bookId
          ? {
            ...book,
            roadmap,
            status: 'roadmap_completed',
            progress: 10,
            title: roadmap.modules[0]?.title.includes('Module')
              ? session.goal
              : roadmap.modules[0]?.title || session.goal
          }
          : book
      ));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate roadmap';
      setBooks(prev => prev.map(book =>
        book.id === bookId
          ? { ...book, status: 'error', error: errorMessage }
          : book
      ));
      showAlertDialog({
        type: 'error',
        title: 'Roadmap Generation Failed',
        message: `Failed to generate roadmap: ${errorMessage}. Please check your API key and internet connection.`,
        confirmText: 'Dismiss',
      });
    }
  };

  const handleGenerateAllModules = async (book: BookProject, session: BookSession) => {
    // Check if user is authenticated when Supabase is enabled
    if (isSupabaseEnabled && !isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    if (!book.roadmap) {
      showAlertDialog({
        type: 'warning',
        title: 'Missing Roadmap',
        message: 'No roadmap available to generate modules. Please generate a roadmap first.',
        confirmText: 'Got it',
      });
      return;
    }

    if (!session || !session.goal || !session.goal.trim()) {
      console.error('Invalid session:', session);
      showAlertDialog({
        type: 'error',
        title: 'Invalid Book Session',
        message: 'The book session data is incomplete or corrupted. Please try creating a new book.',
        confirmText: 'Dismiss',
      });
      return;
    }

    setGenerationStartTime(new Date());
    setGenerationStatus({ status: 'generating', totalProgress: 0, logMessage: 'Starting generation...', totalWordsGenerated: 0 });
    try {
      await bookService.generateAllModulesWithRecovery(book, session);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Module generation failed';
      if (!errorMessage.includes('GENERATION_PAUSED')) {
        setGenerationStatus({ status: 'error', totalProgress: 0, logMessage: `Generation failed: ${errorMessage}` });
        showAlertDialog({
          type: 'error',
          title: 'Module Generation Failed',
          message: `Generation process encountered an error: ${errorMessage}.`,
          confirmText: 'Dismiss',
        });
      }
    }
  };

  const handlePauseGeneration = (bookId: string) => {
    showAlertDialog({
      type: 'confirm',
      title: 'Confirm Cancellation',
      message: 'Are you sure you want to cancel the generation process? Your progress will be saved, and you can resume later.',
      confirmText: 'Yes, Cancel',
      cancelText: 'No, Continue',
      onConfirm: () => {
        bookService.cancelActiveRequests(bookId);
        bookService.pauseGeneration(bookId);
        setGenerationStatus(prev => ({ ...prev, status: 'paused', logMessage: '⏸ Generation paused' }));
      }
    });
  };

  const handleResumeGeneration = async (book: BookProject, session: BookSession) => {
    if (!book.roadmap) {
      console.error('No roadmap available to resume generation.');
      // showToast('No roadmap available to resume generation. This book might be corrupted.', 'error');
      return;
    }
    bookService.resumeGeneration(book.id);
    setGenerationStartTime(new Date());
    setGenerationStatus({
      status: 'generating', totalProgress: 0, logMessage: 'Resuming generation...',
      totalWordsGenerated: book.modules.reduce((sum, m) => sum + (m.status === 'completed' ? m.wordCount : 0), 0)
    });
    try {
      await bookService.generateAllModulesWithRecovery(book, session);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Resume failed';
      if (!errorMessage.includes('GENERATION_PAUSED')) {
        setGenerationStatus({ status: 'error', totalProgress: 0, logMessage: `Resume failed: ${errorMessage}` });
        console.error(`Failed to resume generation: ${errorMessage}`);
        // showToast(`Failed to resume generation: ${errorMessage}.`, 'error');
      }
    }
  };

  const handleRetryFailedModules = async (book: BookProject, session: BookSession) => {
    const failedModules = book.modules.filter(m => m.status === 'error');
    if (failedModules.length === 0) {
      console.info('No failed modules to retry.');
      // showToast('No failed modules to retry.', 'info');
      return;
    }
    setGenerationStartTime(new Date());
    setGenerationStatus({
      status: 'generating', totalProgress: 0, logMessage: `Retrying ${failedModules.length} failed modules...`,
      totalWordsGenerated: book.modules.reduce((sum, m) => sum + (m.status === 'completed' ? m.wordCount : 0), 0)
    });
    try {
      await bookService.retryFailedModules(book, session);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Retry failed';
      setGenerationStatus({ status: 'error', totalProgress: 0, logMessage: `Retry failed: ${errorMessage}` });
      console.error(`Failed to retry modules: ${errorMessage}`);
      // showToast(`Failed to retry modules: ${errorMessage}.`, 'error');
    }
  };

  const handleAssembleBook = async (book: BookProject, session: BookSession) => {
    try {
      await bookService.assembleFinalBook(book, session);
      setGenerationStatus({ status: 'completed', totalProgress: 100, logMessage: '✅ Book completed!' });
      console.info('Book Successfully Assembled!');
      // showToast('Book Successfully Assembled!', 'success');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Assembly failed';
      console.error(`Failed to assemble the book: ${errorMessage}`);
      // showToast(`Failed to assemble the book: ${errorMessage}.`, 'error');
      setBooks(prev => prev.map(b => b.id === book.id ? { ...b, status: 'error', error: errorMessage } : b));
    }
  };

  const handleDeleteBook = (id: string) => {
    showAlertDialog({
      type: 'confirm',
      title: 'Confirm Deletion',
      message: 'Delete this book permanently? This cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: () => {
        setBooks(prev => prev.filter(b => b.id !== id));
        if (currentBookId === id) {
          setCurrentBookId(null);
          setView('list');
        }
        try {
          localStorage.removeItem(`checkpoint_${id}`);
          localStorage.removeItem(`pause_flag_${id}`);
        } catch (e) { console.warn('Failed to clear storage:', e); }
      }
    });
  };

  const handleSaveSettings = (newSettings: APISettings) => {
    try {
      setSettings(newSettings);
      storageUtils.saveSettings(newSettings);
      setSettingsOpen(false);
      console.info('Settings Saved');
      // showToast('Settings Saved', 'success');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save settings.';
      console.error(`Settings Save Failed: ${errorMessage}`);
      /*
      showAlertDialog({
        type: 'error',
        title: 'Settings Save Failed',
        message: `There was an error saving your settings: ${errorMessage}.`,
        confirmText: 'Dismiss',
      });
      */
    }
  };

  const handleModelChange = (model: string, provider: ModelProvider) => {
    const newSettings = { ...settings, selectedModel: model, selectedProvider: provider };
    setSettings(newSettings);
    storageUtils.saveSettings(newSettings);
  };

  const handleInstallApp = async () => { await installApp(); };

  const handleUpdateBookContent = (bookId: string, newContent: string) => {
    setBooks(prev => prev.map(book =>
      book.id === bookId
        ? { ...book, finalBook: newContent, updatedAt: new Date() }
        : book
    ));
  };

  // =========================================================================
  // LANDING PAGE: Show for unauthenticated users when Supabase is enabled
  // =========================================================================
  // Show landing page for unauthenticated users
  // Use isAuthTransitioning to prevent flash during login transition
  if (shouldShowLanding) {
    return (
      <>
        <LandingPage
          onLogin={() => {
            if (isSupabaseEnabled) {
              setAuthMode('signin');
              setShowAuthModal(true);
              return;
            }
            setShowLocalLanding(false);
            setView('list');
          }}
          onGetStarted={() => {
            if (isSupabaseEnabled) {
              setAuthMode('signup');
              setShowAuthModal(true);
              return;
            }
            setShowLocalLanding(false);
            setView('list');
          }}
          onSubscribe={() => {
            if (isSupabaseEnabled) {
              setAuthMode('subscribe');
              setShowAuthModal(true);
              return;
            }
            setShowLocalLanding(false);
            setView('list');
          }}
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
            // Set transitioning state BEFORE closing modal to prevent flash
            setIsAuthTransitioning(true);
            setIsLoadingScreenVisible(true);
            setShowAuthModal(false);

            // Transition to main app
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
      {theme === 'dark' ? (
        <NebulaBackground opacity={0.6} />
      ) : (
        <div className="sun-background" />
      )}

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
        centerContent={showListInMain && !currentBookId ? (
          <h1 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight">My Books</h1>
        ) : null}
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
          onUpdateBookContent={handleUpdateBookContent}
          showListInMain={showListInMain}
          setShowListInMain={setShowListInMain}
          isMobile={isMobile}
          generationStatus={generationStatus}
          generationStats={generationStats}
          onPauseGeneration={handlePauseGeneration}
          onResumeGeneration={handleResumeGeneration}
          isGenerating={isGenerating}
          onRetryDecision={handleRetryDecision}
          availableModels={getAlternativeModels()}
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

      {showModelSwitch && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--color-sidebar)] border border-[var(--color-border)] rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in-up">
            <h3 className="text-xl font-bold mb-4">Switch AI Model</h3>
            <p className="text-sm text-gray-400 mb-6">Select an alternative model to continue generation:</p>
            <div className="space-y-3 mb-6">
              {modelSwitchOptions.map((option) => (
                <button
                  key={`${option.provider}-${option.model}`}
                  onClick={() => handleModelSwitch(option.provider, option.model)}
                  className="w-full p-4 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg hover:border-blue-500 transition-all text-left"
                >
                  <div className="font-semibold text-[var(--color-text-primary)]">{option.name}</div>
                  <div className="text-sm text-gray-400 mt-1">{option.provider} • {option.model}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setShowModelSwitch(false)} className="w-full btn btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {isInstallable && !isInstalled && (
        <InstallPrompt onInstall={handleInstallApp} onDismiss={dismissInstallPrompt} />
      )}

      <CustomAlertDialog
        isOpen={isAlertDialogOpen}
        onClose={handleAlertDialogClose}
        {...alertDialogProps}
      />

      <Analytics />

      {/* Auth Modals */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setIsAuthTransitioning(true);
          setShowAuthModal(false);
          setShowWelcomeModal(true); // Show welcome after login/signup
        }}
      />

      <WelcomeModal
        isOpen={showWelcomeModal}
        onClose={() => setShowWelcomeModal(false)}
      />

      <Analytics />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Full-screen Documentation Overlays */}
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
          message={isAuthTransitioning ? 'Entering your workspace...' : `Initializing ${APP_AI_BRANDLINE}...`}
        />
      )}
    </div>
  );
}

// Wrap App with AuthProvider
function AppWithProviders() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}

export default AppWithProviders;
