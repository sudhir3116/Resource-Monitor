import React from 'react';
import { Target, Activity, ShieldCheck, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SustainabilityScore({ score, grade, resourceBreakdown, loading }) {
    if (loading) {
        return (
            <div className="bg-white dark:bg-slate-900/40 backdrop-blur-3xl p-12 rounded-[56px] border border-slate-100 dark:border-white/5 shadow-3xl animate-pulse">
                <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg mb-10"></div>
                <div className="flex justify-center mb-10">
                    <div className="h-32 w-32 rounded-full border-8 border-slate-200 dark:border-slate-800"></div>
                </div>
                <div className="space-y-4">
                    {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-200 dark:bg-slate-800 rounded-[28px]"></div>)}
                </div>
            </div>
        );
    }

    if (score === undefined || score === null) {
        return (
            <div className="bg-white dark:bg-slate-900/40 backdrop-blur-3xl p-12 rounded-[56px] border border-slate-100 dark:border-white/5 shadow-3xl flex flex-col items-center justify-center text-center">
                <Target size={48} className="text-slate-300 dark:text-slate-600 mb-6" />
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.4em]">No Performance Data</h3>
            </div>
        );
    }

    const getGradeColor = (grade) => {
        switch (grade) {
            case 'A': return 'text-emerald-500 border-emerald-500';
            case 'B': return 'text-indigo-500 border-indigo-500';
            case 'C': return 'text-amber-500 border-amber-500';
            case 'D': return 'text-rose-500 border-rose-500';
            case 'F': return 'text-rose-700 border-rose-700';
            default: return 'text-slate-500 border-slate-500';
        }
    };

    const getGradeBg = (grade) => {
        switch (grade) {
            case 'A': return 'bg-emerald-500/10';
            case 'B': return 'bg-indigo-500/10';
            case 'C': return 'bg-amber-500/10';
            default: return 'bg-rose-500/10';
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Good': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
            case 'Warning': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
            case 'Critical': return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
            default: return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
        }
    };

    const getBarColor = (status) => {
        switch (status) {
            case 'Good': return 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]';
            case 'Warning': return 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]';
            case 'Critical': return 'bg-rose-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]';
            default: return 'bg-slate-500';
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900/40 backdrop-blur-3xl p-12 rounded-[56px] border border-slate-100 dark:border-white/5 shadow-3xl relative overflow-hidden h-full flex flex-col group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none" />

            <div className="flex items-center gap-4 mb-10 relative z-10">
                <div className="h-12 w-12 bg-indigo-600/10 text-indigo-600 rounded-2xl flex items-center justify-center">
                    <Target size={24} strokeWidth={3} />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tightest italic">Sustainability Pulse</h3>
            </div>

            {/* Main Score Dial */}
            <div className="flex flex-col items-center justify-center py-10 border-b border-slate-50 dark:border-white/5 mb-10 relative z-10">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`h-40 w-40 rounded-full border-[10px] flex flex-col items-center justify-center relative shadow-3xl ${getGradeColor(grade)}`}
                >
                    <div className="absolute inset-0 rounded-full border-t-[10px] border-t-white opacity-20 animate-spin transition-all" style={{ animationDuration: '3s' }} />
                    <span className="text-6xl font-black italic tracking-tighter">{grade}</span>
                    <span className="text-[10px] font-black uppercase tracking-[.3em] opacity-50 mt-1">{score.toFixed(1)}/100</span>
                </motion.div>
                <p className="mt-8 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em] italic leading-none">Institutional Efficiency Rating</p>
            </div>

            {/* Resource Breakdown Matrix */}
            <div className="space-y-6 flex-1 relative z-10">
                <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.5em] flex items-center gap-4 mb-6">
                    <span>Node Distribution</span>
                    <div className="h-px w-full bg-slate-50 dark:bg-white/5" />
                </h4>

                <div className="space-y-4">
                    {resourceBreakdown && resourceBreakdown.map((resource, index) => (
                        <motion.div
                            key={index}
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: index * 0.1 }}
                            className="p-6 bg-slate-50 dark:bg-slate-950/50 rounded-[28px] border border-slate-100 dark:border-white/5 group/node hover:border-indigo-500/30 transition-all"
                        >
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest italic group-hover/node:text-indigo-500 transition-colors">
                                    {resource.resource} Node
                                </span>
                                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusColor(resource.status)}`}>
                                    {resource.status}
                                </span>
                            </div>

                            <div className="w-full bg-slate-200 dark:bg-slate-900 rounded-full h-2 overflow-hidden shadow-inner mb-4 border border-slate-100 dark:border-white/5">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(resource.percentage, 100)}%` }}
                                    transition={{ duration: 1, ease: 'easeOut' }}
                                    className={`h-full rounded-full transition-all ${getBarColor(resource.status)}`}
                                />
                            </div>

                            <div className="flex justify-between items-center text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest italic">
                                <span>{resource.actual.toLocaleString()} / {resource.threshold.toLocaleString()} Units</span>
                                <span>{resource.percentage.toFixed(1)}% Usage</span>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Bottom Insight Area */}
            <div className="mt-10 pt-8 border-t border-slate-50 dark:border-white/5 flex items-center justify-between opacity-50 relative z-10">
                <div className="flex items-center gap-3">
                    <Activity size={14} className="text-emerald-500" strokeWidth={3} />
                    <span className="text-[9px] font-black uppercase tracking-widest">T+5m Cycle Sync</span>
                </div>
                <ShieldCheck size={14} className="text-indigo-500" strokeWidth={3} />
            </div>

            {/* Cinematic Overlay Branding */}
            <div className="absolute -bottom-10 -left-10 opacity-5 text-indigo-500 group-hover:scale-110 transition-transform duration-1000 rotate-12">
                <Target size={240} />
            </div>
        </div>
    );
}
