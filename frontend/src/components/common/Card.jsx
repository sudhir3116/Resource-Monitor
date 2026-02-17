import React from 'react';

export default function Card({
    children,
    className = '',
    hover = false,
    title,
    description,
    action
}) {
    return (
        <div className={`card ${hover ? 'card-hover' : ''} ${className}`}>
            {(title || description || action) && (
                <div className="flex items-start justify-between mb-4">
                    <div>
                        {title && <h3 className="card-title">{title}</h3>}
                        {description && <p className="card-description">{description}</p>}
                    </div>
                    {action && <div>{action}</div>}
                </div>
            )}
            {children}
        </div>
    );
}

export function MetricCard({ icon, label, value, change, trend }) {
    return (
        <div className="metric-card">
            <div className="flex items-center justify-between mb-2">
                <p className="metric-label">{label}</p>
                {icon && (
                    <div className="h-10 w-10 rounded-lg flex items-center justify-center"
                        style={{
                            backgroundColor: 'var(--bg-hover)',
                            color: 'var(--text-secondary)'
                        }}>
                        {icon}
                    </div>
                )}
            </div>
            <p className="metric-value">{value}</p>
            {change !== undefined && (
                <p className={`metric-change ${trend || (change >= 0 ? 'positive' : 'negative')}`}>
                    {change >= 0 ? '+' : ''}{change}%
                </p>
            )}
        </div>
    );
}
