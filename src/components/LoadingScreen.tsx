import React from 'react';
import NebulaBackground from './NebulaBackground';
import { Sparkles } from 'lucide-react';

interface LoadingScreenProps {
    theme?: 'light' | 'dark';
    message?: string;
    isExiting?: boolean;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
    theme = 'dark',
    message = 'Initializing Pustakam...',
    isExiting = false
}) => {
    return (
        <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[var(--color-bg)] transition-all duration-700 ease-in-out font-sans ${isExiting ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'}`}>
            {/* Background Layer */}
            {theme === 'dark' ? (
                <NebulaBackground opacity={1} />
            ) : (
                <div className="sun-background absolute inset-0 opacity-50" />
            )}

            {/* Content Layer */}
            <div className="relative z-10 flex flex-col items-center justify-center h-full pb-10">
                {/* Minimal Typography Logo */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-6xl uppercase opacity-90 mb-2">
                        <span className="font-sans font-bold tracking-[0.02em] text-[var(--color-text-primary)]">Pustakam</span><span className="font-sans font-bold tracking-[0.02em] text-[var(--color-accent-primary)]">.ai</span>
                    </h1>
                    <p className="text-xs md:text-sm font-medium tracking-[0.3em] text-[var(--color-text-tertiary)] uppercase opacity-60">
                        by Tanmay
                    </p>
                </div>

                {/* Loading Text - Very subtle */}
                <div className="absolute bottom-12 flex flex-col items-center gap-4">
                    <div className="text-xs font-medium tracking-widest text-[var(--color-text-muted)] opacity-50 uppercase animate-pulse-subtle">
                        {message}
                    </div>
                </div>
            </div>
        </div>
    );
};
