import React from 'react';

const ChartWrapper = ({ children, title, subtitle, action }) => (
    <div className="card h-full flex flex-col p-6 animate-fade-in group hover:shadow-2xl dark:hover:shadow-black/40 transition-all duration-500">
        <div className="flex justify-between items-start mb-8">
            <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-slate-50 leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{title}</h3>
                {subtitle && <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 font-bold">{subtitle}</p>}
            </div>
            {action && (
                <div className="ml-4">
                    {action}
                </div>
            )}
        </div>
        <div className="flex-1 w-full min-h-[300px] relative">
            {children}
        </div>
    </div>
);

export default ChartWrapper;
