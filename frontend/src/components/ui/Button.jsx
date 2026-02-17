import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const variants = {
    default: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm border border-transparent',
    destructive: 'bg-red-600 text-white hover:bg-red-700 shadow-sm border border-transparent',
    outline: 'border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-sm',
    secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 border border-transparent',
    ghost: 'hover:bg-slate-100 text-slate-600 hover:text-slate-900',
    link: 'text-indigo-600 underline-offset-4 hover:underline',
};

const sizes = {
    default: 'h-9 px-4 py-2',
    sm: 'h-8 px-3 rounded-md text-xs',
    lg: 'h-12 px-8 rounded-md text-base',
    icon: 'h-9 w-9 p-2 flex items-center justify-center',
};

export const Button = React.forwardRef(({ className, variant = 'default', size = 'default', children, ...props }, ref) => {
    return (
        <button
            ref={ref}
            className={twMerge(
                'inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 disabled:pointer-events-none ring-offset-white',
                variants[variant],
                sizes[size],
                className
            )}
            {...props}
        >
            {children}
        </button>
    );
});
Button.displayName = 'Button';
