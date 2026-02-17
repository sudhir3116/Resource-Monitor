import React from 'react';
import { BarChart3, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function EfficiencyRating({ ratings, loading }) {
    if (loading) {
        return (
            <div className="bg-white dark:bg-slate-900/40 backdrop-blur-3xl p-12 rounded-[56px] border border-slate-100 dark:border-white/5 shadow-3xl animate-pulse">
                <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg mb-10"></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => <div key={i} className="h-60 bg-slate-200 dark:bg-slate-800 rounded-[32px]"></div>)}
                </div>
            </div>
        );
    }

    if (!ratings || ratings.length === 0) {
        return (
            <div className="bg-white dark:bg-slate-900/40 backdrop-blur-3xl p-12 rounded-[56px] border border-slate-100 dark:border-white/5 shadow-3xl text-center">
                <BarChart3 size={48} className="text-slate-300 dark:text-slate-600 mx-auto mb-6" />
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">No Efficiency Data</h3>
            </div>
        );
    }

    const getRatingIcon = (rating) => {
        switch (rating) {
            case 'Green': return <CheckCircle2 size={20} strokeWidth={3} className="text-emerald-500" />;
            case 'Moderate': return <AlertTriangle size={20} strokeWidth={3} className="text-amber-500" />;
            case 'Critical': return <ShieldCheck size={20} strokeWidth={3} className="text-rose-500" />;
            default: return <BarChart3 size={20} strokeWidth={3} className="text-slate-500" />;
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900/40 backdrop-blur-3xl p-12 rounded-[56px] border border-slate-100 dark:border-white/5 shadow-3xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none" />

            <div className="flex items-center gap-4 mb-12 relative z-10">
                <div className="h-12 w-12 bg-indigo-600/10 text-indigo-600 rounded-2xl flex items-center justify-center">
                    <BarChart3 size={24} strokeWidth={3} />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tightest italic">Grid Efficiency Matrix</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 relative z-10">
                {ratings.map((rating, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="group/item relative p-8 rounded-[40px] border-2 transition-all duration-500 hover:scale-[1.05] hover:rotate-2 shadow-xl"
                        style={{
                            borderColor: `${rating.color}20`,
                            backgroundColor: `${rating.color}05`
                        }}
                    >
                        <div className="flex justify-between items-start mb-10">
                            <h4 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-[0.3em] italic">
                                {rating.resource}
                            </h4>
                            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl shadow-lg group-hover/item:rotate-12 transition-transform">
                                {getRatingIcon(rating.rating)}
                            </div>
                        </div>

                        {/* Circular Progress Micro-Visor */}
                        <div className="flex items-center justify-center mb-10">
                            <div className="relative h-28 w-28">
                                <svg width="112" height="112" className="rotate-[-90deg]">
                                    <circle
                                        cx="56"
                                        cy="56"
                                        r="48"
                                        fill="none"
                                        stroke="rgba(0,0,0,0.05)"
                                        strokeWidth="8"
                                        className="dark:stroke-white/5"
                                    />
                                    <motion.circle
                                        cx="56"
                                        cy="56"
                                        r="48"
                                        fill="none"
                                        stroke={rating.color}
                                        strokeWidth="8"
                                        strokeDasharray={2 * Math.PI * 48}
                                        initial={{ strokeDashoffset: 2 * Math.PI * 48 }}
                                        animate={{ strokeDashoffset: 2 * Math.PI * 48 * (1 - rating.percentage / 100) }}
                                        transition={{ duration: 1.5, ease: "easeOut" }}
                                        strokeLinecap="round"
                                        className="shadow-2xl"
                                        style={{ filter: `drop-shadow(0 0 8px ${rating.color}50)` }}
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-2xl font-black italic tracking-tighter" style={{ color: rating.color }}>
                                        {rating.percentage.toFixed(0)}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="text-center">
                            <span className={`inline-block px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] text-white shadow-xl`} style={{ backgroundColor: rating.color }}>
                                {rating.rating} PROTOCOL
                            </span>
                            <div className="mt-8 pt-6 border-t border-slate-900/5 dark:border-white/5">
                                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest italic">
                                    {rating.actual.toLocaleString()} Units
                                </span>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Institutional Legend */}
            <div className="mt-16 pt-12 border-t border-slate-50 dark:border-white/5 flex flex-wrap justify-center gap-12 opacity-50 relative z-10">
                <div className="flex items-center gap-4">
                    <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,1)]" />
                    <span className="text-[9px] font-black uppercase tracking-[0.4em]">Optimum (&lt;70%)</span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="h-3 w-3 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,1)]" />
                    <span className="text-[9px] font-black uppercase tracking-[0.4em]">Threshold (70-90%)</span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="h-3 w-3 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(239,68,68,1)]" />
                    <span className="text-[9px] font-black uppercase tracking-[0.4em]">Critical (&gt;90%)</span>
                </div>
            </div>

            {/* Background Ornamental Grid */}
            <div className="absolute -top-20 -right-20 opacity-5 text-indigo-500 group-hover:scale-110 transition-transform duration-1000 rotate-45">
                <BarChart3 size={320} />
            </div>
        </div>
    );
}
