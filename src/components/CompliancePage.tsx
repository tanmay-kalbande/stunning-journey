import React from 'react';
import { X, ArrowLeft, Shield, Scale, FileText, Lock, Globe, AlertCircle, Info } from 'lucide-react';

interface CompliancePageProps {
    onClose: () => void;
}

export function CompliancePage({ onClose }: CompliancePageProps) {
    return (
        <div className="fixed inset-0 z-[100] bg-black overflow-auto font-sans">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-black/90 backdrop-blur-xl border-b border-white/5 px-6 py-4">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <button
                        onClick={onClose}
                        className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={18} />
                        <span className="text-sm font-medium">Back</span>
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-4xl mx-auto px-6 py-12">
                <div className="mb-12">
                    <span className="text-[11px] font-mono tracking-[0.3em] uppercase text-amber-400 mb-4 block">Platform Integrity</span>
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">System Regulatory Compliance</h1>
                    <p className="text-white/50 text-lg leading-relaxed max-w-2xl">
                        A comprehensive overview of Pustakam's commitment to data sovereignty, AI ethics, and regulatory alignment.
                    </p>
                </div>

                <div className="space-y-16">
                    {/* Section 1: Data Sovereignty */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-3 text-white mb-4">
                            <Shield className="text-amber-500" size={24} />
                            <h2 className="text-2xl font-semibold">Data Sovereignty & Privacy</h2>
                        </div>
                        <p className="text-white/70 leading-relaxed">
                            Pustakam is designed with a "Local-First" philosophy. Unlike traditional SaaS platforms, your intellectual output (books) and configurations (API keys) are governed by your local hardware.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                            <div className="p-5 rounded-xl bg-white/5 border border-white/10">
                                <h3 className="text-white font-medium mb-2 flex items-center gap-2">
                                    <Lock size={16} className="text-blue-400" /> Client-Side Storage
                                </h3>
                                <p className="text-white/50 text-sm">Books and sessions are stored in IndexedDB/LocalStorage. We cannot access your content once generated.</p>
                            </div>
                            <div className="p-5 rounded-xl bg-white/5 border border-white/10">
                                <h3 className="text-white font-medium mb-2 flex items-center gap-2">
                                    <Globe size={16} className="text-emerald-400" /> Zero Data Training
                                </h3>
                                <p className="text-white/50 text-sm">Pustakam does not use your books to train AI models. Your interactions are between you and your chose LLM provider.</p>
                            </div>
                        </div>
                    </section>

                    {/* Section 2: AI Ethics & Model Neutrality */}
                    <section className="space-y-6 pt-10 border-t border-white/10">
                        <div className="flex items-center gap-3 text-white mb-4">
                            <Scale className="text-purple-500" size={24} />
                            <h2 className="text-2xl font-semibold">AI Ethics & Model Neutrality</h2>
                        </div>
                        <p className="text-white/70 leading-relaxed">
                            We maintain a position of radical neutrality. Pustakam provides the orchestration engine, but does not dictate the editorial stance or "safety" filters beyond those provided by the model creators.
                        </p>
                        <div className="bg-purple-500/5 border border-purple-500/20 p-6 rounded-2xl space-y-4">
                            <div className="flex items-start gap-3">
                                <Info size={18} className="text-purple-400 mt-1 shrink-0" />
                                <p className="text-sm text-white/70 leading-relaxed">
                                    <strong>Content Responsibility:</strong> Users are responsible for ensuring that the content generated via Pustakam complies with the Terms of Service of the respective AI providers (Google, Mistral, Groq, Cerebras).
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Section 3: Regulatory Frameworks */}
                    <section className="space-y-6 pt-10 border-t border-white/10">
                        <div className="flex items-center gap-3 text-white mb-4">
                            <FileText className="text-blue-500" size={24} />
                            <h2 className="text-2xl font-semibold">Regulatory Alignment</h2>
                        </div>
                        <div className="space-y-4 text-white/70">
                            <div className="flex gap-4">
                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 text-white font-bold text-sm">1</div>
                                <div>
                                    <h3 className="text-white font-medium mb-1">GDPR & CCPA Compliant</h3>
                                    <p className="text-white/50 text-sm">Since data is stored locally, you have total control (Right to Erasure/Access) via your browser settings.</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 text-white font-bold text-sm">2</div>
                                <div>
                                    <h3 className="text-white font-medium mb-1">Open Standards</h3>
                                    <p className="text-white/50 text-sm">We use open JSON and Markdown standards for library exports to prevent vendor lock-in.</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="pt-12 border-t border-white/10 text-center">
                        <div className="flex items-center justify-center gap-2 text-white/40 text-sm mb-4">
                            <AlertCircle size={14} />
                            <span>This document is updated as AI regulations (like the EU AI Act) evolve.</span>
                        </div>
                        <p className="text-white/40 text-xs">
                            System Version: 1.2.0 • Last Audit: January 2026
                        </p>
                    </section>
                </div>
            </main>
        </div>
    );
}

export default CompliancePage;
