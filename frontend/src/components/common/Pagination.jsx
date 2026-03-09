import React from 'react'

const Pagination = ({
    page, totalPages, total, limit,
    onPageChange, onLimitChange
}) => {
    if (totalPages <= 1) return null

    const getPageNumbers = () => {
        const pages = []
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i)
            return pages
        }
        pages.push(1)
        if (page > 3) pages.push('...')
        const start = Math.max(2, page - 1)
        const end = Math.min(totalPages - 1, page + 1)
        for (let i = start; i <= end; i++) pages.push(i)
        if (page < totalPages - 2) pages.push('...')
        pages.push(totalPages)
        return pages
    }

    const from = (page - 1) * limit + 1
    const to = Math.min(page * limit, total)

    return (
        <div className="flex items-center justify-between px-4 py-3 
                    border-t border-gray-200 dark:border-gray-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">
                Showing {from}–{to} of {total} records
            </span>
            <div className="flex items-center gap-1">
                <button
                    onClick={() => onPageChange(page - 1)}
                    disabled={page === 1}
                    className="px-3 py-1 text-sm rounded border border-gray-300 
                     dark:border-gray-600 disabled:opacity-40
                     hover:bg-gray-50 dark:hover:bg-gray-700 
                     transition-colors"
                >
                    ←
                </button>
                {getPageNumbers().map((p, i) =>
                    p === '...' ? (
                        <span key={`dots-${i}`} className="px-2 text-gray-400">...</span>
                    ) : (
                        <button
                            key={p}
                            onClick={() => onPageChange(p)}
                            className={`px-3 py-1 text-sm rounded border transition-colors
                ${p === page
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                        >
                            {p}
                        </button>
                    )
                )}
                <button
                    onClick={() => onPageChange(page + 1)}
                    disabled={page === totalPages}
                    className="px-3 py-1 text-sm rounded border border-gray-300 
                     dark:border-gray-600 disabled:opacity-40
                     hover:bg-gray-50 dark:hover:bg-gray-700 
                     transition-colors"
                >
                    →
                </button>
            </div>
            <select
                value={limit}
                onChange={(e) => onLimitChange(Number(e.target.value))}
                className="text-sm border border-gray-300 dark:border-gray-600 
                   rounded px-2 py-1 bg-white dark:bg-gray-800
                   text-gray-700 dark:text-gray-300"
            >
                {[10, 25, 50, 100].map(n => (
                    <option key={n} value={n}>{n} per page</option>
                ))}
            </select>
        </div>
    )
}

export default Pagination
