import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export const Modal = ({ isOpen, onClose, title, children }) => {
    // Prevent body scroll when open
    React.useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = 'unset';
        return () => { document.body.style.overflow = 'unset'; }
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-900/40 z-[60] backdrop-blur-sm transition-opacity"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20, x: '-50%' }}
                        animate={{ opacity: 1, scale: 1, y: '-50%', x: '-50%' }}
                        exit={{ opacity: 0, scale: 0.95, y: 20, x: '-50%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed left-1/2 top-1/2 z-[70] w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden"
                        style={{ maxHeight: '90vh', overflowY: 'auto' }}
                    >
                        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10 backdrop-blur-md">
                            <h3 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h3>
                            <button
                                onClick={onClose}
                                className="p-1.5 hover:bg-slate-200/50 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6">
                            {children}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
