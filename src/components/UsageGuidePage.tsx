import React from 'react';
import { ArrowLeft, BookOpen, PenTool, Library, Settings, Sparkles, Navigation, Zap, Shield, Globe, Cpu } from 'lucide-react';

import { motion } from 'framer-motion';

interface UsageGuidePageProps {
    onClose: () => void;
}

const UsageGuidePage: React.FC<UsageGuidePageProps> = ({ onClose }) => {
    return (
        <div className="fixed inset-0 z-[100] bg-[#050505] overflow-auto font-sans selection:bg-orange-500/30">
            {/* Header */}
            <header className="sticky top-0 z-[60] bg-[#050505]/80 backdrop-blur-2xl border-b border-white/5 px-6 py-4">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <button
                        onClick={onClose}
                        className="flex items-center gap-2 text-white/40 hover:text-white transition-all duration-300 group"
                    >
                        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                        <span className="text-sm font-medium">Exit Guide</span>
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">Version 2.7.0</span>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-5xl mx-auto px-6 py-16 md:py-24">
                {/* Hero Section */}
                <div className="mb-20 text-center md:text-left">
                    <span className="text-[11px] font-mono tracking-[0.4em] uppercase text-orange-500 mb-6 block font-bold">The Knowledge Protocol</span>
                    <h1 className="text-5xl md:text-7xl font-bold text-white mb-8 tracking-tighter leading-none">
                        Mastering <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">Pustakam</span>
                    </h1>
                    <p className="text-white/50 text-xl leading-relaxed max-w-2xl mb-12">
                        A comprehensive blueprint for generating high-fidelity digital books, learning guides, and raw street-smart knowledge.
                    </p>

                    {/* Knowledge Synthesis Protocol Status Bar */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="max-w-xl bg-white/[0.03] border border-white/5 rounded-2xl p-4 md:p-6 backdrop-blur-sm"
                    >
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="flex items-center gap-4">
                                <div className="flex -space-x-2">
                                    <div className="w-8 h-8 rounded-full bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.4)]" />
                                    <div className="w-8 h-8 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]" />
                                    <div className="w-8 h-8 rounded-full bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.4)] animate-pulse" />
                                </div>
                                <div className="h-1 w-32 bg-white/5 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full bg-gradient-to-r from-orange-500 via-emerald-500 to-purple-500"
                                        animate={{ x: [-128, 128] }}
                                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                                    />
                                </div>
                            </div>
                            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">Knowledge Synthesis Protocol Active</span>
                        </div>
                    </motion.div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
                    {/* Left Column: Core Modes */}
                    <div className="lg:col-span-8 space-y-20">

                        {/* 1. The Core Choice */}
                        <section className="space-y-8">
                            <div className="flex items-center gap-4 text-white">
                                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                                    <Zap className="text-orange-500" size={24} />
                                </div>
                                <div>
                                    <h2 className="text-3xl font-bold tracking-tight">The Mode Protocol</h2>
                                    <p className="text-white/40 text-sm">Choose your delivery style</p>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Street Mode */}
                                <div className="group p-8 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-cyan-500/30 hover:bg-cyan-500/[0.02] transition-all duration-500">
                                    <div className="flex items-center justify-between mb-6">
                                        <span className="px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-[10px] font-bold uppercase tracking-widest border border-cyan-500/20">Street Mode</span>
                                        <Zap size={20} className="text-cyan-500/40 group-hover:text-cyan-400 transition-colors" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-3">Raw & Gritty</h3>
                                    <p className="text-white/50 text-sm leading-relaxed mb-6">
                                        Designed for a conversational, "Bhai-style" learning experience. Best for Marathi, Hindi, or Hinglish reasoning.
                                    </p>
                                    <ul className="space-y-3">
                                        <li className="flex items-center gap-2 text-[13px] text-white/70">
                                            <div className="w-1 h-1 rounded-full bg-cyan-500" />
                                            Gritty, conversational tone
                                        </li>
                                        <li className="flex items-center gap-2 text-[13px] text-white/70">
                                            <div className="w-1 h-1 rounded-full bg-cyan-500" />
                                            Direct & unfiltered insights
                                        </li>
                                        <li className="flex items-center gap-2 text-[13px] text-white/70">
                                            <div className="w-1 h-1 rounded-full bg-cyan-500" />
                                            Excels in Desi languages
                                        </li>
                                    </ul>
                                </div>

                                {/* Stellar Mode */}
                                <div className="group p-8 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-purple-500/30 hover:bg-purple-500/[0.02] transition-all duration-500">
                                    <div className="flex items-center justify-between mb-6">
                                        <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-[10px] font-bold uppercase tracking-widest border border-purple-500/20">Stellar Mode</span>
                                        <Sparkles size={20} className="text-purple-500/40 group-hover:text-purple-400 transition-colors" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-3">Deep & Academic</h3>
                                    <p className="text-white/50 text-sm leading-relaxed mb-6">
                                        The gold standard for comprehensive textbooks and structured knowledge. Professional and detailed.
                                    </p>
                                    <ul className="space-y-3">
                                        <li className="flex items-center gap-2 text-[13px] text-white/70">
                                            <div className="w-1 h-1 rounded-full bg-purple-500" />
                                            Structured educational flow
                                        </li>
                                        <li className="flex items-center gap-2 text-[13px] text-white/70">
                                            <div className="w-1 h-1 rounded-full bg-purple-500" />
                                            Formal & comprehensive tone
                                        </li>
                                        <li className="flex items-center gap-2 text-[13px] text-white/70">
                                            <div className="w-1 h-1 rounded-full bg-purple-500" />
                                            Ideal for professional guides
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </section>


                        {/* 2. Prompting Excellence */}
                        <section className="space-y-8">
                            <div className="flex items-center gap-4 text-white">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                    <PenTool className="text-emerald-500" size={24} />
                                </div>
                                <div>
                                    <h2 className="text-3xl font-bold tracking-tight">Prompt Engineering</h2>
                                    <p className="text-white/40 text-sm">How to talk to the engine</p>
                                </div>
                            </div>

                            <div className="p-10 rounded-[2rem] bg-gradient-to-br from-white/[0.05] to-transparent border border-white/10 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <PenTool size={120} />
                                </div>

                                <div className="relative z-10 space-y-8">
                                    <div className="grid md:grid-cols-2 gap-12">
                                        <div className="space-y-4">
                                            <h4 className="text-sm font-bold uppercase tracking-wider text-emerald-400">The Formula</h4>
                                            <p className="text-white/70 text-base leading-relaxed">
                                                <strong className="text-white">Topic + Target Audience + Specific Goal = Perfection.</strong>
                                            </p>
                                            <p className="text-white/50 text-[13px] leading-relaxed">
                                                Don't just say "Stocks". Say "A complete guide to Fundamental Analysis of Indian Tech Stocks for a 20-year old beginner."
                                            </p>
                                        </div>
                                        <div className="space-y-4">
                                            <h4 className="text-sm font-bold uppercase tracking-wider text-red-400">What to Avoid</h4>
                                            <ul className="space-y-3 text-[13px] text-white/50">
                                                <li className="flex gap-3">
                                                    <span className="text-red-500 font-bold">×</span> Vague one-word topics
                                                </li>
                                                <li className="flex gap-3">
                                                    <span className="text-red-500 font-bold">×</span> Ambiguous language settings
                                                </li>
                                                <li className="flex gap-3">
                                                    <span className="text-red-500 font-bold">×</span> Missing the "Persona" context
                                                </li>
                                            </ul>
                                        </div>
                                    </div>

                                    <div className="p-6 rounded-2xl bg-black/40 border border-white/5 font-mono text-[13px]">
                                        <p className="text-emerald-500/60 mb-2 uppercase text-[10px] tracking-widest font-bold">Pro Example</p>
                                        <p className="text-white/80 leading-relaxed italic">
                                            "Explain Quantum Computing basics using cricket analogies, specifically for someone who hates math. Keep it funny but technical."
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* 3. The Library System */}
                        <section className="space-y-8">
                            <div className="flex items-center gap-4 text-white">
                                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                    <Library className="text-blue-500" size={24} />
                                </div>
                                <div>
                                    <h2 className="text-3xl font-bold tracking-tight">The Vault</h2>
                                    <p className="text-white/40 text-sm">Managing your collection</p>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-3 gap-6">
                                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                                    <Shield className="text-white/20 mb-4" size={20} />
                                    <h4 className="text-white font-semibold mb-2 text-sm">Privacy First</h4>
                                    <p className="text-white/40 text-xs leading-relaxed">Everything is stored in your browser's local storage. Your books never leave your device.</p>
                                </div>
                                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                                    <Globe className="text-white/20 mb-4" size={20} />
                                    <h4 className="text-white font-semibold mb-2 text-sm">Offline Access</h4>
                                    <p className="text-white/40 text-xs leading-relaxed">Once a book is generated, you can read it anywhere—even without an internet connection.</p>
                                </div>
                                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                                    <Settings className="text-white/20 mb-4" size={20} />
                                    <h4 className="text-white font-semibold mb-2 text-sm">Data Control</h4>
                                    <p className="text-white/40 text-xs leading-relaxed">Export your entire library as JSON for backup, or delete books you no longer need.</p>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Right Column: Advanced Sidebar */}
                    <div className="lg:col-span-4 space-y-10">

                        {/* Engine Breakdown */}
                        <div className="p-8 rounded-[2.5rem] bg-orange-500/[0.03] border border-orange-500/20">
                            <div className="flex items-center gap-3 mb-8">
                                <Cpu className="text-orange-500" size={20} />
                                <h3 className="text-lg font-bold text-white tracking-tight uppercase">Engine Intelligence</h3>
                            </div>

                            <div className="space-y-8">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-white uppercase tracking-wider">GPT-120B / GLM-4.7</span>
                                        <span className="text-[10px] text-orange-500 font-mono">Elite Street</span>
                                    </div>
                                    <p className="text-[12px] text-white/40 leading-relaxed font-medium">
                                        The absolute go-to for raw energy. GLM-4.7 handles complex regional nuances while GPT-120B provides unmatched depth.
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-white uppercase tracking-wider">Qwen-3-235B</span>
                                        <span className="text-[10px] text-orange-500 font-mono">Multilingual King</span>
                                    </div>
                                    <p className="text-[12px] text-white/40 leading-relaxed font-medium">
                                        The beast for Desi languages. Best in class for Marathi and Hindi reasoning with zero western bias.
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-white uppercase tracking-wider">Gemma-3-27b / Mistral Large</span>
                                        <span className="text-[10px] text-orange-500 font-mono">High Energy</span>
                                    </div>
                                    <p className="text-[12px] text-white/40 leading-relaxed font-medium">
                                        Perfect for high-speed generations. Mistral Large provides creative flow, while Gemma-3 excels in structured logic.
                                    </p>
                                </div>

                                <div className="space-y-3 pt-4 border-t border-white/5">
                                    <span className="text-[10px] uppercase tracking-[0.2em] text-white/20 block mb-2">Technical Note</span>
                                    <p className="text-[11px] text-white/30 italic leading-relaxed">
                                        Ensure your API provider (Groq, OpenRouter, etc.) is configured with a valid key in the dashboard for these engines to strike.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Reading Features */}
                        <div className="p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/5">
                            <h3 className="text-lg font-bold text-white mb-8 flex items-center gap-3">
                                <BookOpen size={20} className="text-white/40" />
                                Reader View
                            </h3>
                            <ul className="space-y-6">
                                <li className="flex gap-4">
                                    <Navigation className="text-orange-500 shrink-0" size={18} />
                                    <div>
                                        <h5 className="text-[13px] font-bold text-white uppercase mb-1">Pulse Navigation</h5>
                                        <p className="text-[12px] text-white/40 leading-relaxed">Instant Table of Contents sidebar for rapid module switching.</p>
                                    </div>
                                </li>
                                <li className="flex gap-4">
                                    <Zap className="text-cyan-500 shrink-0" size={18} />
                                    <div>
                                        <h5 className="text-[13px] font-bold text-white uppercase mb-1">Live Enhancement</h5>
                                        <p className="text-[12px] text-white/40 leading-relaxed">Highlight any section to generate deeper insights or alternative explanations mid-read.</p>
                                    </div>
                                </li>
                                <li className="flex gap-4">
                                    <Settings className="text-white/20 shrink-0" size={18} />
                                    <div>
                                        <h5 className="text-[13px] font-bold text-white uppercase mb-1">Visual Comfort</h5>
                                        <p className="text-[12px] text-white/40 leading-relaxed">Switch between Light/Dark/OLED modes and adjust typography via the floating UI.</p>
                                    </div>
                                </li>
                            </ul>
                        </div>

                    </div>
                </div>

                {/* Footer CTA */}
                <div className="mt-28 p-12 rounded-[3rem] bg-gradient-to-r from-orange-600 to-orange-400 text-center relative overflow-hidden group">
                    <div className="absolute inset-0 opacity-20 pointer-events-none">
                        <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-white blur-3xl animate-pulse" />
                        <div className="absolute -bottom-24 -right-24 w-64 h-64 rounded-full bg-white blur-3xl animate-pulse" />
                    </div>

                    <div className="relative z-10">
                        <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Ready to construct knowledge?</h2>
                        <button
                            onClick={onClose}
                            className="px-10 py-5 bg-white text-orange-600 rounded-2xl font-bold text-lg hover:scale-105 transition-transform active:scale-95 shadow-2xl shadow-black/20"
                        >
                            Return to PustakamAI
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default UsageGuidePage;
