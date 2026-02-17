import React from 'react';

// Example: <MetricCard label="Energy Usage" value="1200 kWh" trend={12} trendLabel="vs last month" />
const MetricCard = ({ label, value, trend, trendLabel, icon, color = 'blue' }) => {
    const isPositive = trend > 0;
    const trendColor = isPositive ? 'text-red-500' : 'text-green-500'; // Assuming usage -> lower is better. context matters.
    // Actually, for "Savings", positive is green. For "Cost", positive is bad.
    // Let's make trend direction semantic. trendDirection='up-good' | 'up-bad'

    const trendClass = trend > 0 ? 'text-red-600' : 'text-green-600'; // Default: usage UP is bad.
    const arrow = trend > 0 ? '▲' : '▼';

    return (
        <div className="card group hover:shadow-2xl hover:shadow-indigo-500/10 dark:hover:shadow-indigo-500/5 transition-all duration-500">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400 font-bold mb-3">{label}</h3>
                    <div className="text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{value}</div>
                </div>
                {icon && (
                    <div className={`p-4 rounded-2xl bg-${color}-50 dark:bg-slate-700 text-${color}-600 dark:text-indigo-300 ring-1 ring-${color}-100 dark:ring-slate-600 shadow-sm`}>
                        {icon}
                    </div>
                )}
            </div>

            {trend !== undefined && (
                <div className="flex items-center mt-6 pt-6 border-t border-slate-100 dark:border-slate-700/50">
                    <span className={`text-[11px] font-black flex items-center px-2.5 py-1 rounded-lg ${trend > 0 ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300'}`}>
                        <span className="mr-1">{arrow}</span>
                        {Math.abs(trend)}%
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 ml-3 font-bold uppercase tracking-widest">{trendLabel || 'vs last month'}</span>
                </div>
            )}
        </div>
    );
};

export default MetricCard;
