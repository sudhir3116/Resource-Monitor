import React from 'react';

export default function TableSkeleton({ rows = 5, columns = 5 }) {
    return (
        <div className="w-full overflow-x-auto">
            <table className="w-full text-left">
                <thead>
                    <tr>
                        {Array.from({ length: columns }).map((_, i) => (
                            <th key={i} className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
                                <div className="h-4 w-24 rounded animate-pulse" style={{ backgroundColor: 'var(--bg-hover)' }}></div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {Array.from({ length: rows }).map((_, r) => (
                        <tr key={r}>
                            {Array.from({ length: columns }).map((_, c) => (
                                <td key={c} className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
                                    <div className="h-4 w-full rounded animate-pulse" style={{ backgroundColor: 'var(--bg-hover)' }}></div>
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
