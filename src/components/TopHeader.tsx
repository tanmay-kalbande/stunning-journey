import React, { useState } from 'react';
import { Settings, User, LogOut, ChevronDown, BookOpen, Shield } from 'lucide-react';
import { APISettings, ModelProvider } from '../types';
import { BookProject } from '../types/book';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { AI_SUITE_NAME, ZHIPU_MODELS } from '../constants/ai';

interface TopHeaderProps {
    settings: APISettings;
    books: BookProject[];
    currentBookId: string | null;
    onModelChange: (model: string, provider: ModelProvider) => void;
    onOpenSettings: () => void;
    onSelectBook: (id: string | null) => void;
    onDeleteBook: (id: string) => void;
    onNewBook: () => void;
    theme: 'light' | 'dark';
    onToggleTheme: () => void;
    onOpenAuth: () => void;
    isAuthenticated: boolean;
    authEnabled?: boolean;
    user: SupabaseUser | null;
    userProfile: any | null;
    onSignOut: () => void;
    showModelSelector?: boolean;
    onOpenDocs?: () => void;
    onOpenAPIDocs?: () => void;
    centerContent?: React.ReactNode;
}


const MODEL_OPTIONS: { provider: ModelProvider; model: string; name: string; tagline: string }[] = ZHIPU_MODELS;

export const TopHeader: React.FC<TopHeaderProps> = ({
    settings,
    onModelChange,
    onOpenSettings,
    theme,
    onToggleTheme,
    onOpenAuth,
    isAuthenticated,
    authEnabled = true,
    user,
    userProfile,
    onSignOut,
    onOpenDocs,
    onOpenAPIDocs,
    showModelSelector = true,
    centerContent
}) => {
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showModelMenu, setShowModelMenu] = useState(false);

    const displayName = userProfile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

    const availableModels = MODEL_OPTIONS;

    // Get current model display name
    const currentModelName = MODEL_OPTIONS.find(m => m.model === settings.selectedModel)?.name || settings.selectedModel || 'Select Model';


    return (
        <>
            {/* Grok-style header with smooth fade */}
            <header className={`fixed top-0 left-0 right-0 z-50 px-6 md:px-12 py-4 ${theme === 'light' ? 'bg-gradient-to-b from-white via-white/80 to-transparent pb-8' : 'bg-gradient-to-b from-black via-black/80 to-transparent pb-8'}`} style={{ paddingTop: 'env(safe-area-inset-top, 1rem)' }}>
                <div className="flex items-center justify-between mt-2">
                    {/* Brand / Logo */}
                    <div className="flex items-center gap-2 select-none">
                        <img src={theme === 'light' ? '/black-logo.png' : '/white-logo.png'} alt="Pustakam" className="w-[33px] h-[33px] md:w-8 md:h-8" />
                        <div className="flex flex-col">
                            <span
                                className={`text-base md:text-lg tracking-tight leading-none ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}
                                style={{ fontFamily: "'Aptos-Mono', monospace", fontWeight: 700 }}
                            >
                                Pustakam
                            </span>
                            <span
                                className={`text-[10px] tracking-wide ${theme === 'light' ? 'text-gray-400' : 'text-gray-500'}`}
                                style={{ fontFamily: "'Aptos-Mono', monospace" }}
                            >
                                {AI_SUITE_NAME}
                            </span>
                        </div>
                    </div>

                    {/* Center Content */}
                    <div className="flex-1 flex justify-center">
                        {centerContent}
                    </div>

                    {/* Right Controls */}
                    <div className="flex items-center gap-3">
                        {/* Grok-style Model Selector */}
                        {showModelSelector && (
                            <div className="relative hidden md:block">
                                <button
                                    onClick={() => setShowModelMenu(!showModelMenu)}
                                    className={`flex items-center gap-2 pl-4 pr-3 py-2 rounded-full transition-all text-sm font-medium
                            ${theme === 'light'
                                            ? 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                                            : 'bg-[#1a1a1a] hover:bg-[#252525] text-gray-200'}
                        `}
                                >
                                    <span>{currentModelName}</span>
                                    <ChevronDown size={14} className={`opacity-50 transition-transform ${showModelMenu ? 'rotate-180' : ''}`} />
                                </button>

                                {/* Model Dropdown */}
                                {showModelMenu && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setShowModelMenu(false)} />
                                        <div
                                            className={`absolute top-full right-0 mt-2 w-64 rounded-xl shadow-2xl overflow-hidden z-50
                                    ${theme === 'light'
                                                    ? 'bg-white border border-gray-200'
                                                    : 'bg-[#1a1a1a] border border-white/10'}`}
                                            style={{
                                                animation: 'dropdownExpand 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                                                transformOrigin: 'top right'
                                            }}
                                        >
                                            <div className={`px-4 py-2 border-b ${theme === 'light' ? 'border-gray-100' : 'border-white/5'}`}>
                                                <p className={`text-xs font-medium uppercase tracking-wider ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>Model</p>
                                            </div>
                                            <div className="max-h-[300px] overflow-y-auto py-1">
                                                {availableModels.length === 0 ? (
                                                    <div className={`px-4 py-8 text-center ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>
                                                        <p className="text-sm mb-3">No GLM models available</p>
                                                        <button
                                                            onClick={() => { onOpenSettings(); setShowModelMenu(false); }}
                                                            className="text-xs font-semibold px-3 py-1.5 rounded-full bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 transition-colors"
                                                        >
                                                            Open Setup
                                                        </button>
                                                    </div>
                                                ) : (
                                                    availableModels.map((option) => {
                                                        const isSelected = settings.selectedModel === option.model;
                                                        return (
                                                            <button
                                                                key={`${option.provider}-${option.model}`}
                                                                onClick={() => {
                                                                    onModelChange(option.model, option.provider);
                                                                    setShowModelMenu(false);
                                                                }}
                                                                className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors
                                                        ${isSelected
                                                                        ? (theme === 'light' ? 'bg-gray-50 text-gray-900' : 'bg-white/5 text-white')
                                                                        : (theme === 'light' ? 'text-gray-600 hover:bg-gray-50 hover:text-gray-900' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200')}
                                                    `}
                                                            >
                                                                <div>
                                                                    <div className="font-medium">{option.name}</div>
                                                                    <div className="text-[10px] opacity-50 uppercase tracking-wider mt-0.5">
                                                                        {option.tagline}
                                                                    </div>
                                                                </div>
                                                                {isSelected && (
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                                                                )}
                                                            </button>
                                                        );
                                                    })
                                                )}
                                            </div>
                                            <div className={`border-t ${theme === 'light' ? 'border-gray-100' : 'border-white/5'} p-2`}>
                                                <button
                                                    onClick={() => {
                                                        onOpenSettings();
                                                        setShowModelMenu(false);
                                                    }}
                                                    className={`w-full text-center px-3 py-2 text-xs font-medium rounded-lg transition-colors
                                            ${theme === 'light' ? 'text-gray-500 hover:bg-gray-100 hover:text-gray-900' : 'text-gray-400 hover:bg-white/5 hover:text-white'}
                                        `}
                                                >
                                                    Open AI Setup
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}



                        {/* Usage Guide Quick Link */}
                        <button
                            onClick={onOpenDocs}
                            className={`p-2 rounded-lg transition-colors ${theme === 'light' ? 'text-gray-400 hover:text-orange-500 hover:bg-orange-50' : 'text-gray-500 hover:text-orange-400 hover:bg-white/5'}`}
                            title="Usage Guide"
                        >
                            <BookOpen size={20} />
                        </button>

                        {/* API Documentation Quick Link */}
                        <button
                            onClick={onOpenAPIDocs}
                            className={`p-2 rounded-lg transition-colors ${theme === 'light' ? 'text-gray-400 hover:text-emerald-500 hover:bg-emerald-50' : 'text-gray-500 hover:text-emerald-400 hover:bg-white/5'}`}
                            title="API Documentation"
                        >
                            <Shield size={20} />
                        </button>

                        {/* Auth State */}
                        {isAuthenticated ? (
                            <div className="relative">
                                <button
                                    onClick={() => setShowUserMenu(!showUserMenu)}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all border
                                ${theme === 'light'
                                            ? 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700'
                                            : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10 text-gray-200'}
                            `}
                                >
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${theme === 'light' ? 'bg-gray-200 text-gray-600' : 'bg-white/20 text-white'}`}>
                                        {displayName.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-sm font-medium max-w-[100px] truncate hidden sm:block">{displayName}</span>
                                    <ChevronDown size={16} className="opacity-50" />
                                </button>

                                {showUserMenu && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                                        <div className={`absolute top-full right-0 mt-2 w-52 rounded-xl border shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200
                                    ${theme === 'light' ? 'bg-white border-gray-200' : 'bg-[#1a1a1a] border-white/10'}`}
                                            style={{
                                                animation: 'dropdownExpand 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                                                transformOrigin: 'top right'
                                            }}
                                        >
                                            <div className={`px-4 py-3 border-b ${theme === 'light' ? 'border-gray-100' : 'border-white/5'}`}>
                                                <p className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>Signed in as</p>
                                                <p className={`text-sm font-medium truncate mt-0.5 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>{user?.email}</p>
                                            </div>
                                            <div className="py-1">
                                                <button
                                                    onClick={() => {
                                                        onOpenSettings();
                                                        setShowUserMenu(false);
                                                    }}
                                                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors
                                            ${theme === 'light' ? 'text-gray-700 hover:bg-gray-50' : 'text-gray-300 hover:bg-white/5'}`}
                                                >
                                                    <Settings size={16} />
                                                    Settings
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        onSignOut();
                                                        setShowUserMenu(false);
                                                    }}
                                                    className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-3 transition-colors"
                                                >
                                                    <LogOut size={16} />
                                                    Sign Out
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : authEnabled ? (
                            <button
                                onClick={onOpenAuth}
                                className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold shadow-lg hover:shadow-orange-500/20 transition-all"
                            >
                                <User size={18} />
                                <span>Sign In</span>
                            </button>
                        ) : (
                            <div
                                className={`px-4 py-2 rounded-lg text-sm font-semibold border ${
                                    theme === 'light'
                                        ? 'bg-white border-gray-200 text-gray-500'
                                        : 'bg-white/5 border-white/10 text-gray-400'
                                }`}
                            >
                                Local Preview
                            </div>
                        )}

                    </div>
                </div>
            </header >
        </>
    );
};
