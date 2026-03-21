import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
    message: string;
    type: ToastType;
    onClose: () => void;
    duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose, duration = 4000 }) => {
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            handleClose();
        }, duration);

        return () => clearTimeout(timer);
    }, [duration]);

    const handleClose = () => {
        setIsExiting(true);
        setTimeout(onClose, 300); // Match animation duration
    };

    const getIcon = () => {
        switch (type) {
            case 'success': return <CheckCircle2 size={20} className="text-green-400" />;
            case 'error': return <AlertCircle size={20} className="text-red-400" />;
            case 'warning': return <AlertTriangle size={20} className="text-amber-400" />;
            case 'info':
            default: return <Info size={20} className="text-cyan-400" />;
        }
    };

    const getTypeStyles = () => {
        switch (type) {
            case 'success': return 'border-green-500/40 bg-green-950/90';
            case 'error': return 'border-red-500/40 bg-red-950/90';
            case 'warning': return 'border-amber-500/40 bg-amber-950/90';
            case 'info':
            default: return 'border-cyan-500/40 bg-cyan-950/90';
        }
    };

    return (
        <div
            className={`fixed bottom-6 right-6 z-[200] px-5 py-4 rounded-xl border backdrop-blur-md shadow-2xl flex items-start gap-4 min-w-[320px] max-w-[450px] transition-all duration-300 ${isExiting ? 'opacity-0 translate-x-4 scale-95' : 'opacity-100 translate-x-0 scale-100'
                } ${getTypeStyles()}`}
            style={{ animation: isExiting ? 'none' : 'toastIn 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
            <div className="shrink-0 mt-0.5">{getIcon()}</div>
            <div className="flex-1 text-sm font-medium text-white leading-relaxed">{message}</div>
            <button
                onClick={handleClose}
                className="shrink-0 p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
            >
                <X size={16} />
            </button>
        </div>
    );
};

// CSS for animations needs to be in index.css
