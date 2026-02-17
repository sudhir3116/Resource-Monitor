import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, ShieldCheck, BarChart3, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/Button';

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-white dark:bg-[#020617] flex flex-col selection:bg-indigo-500/30">
            {/* Navbar */}
            <nav className="border-b border-slate-100 dark:border-slate-800/50 bg-white/80 dark:bg-[#020617]/80 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3 font-black text-2xl text-slate-900 dark:text-white tracking-tight">
                        <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-500/20">
                            <Zap size={24} fill="currentColor" strokeWidth={2.5} />
                        </div>
                        Institutional <span className="text-indigo-600">Grid</span>
                    </div>
                    <div className="hidden md:flex items-center gap-10">
                        <a href="#features" className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-indigo-600 transition-colors">Features</a>
                        <a href="#governance" className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-indigo-600 transition-colors">Governance</a>
                        <a href="#compliance" className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-indigo-600 transition-colors">Compliance</a>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link to="/login">
                            <button className="hidden sm:block text-xs font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-300 hover:text-indigo-600 px-6 py-2.5 transition-all">
                                Protocol Login
                            </button>
                        </Link>
                        <Link to="/register">
                            <button className="px-8 py-3 bg-indigo-600 text-white text-xs font-black uppercase tracking-[0.2em] rounded-xl shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 transition-all active:scale-95">
                                Initialize Account
                            </button>
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <main className="flex-1">
                <section className="relative pt-32 pb-48 overflow-hidden">
                    {/* Background Decor */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
                        <div className="absolute top-20 left-10 w-[500px] h-[500px] bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full mix-blend-screen filter blur-[120px] animate-pulse"></div>
                        <div className="absolute bottom-0 right-10 w-[400px] h-[400px] bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full mix-blend-screen filter blur-[100px] animate-pulse animation-delay-2000"></div>
                    </div>

                    <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="space-y-10"
                        >
                            <div className="inline-flex items-center gap-3 py-2 px-6 rounded-full bg-slate-900 dark:bg-slate-800 text-white text-[10px] font-black uppercase tracking-[0.3em] shadow-2xl border border-white/5 mx-auto">
                                <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-ping"></span>
                                Institutional Standard v4.2.0
                            </div>

                            <h1 className="text-6xl md:text-8xl font-black text-slate-900 dark:text-white tracking-tightest leading-[0.9] mb-8">
                                ADVANCED <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-indigo-400 to-violet-500">
                                    RESOURCE AUDIT
                                </span>
                            </h1>

                            <p className="text-xl md:text-2xl text-slate-500 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed font-bold">
                                Institutional-grade monitoring for electricity, water, and consumables.
                                Secure, audited, and optimized for high-capacity campus ecosystems.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-6 justify-center pt-8">
                                <Link to="/register">
                                    <button className="h-16 px-12 bg-indigo-600 text-white font-black text-xs uppercase tracking-[0.3em] rounded-2xl shadow-2xl shadow-indigo-500/40 hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all flex items-center gap-4">
                                        Deploy Free Instance
                                        <ArrowRight size={20} strokeWidth={3} />
                                    </button>
                                </Link>
                                <Link to="/login">
                                    <button className="h-16 px-12 bg-white dark:bg-transparent border-2 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white font-black text-xs uppercase tracking-[0.3em] rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95">
                                        Access Global Dashboard
                                    </button>
                                </Link>
                            </div>
                        </motion.div>
                    </div>
                </section>

                {/* Feature Grid */}
                <section id="features" className="py-32 bg-slate-50/50 dark:bg-black/20 border-t border-slate-100 dark:border-slate-800/50">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="grid md:grid-cols-3 gap-10">
                            <FeatureCard
                                icon={<BarChart3 className="text-indigo-600" size={36} strokeWidth={2.5} />}
                                title="TELEMETRY ANALYTICS"
                                desc="High-fidelity consumption monitoring with cryptographic audit trails for every unit consumed."
                            />
                            <FeatureCard
                                icon={<ShieldCheck className="text-emerald-500" size={36} strokeWidth={2.5} />}
                                title="GOVERNANCE LAYER"
                                desc="Granular RBAC protocols for institutional hierarchy—students to executive deans."
                            />
                            <FeatureCard
                                icon={<Zap className="text-amber-500" size={36} strokeWidth={2.5} />}
                                title="ACTIVE RESPONSE"
                                desc="Sub-second notification engine for threshold violations and anomalous consumption metrics."
                            />
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="bg-white dark:bg-[#020617] border-t border-slate-100 dark:border-slate-800/50 py-20">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center">
                    <div className="flex items-center gap-3 font-black text-slate-900 dark:text-white mb-8 md:mb-0 uppercase tracking-tighter text-xl">
                        <div className="bg-slate-900 dark:bg-indigo-600 p-2 rounded-xl text-white shadow-lg"><Zap size={20} fill="currentColor" /></div>
                        Institutional Grid
                    </div>
                    <div className="flex flex-col items-center md:items-end gap-2">
                        <div className="flex gap-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">
                            <a href="#" className="hover:text-indigo-500 transition-colors">Privacy</a>
                            <a href="#" className="hover:text-indigo-500 transition-colors">Security</a>
                            <a href="#" className="hover:text-indigo-500 transition-colors">SLA</a>
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400/60">
                            © 2026 GLOBAL INSTITUTIONAL GRID. ALL RIGHTS RESERVED.
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}

function FeatureCard({ icon, title, desc }) {
    return (
        <div className="bg-white dark:bg-slate-900/50 p-10 rounded-[32px] border border-slate-200 dark:border-slate-800/50 shadow-sm hover:shadow-2xl dark:hover:shadow-indigo-500/10 hover:-translate-y-2 transition-all duration-500 group">
            <div className="mb-8 bg-slate-50 dark:bg-slate-800 w-20 h-20 rounded-2xl flex items-center justify-center border border-slate-100 dark:border-slate-700/50 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-500 transition-all duration-500">
                {icon}
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4 tracking-widest leading-none">{title}</h3>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed font-bold text-sm">{desc}</p>
        </div>
    )
}
