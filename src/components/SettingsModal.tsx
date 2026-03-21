// src/components/SettingsModal.tsx
import React from 'react';
import { X, Shield, Database, Download, Upload, Trash2, Key, Settings, User, Zap, Globe, Cpu, BookOpen, AlertTriangle, BookMarked, ChevronRight, Crown, Sparkles, Calendar, Sun, Moon, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { APISettings } from '../types';
import { storageUtils } from '../utils/storage';
import { DisclaimerPage } from './DisclaimerPage';
import { AI_SUITE_NAME, APP_AI_BRANDLINE, ZHIPU_MODELS } from '../constants/ai';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: APISettings;
  onSaveSettings: (settings: APISettings) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenAPIDocs: () => void;
  onOpenUsageGuide: () => void;
  onOpenCompliance: () => void;
  showAlertDialog: (props: {
    type: 'info' | 'warning' | 'error' | 'success' | 'confirm';
    title: string;
    message: string | React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
  }) => void;
}

type ActiveTab = 'personality' | 'keys' | 'data' | 'about';

interface ImportPreview {
  books: any[];
  settings: APISettings;
  conflicts: {
    duplicateBooks: number;
    settingsConflict: boolean;
  };
}

export function SettingsModal({ isOpen, onClose, settings, onSaveSettings, theme, onToggleTheme, onOpenAPIDocs, onOpenUsageGuide, onOpenCompliance, showAlertDialog }: SettingsModalProps) {
  const [localSettings, setLocalSettings] = React.useState<APISettings>(settings);
  const { profile, isAuthenticated, user } = useAuth();
  const [activeTab, setActiveTab] = React.useState<ActiveTab>('personality');
  const [importPreview, setImportPreview] = React.useState<ImportPreview | null>(null);
  const [showImportModal, setShowImportModal] = React.useState(false);
  const [showDisclaimer, setShowDisclaimer] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => setLocalSettings(settings), [settings, isOpen]);

  const handleSave = () => {
    setIsSaving(true);
    onSaveSettings(localSettings);
    // In a real app, you might wait for an API response before closing
    // For local settings, we can close immediately or after a small delay
    setTimeout(() => {
      setIsSaving(false);
      onClose();
    }, 300);
  };

  const handleExportData = () => {
    const data = {
      books: storageUtils.getBooks(user?.id),
      settings: storageUtils.getSettings(),
      exportDate: new Date().toISOString(),
      version: '1.0.0'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pustakam-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportPreview = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importData = JSON.parse(e.target?.result as string);
        const existingBooks = storageUtils.getBooks(user?.id);
        const existingSettings = storageUtils.getSettings();

        const duplicateBooks = importData.books ?
          importData.books.filter((importBook: any) =>
            existingBooks.some(existingBook => existingBook.id === importBook.id)
          ).length : 0;

        const settingsConflict = importData.settings &&
          JSON.stringify(existingSettings) !== JSON.stringify(importData.settings);

        setImportPreview({
          books: importData.books || [],
          settings: importData.settings || existingSettings,
          conflicts: {
            duplicateBooks,
            settingsConflict
          }
        });
        setShowImportModal(true);
      } catch (error) {
        showAlertDialog({
          type: 'error',
          title: 'Invalid File',
          message: 'Failed to read import file. Please check the file format.',
          confirmText: 'OK'
        });
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const executeImport = (mode: 'merge' | 'replace') => {
    if (!importPreview) return;

    try {
      if (mode === 'replace') {
        storageUtils.saveBooks(importPreview.books, user?.id);
        if (importPreview.settings) {
          setLocalSettings(importPreview.settings);
          storageUtils.saveSettings(importPreview.settings);
        }
      } else {
        const existingBooks = storageUtils.getBooks(user?.id);
        const existingSettings = storageUtils.getSettings();

        const mergedBooks = [...existingBooks];
        importPreview.books.forEach((importBook: any) => {
          const exists = mergedBooks.some(existing => existing.id === importBook.id);
          if (!exists) {
            mergedBooks.push(importBook);
          }
        });
        storageUtils.saveBooks(mergedBooks, user?.id);

        const mergedSettings = { ...importPreview.settings };
        Object.keys(existingSettings).forEach(key => {
          if (existingSettings[key as keyof APISettings] &&
            key.includes('ApiKey') &&
            existingSettings[key as keyof APISettings] !== '') {
            mergedSettings[key as keyof APISettings] = existingSettings[key as keyof APISettings];
          }
        });
        setLocalSettings(mergedSettings);
        storageUtils.saveSettings(mergedSettings);
      }

      setShowImportModal(false);
      setImportPreview(null);
      showAlertDialog({
        type: 'success',
        title: 'Import Successful',
        message: `Data imported successfully using ${mode} mode! The app will now reload.`,
        confirmText: 'OK',
        onConfirm: () => window.location.reload()
      });
    } catch (error) {
      console.error('Import failed:', error);
      let message = 'Failed to import data. Please check the file and try again.';
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        message = 'Import failed: Your browser storage is full. Please clear some space and try again.';
      }
      showAlertDialog({
        type: 'error',
        title: 'Import Failed',
        message,
        confirmText: 'Dismiss'
      });
    }
  };

  const handleClearData = () => {
    showAlertDialog({
      type: 'confirm',
      title: 'Confirm Data Deletion',
      message: 'This will permanently delete all books and settings. This action cannot be undone. Are you sure?',
      confirmText: 'Yes, Delete All',
      cancelText: 'Cancel',
      onConfirm: () => {
        storageUtils.clearAll();
        showAlertDialog({
          type: 'success',
          title: 'Data Cleared',
          message: 'All data has been cleared. The app will now reload.',
          confirmText: 'OK',
          onConfirm: () => window.location.reload()
        });
      }
    });
  };

  if (!isOpen) return null;

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
        <div
          className="relative w-full max-w-4xl bg-white dark:bg-[#1a1a1a] border border-[var(--color-border)] rounded-2xl shadow-2xl flex flex-col h-[90vh] md:h-[600px] overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-4 md:px-6 py-4 flex items-center justify-between border-b border-gray-100 dark:border-white/[0.08] shrink-0">
            <div className="flex items-center gap-3">
              <Settings size={18} className="text-gray-400" />
              <h2 className="text-xs md:text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">System Preferences</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
            {/* Sidebar with Nebula visual cues */}
            <div className={`w-full md:w-[280px] border-b md:border-b-0 md:border-r flex flex-col backdrop-blur-md transition-colors overflow-hidden ${theme === 'light' ? 'bg-white/80 border-gray-100' : 'bg-black/60 border-white/[0.05]'}`}>
              <div className="p-4 md:p-8 flex md:flex-col overflow-x-auto md:overflow-y-auto md:overflow-x-hidden items-center md:items-start whitespace-nowrap md:whitespace-normal custom-scrollbar flex-1">
                <div className="flex items-center gap-2 mb-0 md:mb-8 mr-6 md:mr-0 shrink-0">
                  <div className="w-1.5 md:w-2 h-6 md:h-8 bg-gradient-to-b from-orange-500 to-purple-600 rounded-full" />
                  <h2 className="text-base md:text-xl font-black tracking-tight text-gray-900 dark:text-white uppercase">System</h2>
                </div>
                <nav className="flex md:flex-col space-x-1 md:space-x-0 md:space-y-1 shrink-0">
                  {[
                    { id: 'personality', label: 'Persona & Identity', icon: Sparkles },
                    { id: 'keys', label: 'AI Setup', icon: Key },
                    { id: 'data', label: 'Data & Backup', icon: Database },
                    { id: 'about', label: 'About', icon: Cpu },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-3 px-4 py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-bold transition-all duration-300 text-left whitespace-nowrap ${activeTab === tab.id
                        ? 'bg-gradient-to-r from-orange-500/10 to-purple-500/10 text-orange-500 shadow-sm'
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/[0.03]'
                        }`}
                    >
                      <tab.icon size={activeTab === tab.id ? 18 : 16} className={`shrink-0 ${activeTab === tab.id ? 'text-orange-500' : 'opacity-50'}`} />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </nav>

                {/* New Resource Center Section in Sidebar */}
                <div className="hidden md:block mt-12 pt-8 border-t border-gray-100 dark:border-white/[0.05] w-full">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4 px-4">Resource Center</p>
                  <div className="space-y-1">
                    <button
                      onClick={onOpenAPIDocs}
                      className="w-full flex items-center gap-3 px-4 py-2 text-xs font-bold text-gray-500 hover:text-orange-500 transition-colors"
                    >
                      <BookMarked size={14} />
                      API Setup
                    </button>
                    <button
                      onClick={onOpenUsageGuide}
                      className="w-full flex items-center gap-3 px-4 py-2 text-xs font-bold text-gray-500 hover:text-orange-500 transition-colors"
                    >
                      <Info size={14} />
                      Usage Guide
                    </button>
                    <button
                      onClick={onOpenCompliance}
                      className="w-full flex items-center gap-3 px-4 py-2 text-xs font-bold text-gray-500 hover:text-orange-500 transition-colors"
                    >
                      <Shield size={14} />
                      Compliance
                    </button>
                  </div>
                </div>
              </div>

              <div className="hidden md:flex mt-auto p-8 border-t border-gray-100 dark:border-white/[0.05]">
                <button
                  onClick={onToggleTheme}
                  className="w-full flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.05] group hover:border-orange-500/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    {theme === 'light' ? <Sun size={18} className="text-amber-500" /> : <Moon size={18} className="text-purple-400" />}
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300 capitalize">{theme} Mode</span>
                  </div>
                  <div className={`w-8 h-4 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-orange-500' : 'bg-gray-200'}`}>
                    <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all ${theme === 'dark' ? 'left-5' : 'left-1'}`} />
                  </div>
                </button>
              </div>
            </div>

            {/* Content Area - Responsive width */}
            <div className="flex-1 overflow-y-auto bg-[var(--color-card)] p-5 md:p-8 scroll-smooth text-[var(--color-text-primary)]">
              {/* Personality Tab */}
              {activeTab === 'personality' && (
                <div className="space-y-8">
                  <header>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Persona & Identity</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Customize Pustakam's personality and appearance.</p>
                  </header>

                  <section className="space-y-6">
                    <div className="space-y-4">
                      <label className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Theme Preference</label>
                      <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10">
                        <button
                          onClick={() => theme === 'dark' && onToggleTheme()}
                          className={`flex items-center justify-center gap-2.5 py-3 rounded-lg transition-all duration-200 ${theme === 'light'
                            ? 'bg-white text-gray-900 shadow-md ring-1 ring-black/5'
                            : 'text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'}`}
                        >
                          <Sun size={18} className={theme === 'light' ? 'text-orange-500' : ''} />
                          <span className="font-bold text-sm">Light Mode</span>
                        </button>
                        <button
                          onClick={() => theme === 'light' && onToggleTheme()}
                          className={`flex items-center justify-center gap-2.5 py-3 rounded-lg transition-all duration-200 ${theme === 'dark'
                            ? 'bg-[#1a1a1a] dark:bg-zinc-800 text-white shadow-md ring-1 ring-white/10'
                            : 'text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'}`}
                        >
                          <Moon size={18} className={theme === 'dark' ? 'text-orange-500' : ''} />
                          <span className="font-bold text-sm">Dark Mode</span>
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 italic">Adjusts the overall interface colors for better visibility.</p>
                    </div>

                    <div className="space-y-4 pt-6 border-t border-gray-100 dark:border-white/[0.05]">
                      <label className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Default Generation Mode</label>
                      <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10">
                        <button
                          onClick={() => setLocalSettings((p: APISettings) => ({ ...p, defaultGenerationMode: 'stellar' }))}
                          className={`flex items-center justify-center gap-2.5 py-3 rounded-lg transition-all duration-200 ${localSettings.defaultGenerationMode === 'stellar'
                            ? (theme === 'light' ? 'bg-white text-cyan-600 shadow-md ring-1 ring-black/5' : 'bg-cyan-500/20 text-cyan-400 shadow-md ring-1 ring-white/10')
                            : 'text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'}`}
                        >
                          <Sparkles size={18} />
                          <span className="font-bold text-sm">Stellar Mode</span>
                        </button>
                        <button
                          onClick={() => setLocalSettings((p: APISettings) => ({ ...p, defaultGenerationMode: 'blackhole' }))}
                          className={`flex items-center justify-center gap-2.5 py-3 rounded-lg transition-all duration-200 ${localSettings.defaultGenerationMode === 'blackhole'
                            ? (theme === 'light' ? 'bg-white text-orange-600 shadow-md ring-1 ring-black/5' : 'bg-orange-500/20 text-orange-400 shadow-md ring-1 ring-white/10')
                            : 'text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'}`}
                        >
                          <Crown size={18} />
                          <span className="font-bold text-sm">Blackhole Mode</span>
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 italic">
                        Sets the default personality for new books. "Stellar" is professional; "Blackhole" is raw and unrestricted.
                      </p>
                    </div>

                    <div className="space-y-4 pt-6 border-t border-gray-100 dark:border-white/[0.05]">
                      <label className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Default Language</label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-1 bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10">
                        <button
                          onClick={() => setLocalSettings((p: APISettings) => ({ ...p, defaultLanguage: 'en' }))}
                          className={`flex items-center justify-center gap-2.5 py-3 rounded-lg transition-all duration-200 ${localSettings.defaultLanguage === 'en'
                            ? (theme === 'light' ? 'bg-white text-blue-600 shadow-md ring-1 ring-black/5' : 'bg-blue-500/20 text-blue-400 shadow-md ring-1 ring-white/10')
                            : 'text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'}`}
                        >
                          <Globe size={16} />
                          <span className="font-bold text-sm">English</span>
                        </button>
                        {localSettings.defaultGenerationMode === 'blackhole' && (
                          <>
                            <button
                              onClick={() => setLocalSettings((p: APISettings) => ({ ...p, defaultLanguage: 'hi' }))}
                              className={`flex items-center justify-center gap-2.5 py-3 rounded-lg transition-all duration-200 ${localSettings.defaultLanguage === 'hi'
                                ? (theme === 'light' ? 'bg-white text-orange-600 shadow-md ring-1 ring-black/5' : 'bg-orange-500/20 text-orange-400 shadow-md ring-1 ring-white/10')
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'}`}
                            >
                              <span className="font-bold text-sm">Hindi (Tapori)</span>
                            </button>
                            <button
                              onClick={() => setLocalSettings((p: APISettings) => ({ ...p, defaultLanguage: 'mr' }))}
                              className={`flex items-center justify-center gap-2.5 py-3 rounded-lg transition-all duration-200 ${localSettings.defaultLanguage === 'mr'
                                ? (theme === 'light' ? 'bg-white text-orange-600 shadow-md ring-1 ring-black/5' : 'bg-orange-500/20 text-orange-400 shadow-md ring-1 ring-white/10')
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'}`}
                            >
                              <span className="font-bold text-sm">Marathi (Tapori)</span>
                            </button>
                          </>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 italic">
                        {localSettings.defaultGenerationMode === 'blackhole'
                          ? 'Desi "Tapori" modes are only available for Blackhole personality.'
                          : 'Standard English used for Stellar Mode.'}
                      </p>
                    </div>
                  </section>
                </div>
              )}
              {/* API Keys Tab */}
              {activeTab === 'keys' && (
                <div className="space-y-8">
                  <header>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Agni Stack Setup</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">This build is locked to four Zhipu GLM models and runs through the secure server proxy.</p>
                  </header>

                  <div className="rounded-2xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] p-5 space-y-5">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Server Environment</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                        Add <code>ZHIPU_API_KEY</code>, <code>SUPABASE_SERVICE_ROLE_KEY</code>, and <code>VITE_USE_PROXY=true</code> in Vercel and local development.
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">Approved Models</p>
                      <div className="space-y-2">
                        {ZHIPU_MODELS.map(model => (
                          <div key={model.model} className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-black/20 px-4 py-3">
                            <div>
                              <p className="text-sm font-bold text-gray-900 dark:text-white">{model.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{model.tagline}</p>
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500">{model.model}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Current Mode</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {APP_AI_BRANDLINE} uses the {AI_SUITE_NAME} proxy path, so no browser-side provider keys are needed anymore.
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 dark:border-white/[0.05]">
                    <button
                      onClick={onOpenAPIDocs}
                      className="text-xs font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-white flex items-center gap-2 transition-colors"
                    >
                      <BookMarked size={14} />
                      View API Setup Documentation
                    </button>
                  </div>
                </div>
              )}

              {/* Subscription Tab */}
              {activeTab === 'subscription' && (
                <div className="space-y-8">
                  <header>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Subscription</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Manage your plan details.</p>
                  </header>

                  {!isAuthenticated ? (
                    <div className="bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.08] rounded-xl p-6 text-center">
                      <User size={32} className="mx-auto text-gray-400 mb-3" />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Sign in to view your subscription details.</p>
                    </div>
                  ) : (
                    <>
                      {/* Premium Plan Card - Redesigned */}
                      <section className="relative overflow-hidden rounded-2xl">
                        {/* Gradient Background with Glassmorphism */}
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-teal-500/15 to-green-500/20 dark:from-emerald-500/10 dark:via-teal-500/5 dark:to-green-500/10" />
                        <div className="absolute inset-0 backdrop-blur-xl" />

                        {/* Animated Border Gradient */}
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-400/40 via-teal-400/30 to-green-400/40 dark:from-emerald-400/20 dark:via-teal-400/15 dark:to-green-400/20" style={{ padding: '1px' }}>
                          <div className="h-full w-full rounded-2xl bg-white/90 dark:bg-[#0a0a0f]/90 backdrop-blur-xl" />
                        </div>

                        {/* Content */}
                        <div className="relative p-8">
                          {/* Header with Crown Icon */}
                          <div className="flex items-start justify-between mb-6">
                            <div className="flex items-center gap-4">
                              <div className="relative">
                                <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl blur-lg opacity-50" />
                                <div className="relative p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg">
                                  <Crown size={24} className="text-white" />
                                </div>
                              </div>
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1">Active Plan</p>
                                <h4 className="text-2xl font-black tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
                                  {profile?.plan === 'monthly' ? 'Monthly PRO' : 'Yearly PRO'}
                                </h4>
                              </div>
                            </div>
                            <div className="px-3 py-1.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30">
                              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Premium</span>
                            </div>
                          </div>

                          {/* Features Grid */}
                          <div className="space-y-4 mb-6">
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-emerald-500/5 to-transparent dark:from-emerald-500/10 dark:to-transparent border-l-2 border-emerald-500">
                              <div className="p-2 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20">
                                <Sparkles size={18} className="text-emerald-600 dark:text-emerald-400" />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-bold text-gray-900 dark:text-white">Unlimited Generation</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Create unlimited books with AI</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-teal-500/5 to-transparent dark:from-teal-500/10 dark:to-transparent border-l-2 border-teal-500">
                              <div className="p-2 rounded-lg bg-teal-500/10 dark:bg-teal-500/20">
                                <Calendar size={18} className="text-teal-600 dark:text-teal-400" />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-bold text-gray-900 dark:text-white">Plan Valid Until</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {profile?.plan_expires_at
                                    ? new Date(profile.plan_expires_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                                    : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Stats Section */}
                          <div className="pt-6 border-t border-gray-200/50 dark:border-white/[0.05]">
                            <div className="flex items-center justify-end">
                              <div className="text-right">
                                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 mb-1">Status</p>
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Active</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </section>
                    </>
                  )}
                </div>
              )}

              {/* Data Tab */}
              {activeTab === 'data' && (
                <div className="space-y-8">
                  <header>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Knowledge Management</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Control your local library and archives.</p>
                  </header>

                  <section className="space-y-4">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Backup Operations</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={handleExportData}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-black text-xs font-bold rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap"
                      >
                        <Download size={14} />
                        Export Archive
                      </button>
                      <label className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 dark:border-white/[0.1] text-gray-700 dark:text-white text-xs font-bold rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-all cursor-pointer whitespace-nowrap">
                        <Upload size={14} />
                        Restore Library
                        <input type="file" ref={fileInputRef} onChange={handleImportPreview} accept=".json" className="hidden" />
                      </label>
                    </div>
                  </section>



                  <section className="pt-8 space-y-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-red-500">Danger Zone</h4>
                    <div className="p-4 rounded-xl border border-red-500/10 bg-red-500/[0.02]">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
                        Resetting the engine will purge all knowledge bases, session history, and GLM stack preferences.
                      </p>
                      <button
                      onClick={handleClearData}
                      className="text-xs font-black text-red-500 hover:text-red-400 flex items-center gap-2 transition-colors"
                    >
                      <Trash2 size={14} />
                      Purge All System Data
                      </button>
                    </div>
                  </section>
                </div>
              )}

              {/* Platform Tab */}
              {activeTab === 'about' && (
                <div className="space-y-10">
                  <div className="flex items-start gap-6">
                    <div className="w-16 h-16 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center border border-gray-200 dark:border-white/10 shrink-0">
                      <img src="/white-logo.png" alt="Logo" className="w-10 h-10 drop-shadow-sm dark:invert-0 invert" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black tracking-tight text-gray-900 dark:text-white">{APP_AI_BRANDLINE.toUpperCase()}</h3>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{AI_SUITE_NAME} Edition</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                        A focused GLM-only knowledge forge for modular book generation, streaming chapters, and structured learning assets.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                    {[
                      { icon: Zap, label: 'Neural Core', val: 'Low-latency' },
                      { icon: BookOpen, label: 'Export Engine', val: 'PDF / MD / TXT' },
                      { icon: Globe, label: 'Architecture', val: 'Hybrid PWA' },
                      { icon: Shield, label: 'Security', val: 'Client-side Enc.' }
                    ].map((idx, i) => (
                      <div key={i} className="space-y-1.5">
                        <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500">
                          <idx.icon size={12} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">{idx.label}</span>
                        </div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white ml-5">{idx.val}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4 pt-10 border-t border-gray-100 dark:border-white/[0.05]">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Developer Liaison</p>
                      <a href="https://www.linkedin.com/in/tanmay-kalbande/" target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-gray-900 dark:text-white hover:text-gray-300 transition-colors">
                        T. KALBANDE
                      </a>
                    </div>
                    <button
                      onClick={onOpenUsageGuide}
                      className="w-full flex items-center justify-between px-4 py-2 rounded-lg bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.05] hover:border-indigo-500/20 transition-all text-xs font-bold group"
                    >
                      <span className="text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors tracking-tight">Open User Manual & Guide</span>
                      <ChevronRight size={14} className="text-gray-300" />
                    </button>
                    <button
                      onClick={() => setShowDisclaimer(true)}
                      className="w-full flex items-center justify-between px-4 py-2 rounded-lg bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.05] hover:border-indigo-500/20 transition-all text-xs font-bold group"
                    >
                      <span className="text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors tracking-tight">System Regulatory Compliance</span>
                      <ChevronRight size={14} className="text-gray-300" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 md:px-8 py-5 bg-gray-50/80 dark:bg-black/40 border-t border-gray-100 dark:border-white/[0.05] flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-2 order-2 md:order-1">
              <div className="w-2 h-2 rounded-full bg-green-500 shadow-sm shadow-green-500/20" />
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">System Synchronized</span>
            </div>
            <div className="flex items-center gap-3 order-1 md:order-2 w-full md:w-auto">
              <button
                onClick={onClose}
                className="flex-1 md:flex-none text-xs font-bold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white px-4 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-[2] md:flex-none px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-black rounded-xl shadow-lg shadow-orange-500/20 active:scale-95 transition-all disabled:opacity-50 uppercase tracking-widest"
              >
                {isSaving ? 'Synchronizing...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Import Preview Modal */}
      {showImportModal && importPreview && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0a0a0f] border border-[var(--color-border)] rounded-2xl shadow-2xl w-full max-w-md p-8">
            <header className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                <AlertTriangle className="text-orange-500" size={20} />
                Confirm Data Import
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Review the details below before proceeding.</p>
            </header>

            <div className="space-y-6 mb-8 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.05]">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Items Included</p>
                  <p className="font-bold text-gray-900 dark:text-white">{importPreview.books.length} Books</p>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.05]">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Configuration</p>
                  <p className="font-bold text-gray-900 dark:text-white">{importPreview.settings ? 'Encrypted' : 'None'}</p>
                </div>
              </div>

              {(importPreview.conflicts.duplicateBooks > 0 || importPreview.conflicts.settingsConflict) && (
                <div className="p-4 rounded-xl border border-orange-500/20 bg-orange-500/[0.02]">
                  <p className="text-xs font-bold text-orange-600 dark:text-orange-400 mb-2">Detected Overwrites</p>
                  <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1 list-disc pl-4">
                    {importPreview.conflicts.duplicateBooks > 0 && <li>{importPreview.conflicts.duplicateBooks} existing records will be updated</li>}
                    {importPreview.conflicts.settingsConflict && <li>Provider configurations will be adjusted</li>}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => executeImport('merge')}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-black py-3 rounded-lg shadow-lg shadow-orange-500/10 transition-all"
              >
                Merge with Current Library
              </button>
              <button
                onClick={() => executeImport('replace')}
                className="w-full border border-gray-200 dark:border-white/[0.1] text-gray-700 dark:text-white text-xs font-bold py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-all"
              >
                Replace Entire Library
              </button>
              <button
                onClick={() => { setShowImportModal(false); setImportPreview(null); }}
                className="w-full text-xs font-bold text-gray-400 hover:text-gray-600 py-3 transition-colors"
              >
                Cancel Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlays */}
      {showDisclaimer && <DisclaimerPage isOpen={showDisclaimer} onClose={() => setShowDisclaimer(false)} />}
    </>
  );
}
