import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function SummaryCard({ title, current, previous, trend, icon, unit = '', color = 'indigo' }) {
    const percentageChange = previous !== 0
        ? ((current - previous) / previous * 100).toFixed(1)
        : 0;

    const isPositive = percentageChange > 0;
    const isNegative = percentageChange < 0;

    const iconBgClasses = {
        indigo: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
        emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
        rose: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400',
        blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
        slate: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
    };

    return (
        <div className="card card-hover">
            <div className="flex items-center justify-between mb-2">
                <p className="metric-label">{title}</p>
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${iconBgClasses[color]}`}>
                    {icon}
                </div>
            </div>

            <div className="flex items-baseline gap-2">
                <p className="metric-value">
                    {current?.toLocaleString() || 0}
                </p>
                {unit && (
                    <span className="text-sm text-slate-500 dark:text-slate-500 font-medium">
                        {unit}
                    </span>
                )}
            </div>

            {previous !== undefined && percentageChange !== 0 && (
                <div className="flex items-center gap-1.5 mt-2">
                    {isPositive ? (
                        <TrendingUp className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                    ) : (
                        <TrendingDown className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    )}
                    <span className={`text-xs font-medium ${isPositive
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}>
                        {Math.abs(percentageChange)}% from last month
                    </span>
                </div>
            )}
        </div>
    );
}
