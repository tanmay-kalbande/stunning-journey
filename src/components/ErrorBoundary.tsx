// src/components/ErrorBoundary.tsx
// Global error boundary to catch runtime crashes and show a fallback UI

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
    };

    public static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({ errorInfo });
    }

    private handleReload = () => {
        window.location.reload();
    };

    private handleGoHome = () => {
        window.location.href = '/';
    };

    private handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-[#121218] border border-white/10 rounded-2xl p-8 text-center">
                        {/* Icon */}
                        <div className="w-16 h-16 mx-auto mb-6 bg-red-500/10 rounded-full flex items-center justify-center">
                            <AlertTriangle className="w-8 h-8 text-red-400" />
                        </div>

                        {/* Title */}
                        <h1 className="text-xl font-bold text-white mb-2">
                            Something went wrong
                        </h1>

                        {/* Description */}
                        <p className="text-sm text-gray-400 mb-6">
                            The application encountered an unexpected error. Your data is safe.
                        </p>

                        {/* Error details (collapsed by default in production) */}
                        {this.state.error && (
                            <details className="mb-6 text-left">
                                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
                                    Technical details
                                </summary>
                                <pre className="mt-2 p-3 bg-black/50 rounded-lg text-xs text-red-300 overflow-auto max-h-32">
                                    {this.state.error.message}
                                </pre>
                            </details>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={this.handleReset}
                                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
                            >
                                <Home size={16} />
                                Try Again
                            </button>
                            <button
                                onClick={this.handleReload}
                                className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
                            >
                                <RefreshCw size={16} />
                                Reload App
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
