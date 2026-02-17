import React from 'react';
import { twMerge } from 'tailwind-merge';

export const Card = ({ children, className, ...props }) => {
    return (
        <div
            className={twMerge(
                'bg-white border border-slate-200 text-slate-950 shadow-sm rounded-xl overflow-hidden',
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
};

export const CardHeader = ({ children, className }) => <div className={twMerge('flex flex-col space-y-1.5 p-6 pb-2', className)}>{children}</div>;
export const CardTitle = ({ children, className }) => <h3 className={twMerge('text-lg font-semibold leading-none tracking-tight text-slate-900', className)}>{children}</h3>;
export const CardDescription = ({ children, className }) => <p className={twMerge('text-sm text-slate-500', className)}>{children}</p>;
export const CardContent = ({ children, className }) => <div className={twMerge('p-6 pt-0', className)}>{children}</div>;
export const CardFooter = ({ children, className }) => <div className={twMerge('flex items-center p-6 pt-0', className)}>{children}</div>;
