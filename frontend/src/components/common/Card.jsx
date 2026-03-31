import React from 'react';

/**
 * Professional SaaS Card Component
 * Uses CSS variables for theme consistency
 */
export default function Card({
    children,
    className = '',
    hover = true,
    title,
    description,
    action,
    variant = 'default'
}) {
    const baseClass = 'bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-4 shadow-sm';
    const hoverClass = hover ? 'hover:shadow-md transition-all duration-200' : '';

    return (
        <div className={`${baseClass} ${hoverClass} ${className}`}>
            {(title || description || action) && (
                <div className="flex items-start justify-between mb-4">
                    <div className="space-y-1">
                        {title && <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>}
                        {description && <p className="text-xs text-[var(--text-secondary)]">{description}</p>}
                    </div>
                    {action && <div>{action}</div>}
                </div>
            )}
            <div className="relative">
                {children}
            </div>
        </div>
    );
}

/**
 * Metric Card for numeric values and performance tracking
 */
export function MetricCard({ icon, label, value, change, trend, colorClass = 'text-blue-500' }) {
    return (
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-4 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-[var(--text-secondary)] uppercase tracking-wide font-medium">{label}</span>
                {icon && (
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center bg-[var(--bg-muted)] transition-all group-hover:scale-110 ${colorClass}`}>
                        {icon}
                    </div>
                )}
            </div>
            <div>
                <div className="text-2xl font-semibold text-[var(--text-primary)] mb-1">{value}</div>
                {change !== undefined && (
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${trend === 'negative' ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {trend === 'negative' ? '↓' : '↑'} {Math.abs(change)}%
                        <span className="text-[var(--text-secondary)] opacity-60">vs prev</span>
                    </div>
                )}
            </div>
        </div>
    );
}
