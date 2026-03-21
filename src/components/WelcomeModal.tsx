// src/components/WelcomeModal.tsx
// Premium welcome modal - Yearly PRO plan for all users
import React from 'react';
import { X, BookOpen, Zap, Download, Check, Crown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface WelcomeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
    const { profile } = useAuth();
    if (!isOpen) return null;

    const firstName = profile?.full_name?.split(' ')[0] || 'Creator';

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Backdrop with blur */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative w-full max-w-md bg-black border border-[var(--color-border)] rounded-2xl shadow-2xl overflow-hidden">
                {/* Subtle gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-500/5 pointer-events-none" />

                {/* Close */}
                <button onClick={onClose} className="absolute top-4 right-4 p-1.5 text-white/40 hover:text-white transition-colors z-10">
                    <X size={18} />
                </button>

                {/* Content */}
                <div className="relative p-8 text-center">
                    {/* Logo Icon */}
                    <div className="inline-flex mb-6">
                        <div className="relative">
                            <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full" />
                            <div className="relative w-16 h-16 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-xl flex items-center justify-center border border-white/10">
                                <img src="/white-logo.png" alt="Pustakam" className="w-8 h-8" />
                            </div>
                        </div>
                    </div>

                    {/* Greeting */}
                    <h1 className="text-2xl font-bold text-white mb-2">
                        Welcome, {firstName}
                    </h1>
                    <p className="text-white/50 text-sm mb-8">
                        Ready to create more knowledge?
                    </p>

                    {/* Pro Plan Banner */}
                    <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-xl p-5 mb-6">
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <Crown size={18} className="text-cyan-400" />
                            <span className="text-cyan-400 font-semibold text-sm uppercase tracking-wider">Premium Active</span>
                        </div>
                        <p className="text-white text-xl font-bold mb-1">
                            Unlimited Access
                        </p>
                        <p className="text-white/40 text-xs">Create unlimited books • All AI models unlocked</p>
                    </div>

                    {/* Features Grid */}
                    <div className="grid grid-cols-3 gap-3 mb-8">
                        {[
                            { icon: BookOpen, label: 'Full Books' },
                            { icon: Zap, label: 'Fast AI' },
                            { icon: Download, label: 'Export' },
                        ].map(({ icon: Icon, label }) => (
                            <div key={label} className="p-3 bg-white/[0.02] border border-white/5 rounded-lg">
                                <Icon size={16} className="text-cyan-400 mx-auto mb-1.5" />
                                <span className="text-xs text-white/50">{label}</span>
                            </div>
                        ))}
                    </div>


                    {/* CTA Button */}
                    <button
                        onClick={onClose}
                        className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                        <Check size={16} />
                        <span>Start Creating</span>
                    </button>

                    {/* Subtle note */}
                    <p className="text-white/30 text-[10px] mt-4">
                        Describe any topic and generate complete learning guides instantly
                    </p>
                </div>
            </div>
        </div >
    );
}

export default WelcomeModal;
