import React from 'react';

/**
 * Standardized High-End SaaS Button Component
 * Polished for consistent interaction feedback across all roles
 */
export default function Button({
    children,
    variant = 'primary',
    size = 'md',
    disabled = false,
    onClick,
    type = 'button',
    className = '',
    loading = false,
    ...props
}) {
    const variants = {
        primary: 'btn-primary bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 active:scale-95',
        secondary: 'btn-secondary bg-[var(--bg-muted)] hover:bg-[var(--bg-secondary)] text-primary border-[var(--border-color)] hover:border-blue-500/30 shadow-sm active:scale-95',
        ghost: 'btn-ghost bg-transparent hover:bg-[var(--bg-muted)] text-secondary hover:text-primary active:scale-95',
        danger: 'btn-danger bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-500/20 active:scale-95',
        warning: 'btn-warning bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 active:scale-95',
        outline: 'btn-outline border-2 border-blue-500 text-blue-500 hover:bg-blue-500/5 active:scale-95'
    };

    const sizes = {
        sm: 'px-3 py-1.5 text-xs font-bold leading-tight',
        md: 'px-4 py-2.5 text-sm font-bold leading-tight',
        lg: 'px-6 py-3.5 text-base font-black leading-tight'
    };

    const activeVariant = variants[variant] || variants.primary;
    const activeSize = sizes[size] || sizes.md;

    return (
        <button
            type={type}
            className={`btn ${activeVariant} ${activeSize} ${className} flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed`}
            disabled={disabled || loading}
            onClick={onClick}
            {...props}
        >
            {loading && <Loader size={16} />}
            {children}
        </button>
    );
}

function Loader({ size }) {
    return (
        <svg
            width={size} height={size}
            className="animate-spin mr-2"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
    );
}
