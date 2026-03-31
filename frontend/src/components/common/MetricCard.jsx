import React from 'react';

/**
 * Premium Metric Card for numeric KPI tracking
 * Consistent with the EcoMonitor SaaS design system
 */
export default function MetricCard({
    icon,
    label,
    value,
    change,
    trend,
    colorClass = 'text-blue-500',
    subValue
}) {
    const isNegative = trend === 'negative' || (typeof trend === 'number' && trend < 0);

    return (
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-4 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[var(--text-secondary)] uppercase tracking-wide font-medium">
                    {label}
                </span>
                {icon && (
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center bg-[var(--bg-muted)] transition-all group-hover:scale-110 ${colorClass}`}>
                        {React.cloneElement(icon, { size: 18 })}
                    </div>
                )}
            </div>

            <div className="space-y-1">
                <div className="text-2xl font-semibold text-[var(--text-primary)]">
                    {value}
                </div>
                {subValue && (
                    <div className="text-xs text-[var(--text-secondary)]">
                        {subValue}
                    </div>
                )}
                {change !== undefined && (
                    <div className={`flex items-center gap-1 text-[11px] font-medium ${isNegative ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {isNegative ? '↓' : '↑'} {Math.abs(change)}%
                        <span className="text-[10px] text-[var(--text-secondary)] opacity-60 ml-1">VS PREV</span>
                    </div>
                )}
            </div>
        </div>
    );
}
