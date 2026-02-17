import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const variants = {
    default: 'bg-indigo-100/50 text-indigo-700 border-indigo-200/50',
    secondary: 'bg-slate-100 text-slate-700 border-slate-200',
    destructive: 'bg-red-100/50 text-red-700 border-red-200/50',
    outline: 'border-slate-200 text-slate-500',
    success: 'bg-emerald-100/50 text-emerald-700 border-emerald-200/50',
    warning: 'bg-amber-100/50 text-amber-700 border-amber-200/50',
};

export const Badge = ({ className, variant = 'default', ...props }) => {
    return (
        <div className={twMerge(
            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            variants[variant],
            className
        )} {...props} />
    );
};
