import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, CheckCircle, AlertCircle, Info } from 'lucide-react';

export default function AnomalyAlerts({ anomalies, loading }) {
    if (loading) {
        return (
            <div className="card animate-pulse">
                <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-4"></div>
                <div className="space-y-3">
                    {[1, 2].map(i => (
                        <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                    ))}
                </div>
            </div>
        );
    }

    if (!anomalies || anomalies.length === 0) {
        return (
            <div className="card h-full flex flex-col items-center justify-center py-12 text-center">
                <div className="h-16 w-16 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-2">
                    No Anomalies
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-500">
                    All resource usage is within expected ranges
                </p>
            </div>
        );
    }

    const getSeverityIcon = (severity) => {
        switch (severity) {
            case 'High':
                return <AlertCircle className="h-4 w-4 text-rose-600" />;
            case 'Medium':
                return <AlertTriangle className="h-4 w-4 text-amber-600" />;
            case 'Low':
                return <Info className="h-4 w-4 text-blue-600" />;
            default:
                return <Info className="h-4 w-4 text-slate-600" />;
        }
    };

    const getSeverityBadge = (severity) => {
        switch (severity) {
            case 'High':
                return 'badge-critical';
            case 'Medium':
                return 'badge-high';
            case 'Low':
                return 'badge-medium';
            default:
                return 'badge-low';
        }
    };

    return (
        <div className="card h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                    Recent Alerts
                </h3>
                <span className="badge badge-critical">
                    {anomalies.length}
                </span>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
                {anomalies.slice(0, 5).map((anomaly, index) => (
                    <div
                        key={index}
                        className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                    >
                        <div className="flex items-start justify-between mb-2">
                            <div className="flex items-start gap-2 flex-1">
                                {getSeverityIcon(anomaly.severity)}
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                                        {anomaly.resource}
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-500">
                                        <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                                            {typeof anomaly.block === 'object' ? anomaly.block.name : (anomaly.block || 'Campus')}
                                        </span>
                                    </p>
                                </div>
                            </div>
                            <span className={`badge ${getSeverityBadge(anomaly.severity)} text-[10px]`}>
                                {anomaly.severity}
                            </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                            <div>
                                <div className="text-[10px] font-medium text-slate-500 dark:text-slate-500 uppercase mb-1">
                                    Today
                                </div>
                                <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                                    {anomaly.todayUsage.toLocaleString()}
                                </div>
                            </div>
                            <div>
                                <div className="text-[10px] font-medium text-slate-500 dark:text-slate-500 uppercase mb-1">
                                    Avg
                                </div>
                                <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                                    {anomaly.averageUsage.toLocaleString()}
                                </div>
                            </div>
                            <div>
                                <div className="text-[10px] font-medium text-slate-500 dark:text-slate-500 uppercase mb-1">
                                    Variance
                                </div>
                                <div className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                                    +{anomaly.excessPercentage}%
                                </div>
                            </div>
                        </div>

                        {anomaly.detectedAt && (
                            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                                <span className="text-xs text-slate-500 dark:text-slate-500">
                                    Detected {formatDistanceToNow(new Date(anomaly.detectedAt), { addSuffix: true })}
                                </span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {anomalies.length > 5 && (
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <button className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors">
                        View all {anomalies.length} alerts
                    </button>
                </div>
            )}
        </div>
    );
}
