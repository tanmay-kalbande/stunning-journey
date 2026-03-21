// src/components/SettingsModal.tsx
import React from 'react';
import { X, Database, Download, Upload, Trash2, Settings, Sparkles, Globe, Cpu, BookOpen, ChevronRight, Crown, Sun, Moon, Info, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { APISettings } from '../types';
import { storageUtils } from '../utils/storage';
import { DisclaimerPage } from './DisclaimerPage';
import NebulaBackground from './NebulaBackground';
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

// Only three real tabs — 'keys' was broken (immediately redirected away) so removed
type ActiveTab = 'personality' | 'data' | 'about';

interface ImportPreview {
  books: any[];
  settings: APISettings;
  conflicts: {
    duplicateBooks: number;
    settingsConflict: boolean;
  };
}

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  theme,
  onToggleTheme,
  onOpenAPIDocs,
  onOpenUsageGuide,
  onOpenCompliance,
  showAlertDialog,
}: SettingsModalProps) {
  const [localSettings, setLocalSettings] = React.useState<APISettings>(settings);
  const { user } = useAuth();
  const [activeTab, setActiveTab] = React.useState<ActiveTab>('personality');
  const [importPreview, setImportPreview] = React.useState<ImportPreview | null>(null);
  const [showImportModal, setShowImportModal] = React.useState(false);
  const [showDisclaimer, setShowDisclaimer] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings, isOpen]);

  const handleSave = () => {
    setIsSaving(true);
    onSaveSettings(localSettings);
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
      version: '1.0.0',
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

        const duplicateBooks = importData.books
          ? importData.books.filter((importBook: any) =>
              existingBooks.some((eb) => eb.id === importBook.id)
            ).length
          : 0;

        const settingsConflict =
          importData.settings &&
          JSON.stringify(existingSettings) !== JSON.stringify(importData.settings);

        setImportPreview({
          books: importData.books || [],
          settings: importData.settings || existingSettings,
          conflicts: { duplicateBooks, settingsConflict },
        });
        setShowImportModal(true);
      } catch {
        showAlertDialog({
          type: 'error',
          title: 'Invalid File',
          message: 'Failed to read import file. Please check the file format.',
          confirmText: 'OK',
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
        const mergedBooks = [...existingBooks];
        importPreview.books.forEach((importBook: any) => {
          if (!mergedBooks.some((eb) => eb.id === importBook.id)) {
            mergedBooks.push(importBook);
          }
        });
        storageUtils.saveBooks(mergedBooks, user?.id);
        storageUtils.saveSettings(importPreview.settings);
        setLocalSettings(importPreview.settings);
      }

      setShowImportModal(false);
      setImportPreview(null);
      showAlertDialog({
        type: 'success',
        title: 'Import Successful',
        message: `Data imported using ${mode} mode. The app will reload.`,
        confirmText: 'OK',
        onConfirm: () => window.location.reload(),
      });
    } catch (error) {
      let message = 'Failed to import data. Please check the file and try again.';
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        message = 'Import failed: Browser storage is full.';
      }
      showAlertDialog({ type: 'error', title: 'Import Failed', message, confirmText: 'Dismiss' });
    }
  };

  const handleClearData = () => {
    showAlertDialog({
      type: 'confirm',
      title: 'Confirm Data Deletion',
      message: 'This will permanently delete all books and settings. This action cannot be undone.',
      confirmText: 'Yes, Delete All',
      cancelText: 'Cancel',
      onConfirm: () => {
        storageUtils.clearAll();
        showAlertDialog({
          type: 'success',
          title: 'Data Cleared',
          message: 'All data has been cleared. The app will reload.',
          confirmText: 'OK',
          onConfirm: () => window.location.reload(),
        });
      },
    });
  };

  if (!isOpen) return null;

  const NAV_TABS: { id: ActiveTab; label: string; icon: React.ElementType }[] = [
    { id: 'personality', label: 'Persona & Identity', icon: Sparkles },
    { id: 'data',        label: 'Data & Backup',      icon: Database },
    { id: 'about',       label: 'About',               icon: Cpu },
  ];

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-3 md:items-center md:p-4 backdrop-blur-md"
        onClick={onClose}
      >
        <div
          className="relative my-auto flex max-h-[calc(100vh-24px)] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#080808] shadow-[0_30px_120px_rgba(0,0,0,0.55)] md:max-h-[calc(100vh-40px)]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Background effects */}
          <div className="pointer-events-none absolute inset-0 opacity-45">
            <NebulaBackground opacity={0.28} />
          </div>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01)),radial-gradient(circle_at_top,rgba(249,115,22,0.12),transparent_30%)]" />

          {/* Header */}
          <div className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/[0.08] px-5 py-3.5 md:px-7">
            <div className="flex items-center gap-3">
              <div className="rounded-full border border-orange-400/20 bg-orange-400/10 p-2 text-orange-300">
                <Settings size={16} />
              </div>
              <div>
                <h2 className="text-xs font-bold uppercase tracking-[0.22em] text-orange-200/80">System Preferences</h2>
                <p className="mt-1 text-xs text-white/40">Workspace controls for Injin</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/[0.03] p-2 text-gray-400 transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          <div className="relative z-10 flex min-h-0 flex-1 overflow-hidden flex-col md:flex-row">
            {/* Sidebar */}
            <div className="flex w-full flex-col overflow-hidden border-b border-white/[0.06] bg-black/35 backdrop-blur-xl md:w-[280px] md:border-b-0 md:border-r">
              <div className="flex flex-1 items-center overflow-x-auto p-4 whitespace-nowrap custom-scrollbar md:flex-col md:items-start md:overflow-x-hidden md:overflow-y-auto md:p-6 md:whitespace-normal">
                <div className="flex items-center gap-2 mb-0 md:mb-8 mr-6 md:mr-0 shrink-0">
                  <div className="h-6 w-1.5 rounded-full bg-gradient-to-b from-orange-500 to-amber-300 md:h-8 md:w-2" />
                  <h2 className="text-base font-black uppercase tracking-tight text-white md:text-xl">System</h2>
                </div>

                <nav className="flex md:flex-col space-x-1 md:space-x-0 md:space-y-1 shrink-0">
                  {NAV_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 text-left text-xs font-bold whitespace-nowrap transition-all duration-300 md:py-3 md:text-sm ${
                        activeTab === tab.id
                          ? 'bg-white/[0.08] text-orange-300 ring-1 ring-orange-400/20'
                          : 'text-white/50 hover:bg-white/[0.04] hover:text-white'
                      }`}
                    >
                      <tab.icon
                        size={activeTab === tab.id ? 18 : 16}
                        className={`shrink-0 ${activeTab === tab.id ? 'text-orange-300' : 'opacity-50'}`}
                      />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </nav>

                {/* Resource links */}
                <div className="hidden md:block mt-8 pt-6 border-t border-white/[0.06] w-full">
                  <p className="mb-4 px-4 text-[10px] font-black uppercase tracking-widest text-white/35">Resources</p>
                  <div className="space-y-1">
                    <button
                      onClick={onOpenUsageGuide}
                      className="flex w-full items-center gap-3 px-4 py-2 text-xs font-bold text-white/50 transition-colors hover:text-orange-300"
                    >
                      <Info size={14} /> Usage Guide
                    </button>
                    <button
                      onClick={onOpenCompliance}
                      className="flex w-full items-center gap-3 px-4 py-2 text-xs font-bold text-white/50 transition-colors hover:text-orange-300"
                    >
                      <Shield size={14} /> Compliance
                    </button>
                  </div>
                </div>
              </div>

              {/* Theme toggle (desktop only) */}
              <div className="hidden md:flex mt-auto border-t border-white/[0.06] p-6">
                <button
                  onClick={onToggleTheme}
                  className="group flex w-full items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 transition-all hover:border-orange-500/30"
                >
                  <div className="flex items-center gap-3">
                    {theme === 'light' ? (
                      <Sun size={18} className="text-amber-400" />
                    ) : (
                      <Moon size={18} className="text-orange-300" />
                    )}
                    <span className="text-sm font-bold capitalize text-white/80">{theme} Mode</span>
                  </div>
                  <div className={`w-8 h-4 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-orange-500' : 'bg-gray-200'}`}>
                    <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all ${theme === 'dark' ? 'left-5' : 'left-1'}`} />
                  </div>
                </button>
              </div>
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] p-5 text-[var(--color-text-primary)] scroll-smooth md:p-6">

              {/* ── PERSONALITY TAB ── */}
              {activeTab === 'personality' && (
                <div className="space-y-8">
                  <header>
                    <h3 className="mb-1 text-lg font-bold text-white">Persona & Identity</h3>
                    <p className="text-sm text-white/50">Customize appearance and default generation behaviour.</p>
                  </header>

                  {/* Theme */}
                  <section className="space-y-4">
                    <label className="text-xs font-bold uppercase tracking-widest text-white/35">Theme Preference</label>
                    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
                      {(['light', 'dark'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => theme !== t && onToggleTheme()}
                          className={`flex items-center justify-center gap-2.5 py-3 rounded-lg transition-all duration-200 capitalize font-bold text-sm ${
                            theme === t
                              ? 'bg-white/10 text-white shadow-md ring-1 ring-white/10'
                              : 'text-gray-500 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          {t === 'light' ? <Sun size={18} className={theme === 'light' ? 'text-orange-500' : ''} /> : <Moon size={18} className={theme === 'dark' ? 'text-orange-500' : ''} />}
                          {t} Mode
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* Generation mode */}
                  <section className="space-y-4 pt-6 border-t border-white/[0.05]">
                    <label className="text-xs font-bold uppercase tracking-widest text-white/35">Default Generation Mode</label>
                    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
                      {[
                        { value: 'stellar',   label: 'Stellar Mode', icon: Sparkles },
                        { value: 'blackhole', label: 'Street Mode',  icon: Crown },
                      ].map(({ value, label, icon: Icon }) => (
                        <button
                          key={value}
                          onClick={() => setLocalSettings(p => ({ ...p, defaultGenerationMode: value as any }))}
                          className={`flex items-center justify-center gap-2.5 py-3 rounded-lg transition-all duration-200 font-bold text-sm ${
                            localSettings.defaultGenerationMode === value
                              ? 'bg-orange-500/20 text-orange-400 shadow-md ring-1 ring-white/10'
                              : 'text-gray-500 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <Icon size={18} /> {label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] italic text-white/35">
                      Stellar is professional. Street is raw and unrestricted.
                    </p>
                  </section>

                  {/* Language */}
                  <section className="space-y-4 pt-6 border-t border-white/[0.05]">
                    <label className="text-xs font-bold uppercase tracking-widest text-white/35">Default Language</label>
                    <div className="grid grid-cols-1 gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1 md:grid-cols-3">
                      {[
                        { value: 'en', label: 'English' },
                        ...(localSettings.defaultGenerationMode === 'blackhole'
                          ? [
                              { value: 'hi', label: 'Hindi (Tapori)' },
                              { value: 'mr', label: 'Marathi (Tapori)' },
                            ]
                          : []),
                      ].map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={() => setLocalSettings(p => ({ ...p, defaultLanguage: value as any }))}
                          className={`flex items-center justify-center gap-2 py-3 rounded-lg transition-all duration-200 font-bold text-sm ${
                            localSettings.defaultLanguage === value
                              ? 'bg-blue-500/20 text-blue-400 shadow-md ring-1 ring-white/10'
                              : 'text-gray-500 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <Globe size={16} /> {label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] italic text-white/35">
                      {localSettings.defaultGenerationMode === 'blackhole'
                        ? 'Desi "Tapori" modes are only available for Street personality.'
                        : 'Standard English used for Stellar Mode.'}
                    </p>
                  </section>
                </div>
              )}

              {/* ── DATA TAB ── */}
              {activeTab === 'data' && (
                <div className="space-y-8">
                  <header>
                    <h3 className="mb-1 text-lg font-bold text-white">Knowledge Management</h3>
                    <p className="text-sm text-white/50">Control your local library and archives.</p>
                  </header>

                  <section className="space-y-4">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/35">Backup Operations</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={handleExportData}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-white text-black text-xs font-bold rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap"
                      >
                        <Download size={14} /> Export Archive
                      </button>
                      <label className="flex items-center justify-center gap-2 px-4 py-2 border border-white/[0.1] text-white text-xs font-bold rounded-lg hover:bg-white/[0.03] transition-all cursor-pointer whitespace-nowrap">
                        <Upload size={14} /> Restore Library
                        <input type="file" ref={fileInputRef} onChange={handleImportPreview} accept=".json" className="hidden" />
                      </label>
                    </div>
                  </section>

                  <section className="pt-8 space-y-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-red-400">Danger Zone</h4>
                    <div className="p-4 rounded-xl border border-red-500/10 bg-red-500/[0.02]">
                      <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                        Resetting the engine will purge all knowledge bases, session history, and preferences.
                      </p>
                      <button
                        onClick={handleClearData}
                        className="text-xs font-black text-red-500 hover:text-red-400 flex items-center gap-2 transition-colors"
                      >
                        <Trash2 size={14} /> Purge All System Data
                      </button>
                    </div>
                  </section>
                </div>
              )}

              {/* ── ABOUT TAB ── */}
              {activeTab === 'about' && (
                <div className="space-y-10">
                  <div className="flex items-start gap-6">
                    <div className="w-16 h-16 rounded-xl bg-white/[0.04] flex items-center justify-center border border-white/10 shrink-0">
                      <img src="/white-logo.png" alt="Logo" className="w-10 h-10 dark:invert-0 invert" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black tracking-tight text-white">{APP_AI_BRANDLINE.toUpperCase()}</h3>
                      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-white/35">{AI_SUITE_NAME} Edition</p>
                      <p className="text-sm font-medium leading-relaxed text-white/50">
                        A focused GLM-only knowledge forge for modular book generation, streaming chapters, and structured learning assets.
                      </p>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                    {[
                      { label: 'Models',      val: `${ZHIPU_MODELS.length} GLM` },
                      { label: 'Export',      val: 'PDF / MD' },
                      { label: 'Architecture', val: 'Hybrid PWA' },
                      { label: 'Security',    val: 'Client-side Enc.' },
                    ].map(({ label, val }) => (
                      <div key={label} className="space-y-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</p>
                        <p className="text-sm font-bold text-white ml-0">{val}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4 pt-10 border-t border-white/[0.05]">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Developer</p>
                      <a
                        href="https://www.linkedin.com/in/tanmay-kalbande/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-white hover:text-gray-300 transition-colors"
                      >
                        T. KALBANDE
                      </a>
                    </div>
                    <button
                      onClick={onOpenUsageGuide}
                      className="w-full flex items-center justify-between px-4 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05] hover:border-indigo-500/20 transition-all text-xs font-bold group"
                    >
                      <span className="text-gray-400 group-hover:text-white transition-colors">Open User Manual & Guide</span>
                      <ChevronRight size={14} className="text-gray-300" />
                    </button>
                    <button
                      onClick={onOpenAPIDocs}
                      className="w-full flex items-center justify-between px-4 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05] hover:border-indigo-500/20 transition-all text-xs font-bold group"
                    >
                      <span className="text-gray-400 group-hover:text-white transition-colors">API Documentation</span>
                      <ChevronRight size={14} className="text-gray-300" />
                    </button>
                    <button
                      onClick={() => setShowDisclaimer(true)}
                      className="w-full flex items-center justify-between px-4 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05] hover:border-indigo-500/20 transition-all text-xs font-bold group"
                    >
                      <span className="text-gray-400 group-hover:text-white transition-colors">System Regulatory Compliance</span>
                      <ChevronRight size={14} className="text-gray-300" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="relative z-10 flex shrink-0 flex-col items-center justify-between gap-4 border-t border-white/[0.08] bg-black/35 px-4 py-4 backdrop-blur-xl md:flex-row md:gap-0 md:px-6">
            <div className="flex items-center gap-2 order-2 md:order-1">
              <div className="w-2 h-2 rounded-full bg-green-500 shadow-sm shadow-green-500/20" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">System Synchronized</span>
            </div>
            <div className="flex items-center gap-3 order-1 md:order-2 w-full md:w-auto">
              <button
                onClick={onClose}
                className="flex-1 px-4 text-xs font-bold text-white/45 transition-colors hover:text-white md:flex-none"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-[2] md:flex-none px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-black rounded-xl shadow-lg shadow-orange-500/20 active:scale-95 transition-all disabled:opacity-50 uppercase tracking-widest"
              >
                {isSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Import confirm modal */}
      {showImportModal && importPreview && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-[#0a0a0f] border border-[var(--color-border)] rounded-2xl shadow-2xl w-full max-w-md p-8">
            <h3 className="text-lg font-bold text-white mb-1">Confirm Data Import</h3>
            <p className="text-sm text-gray-400 mb-6">Review the details below before proceeding.</p>

            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
              <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Items</p>
                <p className="font-bold text-white">{importPreview.books.length} Books</p>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Config</p>
                <p className="font-bold text-white">{importPreview.settings ? 'Included' : 'None'}</p>
              </div>
            </div>

            {importPreview.conflicts.duplicateBooks > 0 && (
              <div className="p-4 rounded-xl border border-orange-500/20 bg-orange-500/[0.02] mb-6">
                <p className="text-xs font-bold text-orange-400 mb-1">⚠️ Conflicts detected</p>
                <p className="text-xs text-gray-400">{importPreview.conflicts.duplicateBooks} existing record(s) will be updated</p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button
                onClick={() => executeImport('merge')}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-black py-3 rounded-lg transition-all"
              >
                Merge with Current Library
              </button>
              <button
                onClick={() => executeImport('replace')}
                className="w-full border border-white/[0.1] text-white text-xs font-bold py-3 rounded-lg hover:bg-white/[0.03] transition-all"
              >
                Replace Entire Library
              </button>
              <button
                onClick={() => { setShowImportModal(false); setImportPreview(null); }}
                className="w-full text-xs font-bold text-gray-400 hover:text-gray-200 py-3 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showDisclaimer && (
        <DisclaimerPage isOpen={showDisclaimer} onClose={() => setShowDisclaimer(false)} />
      )}
    </>
  );
}
