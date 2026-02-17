import React from 'react';
import { twMerge } from 'tailwind-merge';

export const Input = React.forwardRef(({ className, type, label, error, ...props }, ref) => {
    return (
        <div className="w-full space-y-1">
            {label && <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-700">{label}</label>}
            <input
                type={type}
                className={twMerge(
                    "flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 transition-all shadow-sm",
                    error ? "border-red-500 focus-visible:ring-red-500" : "",
                    className
                )}
                ref={ref}
                {...props}
            />
            {error && <p className="text-sm font-medium text-red-500 animate-slide-up">{error}</p>}
        </div>
    );
});
Input.displayName = "Input";
