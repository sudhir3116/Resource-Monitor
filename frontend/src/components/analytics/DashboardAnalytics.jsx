import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import SummaryCard from './SummaryCard';
import TrendChart from './TrendChart';
import AnomalyAlerts from './AnomalyAlerts';
import SustainabilityScore from './SustainabilityScore';
import EfficiencyRating from './EfficiencyRating';
import Loading from '../Loading';
import { Activity, Calendar, Download, RefreshCw, BarChart3, TrendingUp, AlertTriangle, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useResources } from '../../hooks/useResources';

export default function DashboardAnalytics({ userRole }) {
    const { resources } = useResources();
    const [period, setPeriod] = useState('daily');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [summary, setSummary] = useState(null);
    const [trends, setTrends] = useState(null);
    const [anomalies, setAnomalies] = useState(null);
    const [sustainabilityScore, setSustainabilityScore] = useState(null);
    const [efficiencyRating, setEfficiencyRating] = useState(null);

    useEffect(() => {
        fetchAnalytics();
    }, [period]);

    const fetchAnalytics = async () => {
        try {
            setLoading(true);
            setError(null);

            const [
                summaryRes,
                trendsRes,
                anomaliesRes,
                scoreRes,
                ratingRes
            ] = await Promise.all([
                api.get(`/api/analytics/summary?period=${period}`),
                api.get('/api/analytics/trends?days=7'),
                userRole !== 'student' ? api.get('/api/analytics/anomalies') : Promise.resolve({ data: { anomalies: [] } }),
                api.get('/api/analytics/sustainability-score'),
                api.get('/api/analytics/efficiency-rating')
            ]);

            setSummary(summaryRes.data);
            setTrends(trendsRes.data);
            setAnomalies(anomaliesRes.data?.anomalies || []);
            setSustainabilityScore(scoreRes.data);
            setEfficiencyRating(ratingRes.data?.ratings || []);
        } catch (err) {
            console.error('Analytics fetch error:', err);
            setError(err.response?.data?.error || err.message || 'Transmission Protocol Failure');
        } finally {
            setLoading(false);
        }
    };

    if (loading && !summary) {
        return (
            <div className="space-y-12 animate-pulse pb-20 pt-10 font-['Outfit']">
                <div className="h-24 bg-slate-900/50 rounded-[40px] w-1/3 mb-10"></div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-40 bg-slate-900/20 rounded-[32px]"></div>)}
                </div>
                <div className="h-96 bg-slate-900/20 rounded-[56px]"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] bg-rose-500/5 border-2 border-dashed border-rose-500/20 rounded-[56px] p-20 font-['Outfit']">
                <AlertTriangle size={64} className="text-rose-500 mb-8 animate-pulse" />
                <h2 className="text-2xl font-black text-rose-600 uppercase tracking-widest italic">{error}</h2>
                <button
                    onClick={fetchAnalytics}
                    className="mt-10 px-10 py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] hover:bg-rose-500 transition-all shadow-2xl shadow-rose-600/20"
                >
                    Retry Protocol
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-12 animate-fade-in pb-20 font-['Outfit'] selection:bg-indigo-500/30 selection:text-indigo-200">
            {/* Tactical Period Selector */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 bg-white dark:bg-slate-900/40 backdrop-blur-3xl p-8 rounded-[40px] border border-slate-100 dark:border-white/5 shadow-3xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-transparent pointer-events-none" />
                <div>
                    <div className="flex items-center gap-3 mb-2 opacity-50 underline decoration-indigo-500 decoration-2 underline-offset-4">
                        <BarChart3 size={14} strokeWidth={3} className="text-indigo-600" />
                        <span className="text-[10px] font-black uppercase tracking-[0.4em]">Grid Metrics Analyzer</span>
                    </div>
                    <h2 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tightest italic">Institutional <span className="text-indigo-600 dark:text-indigo-400">Trends</span></h2>
                </div>

                <div className="flex bg-slate-100 dark:bg-slate-950 p-2 rounded-[24px] border border-slate-200 dark:border-white/5 shadow-inner">
                    {['daily', 'weekly', 'monthly'].map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all
                                ${period === p
                                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xl shadow-slate-200 dark:shadow-none translate-y-[-2px]'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'}`}
                        >
                            {p} Cycle
                        </button>
                    ))}
                </div>
            </div>

            {/* Tactical Summary Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {summary && (
                    <>
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                            <SummaryCard
                                title="Total Extraction"
                                current={summary.current?.total || 0}
                                previous={summary.previous?.total || 0}
                                trend={summary.trend}
                                icon={<Activity size={24} strokeWidth={3} />}
                                color="indigo"
                            />
                        </motion.div>
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                            <SummaryCard
                                title="Stream Records"
                                current={summary.current?.records || 0}
                                previous={summary.previous?.records || 0}
                                trend={summary.trend}
                                icon={<Database size={24} strokeWidth={3} />}
                                color="emerald"
                            />
                        </motion.div>
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                            <SummaryCard
                                title="Recurrency Rate"
                                current={summary.current?.average || 0}
                                previous={0}
                                icon={<TrendingUp size={24} strokeWidth={3} />}
                                color="amber"
                            />
                        </motion.div>
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                            <SummaryCard
                                title="Active Nodes"
                                current={summary.current?.resources || 0}
                                previous={0}
                                icon={<ShieldCheck size={24} strokeWidth={3} />}
                                color="rose"
                            />
                        </motion.div>
                    </>
                )}
            </div>

            {/* Main Operational Visor */}
            <div className="grid grid-cols-1 gap-12">
                {/* Trend Chart Visor */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white dark:bg-slate-900/40 backdrop-blur-3xl rounded-[56px] border border-slate-100 dark:border-white/5 shadow-3xl overflow-hidden"
                >
                    <div className="p-10 pb-0 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 bg-indigo-600/10 text-indigo-600 rounded-2xl flex items-center justify-center">
                                <TrendingUp size={24} strokeWidth={3} />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tightest italic">Operational Consumption Gradient</h3>
                        </div>
                        <div className="flex gap-4">
                            <button className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-400 hover:text-indigo-600 transition-all shadow-xl">
                                <Download size={18} strokeWidth={3} />
                            </button>
                        </div>
                    </div>
                    {trends && (
                        <TrendChart
                            data={trends.trends}
                            resources={resources}
                            title="Resource Usage Trends (Last 7 Days)"
                            height={400}
                        />
                    )}
                </motion.div>

                {/* Intelligent Insights Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Sustainability Score Dial */}
                    {sustainabilityScore && (
                        <div className="group h-full">
                            <SustainabilityScore
                                score={sustainabilityScore.score}
                                grade={sustainabilityScore.grade}
                                resourceBreakdown={sustainabilityScore.resourceBreakdown}
                                loading={false}
                            />
                        </div>
                    )}

                    {/* Anomaly Protocol Radar */}
                    {userRole !== 'student' && (
                        <div className="group h-full">
                            <AnomalyAlerts
                                anomalies={anomalies}
                                loading={false}
                            />
                        </div>
                    )}
                </div>

                {/* Efficiency Grid Rating */}
                {efficiencyRating && efficiencyRating.length > 0 && (
                    <EfficiencyRating
                        ratings={efficiencyRating}
                        loading={false}
                    />
                )}
            </div>

            {/* Grid Sync Operations */}
            <div className="flex justify-center pt-10">
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={fetchAnalytics}
                    disabled={loading}
                    className="px-12 py-6 bg-slate-900 dark:bg-indigo-600 text-white rounded-[32px] font-black text-xs uppercase tracking-[0.4em] shadow-3xl shadow-indigo-600/20 hover:bg-slate-800 dark:hover:bg-indigo-500 transition-all flex items-center gap-6 group"
                >
                    <RefreshCw size={20} strokeWidth={3} className={loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-700'} />
                    {loading ? 'SYNCHRONIZING TELEMETRY...' : 'FORCE GRID RE-CALIBRATION'}
                </motion.button>
            </div>
        </div>
    );
}
