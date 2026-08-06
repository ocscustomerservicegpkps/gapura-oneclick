'use client';

import { useEffect } from 'react';
import { X, Wrench } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';

interface MaintenanceDialogProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    message?: string;
}

/**
 * Simple "this feature is on maintenance" dialog (framer-motion portal,
 * same shell as QuickAccessPasswordModal).
 */
export function MaintenanceDialog({
    isOpen,
    onClose,
    title = 'Sedang Dalam Maintenance',
    message = 'Fitur ini sedang dalam maintenance. Silakan coba lagi nanti.',
}: MaintenanceDialogProps) {
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    if (typeof document === 'undefined') return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        key="backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9998]"
                        onClick={onClose}
                        aria-hidden="true"
                    />
                    <motion.div
                        key="dialog"
                        initial={{ opacity: 0, scale: 0.92, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, y: 16 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none"
                        role="dialog"
                        aria-modal="true"
                    >
                        <motion.div className="pointer-events-auto w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
                            <div className="flex items-start justify-between p-5 border-b border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center ring-1 ring-amber-100">
                                        <Wrench size={16} className="text-amber-600" />
                                    </div>
                                    <h2 className="text-sm font-bold text-gray-900 leading-tight">{title}</h2>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors active:scale-95"
                                    aria-label="Close"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="p-5">
                                <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
                                <button
                                    onClick={onClose}
                                    className="mt-4 w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 active:scale-[0.98] transition-all"
                                >
                                    Mengerti
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>,
        document.body,
    );
}
