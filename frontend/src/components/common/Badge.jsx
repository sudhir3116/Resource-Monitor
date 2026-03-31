import React from 'react';

/**
 * Premium Status Badge Component
 * Optimized for high-contrast visibility and professional SaaS aesthetic
 */
export default function Badge({
    children,
    variant = 'primary',
    className = ''
}) {
    // Map normalized variants for better styling control
    const variants = {
        primary: 'badge-primary bg-blue-500/10 text-blue-600 border-blue-500/20',
        secondary: 'badge-secondary bg-slate-500/10 text-slate-600 border-slate-500/20',
        success: 'badge-success bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
        warning: 'badge-warning bg-amber-500/10 text-amber-600 border-amber-500/20',
        danger: 'badge-danger bg-rose-500/10 text-rose-600 border-rose-500/20',
        critical: 'badge-danger bg-rose-500/20 text-rose-700 border-rose-500/30 font-black px-3 py-1',
        default: 'badge-secondary bg-slate-500/10 text-slate-500 border-slate-500/20'
    };

    const variantClass = variants[variant.toLowerCase()] || variants.primary;

    return (
        <span className={`badge ${variantClass} ${className} shadow-sm-soft`}>
            {children}
        </span>
    );
}
