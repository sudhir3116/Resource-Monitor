import React from 'react';
import { Zap } from 'lucide-react';

export default function Footer() {
    return (
        <footer className="w-full py-6 mt-12 border-t border-slate-200">
            <div className="flex flex-col md:flex-row justify-between items-center text-sm text-slate-500 max-w-7xl mx-auto px-6">
                <div className="flex items-center gap-2 mb-4 md:mb-0">
                    <div className="bg-slate-200 p-1 rounded text-slate-600">
                        <Zap size={12} fill="currentColor" />
                    </div>
                    <span className="font-semibold text-slate-700">Sustainable Resource Monitor</span>
                </div>
                <div className="flex gap-6">
                    <a href="#" className="hover:text-indigo-600 transition-colors">Documentation</a>
                    <a href="#" className="hover:text-indigo-600 transition-colors">Privacy</a>
                    <a href="#" className="hover:text-indigo-600 transition-colors">Support</a>
                </div>
            </div>
        </footer>
    );
}
