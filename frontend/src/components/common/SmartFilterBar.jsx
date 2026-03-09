import React from 'react'

const SmartFilterBar = ({
    moduleType,
    onFilterChange,
    currentFilters = {}
}) => {
    const activeCount = Object.values(currentFilters)
        .filter(v => v !== '' && v !== null && v !== undefined).length

    const handleChange = (key, value) => {
        onFilterChange({ ...currentFilters, [key]: value })
    }

    const handleReset = () => {
        onFilterChange({})
    }

    return (
        <div className="flex flex-wrap items-center gap-3 mb-4">
            {/* Keyword search — all modules */}
            <div className="relative">
                <input
                    type="text"
                    placeholder="Search..."
                    value={currentFilters.search || ''}
                    onChange={(e) => handleChange('search', e.target.value)}
                    className="pl-8 pr-8 py-2 text-sm border border-gray-300 
                     dark:border-gray-600 rounded-lg bg-white 
                     dark:bg-gray-800 text-gray-700 dark:text-gray-300
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="absolute left-2 top-2.5 text-gray-400 text-xs">
                    🔍
                </span>
                {currentFilters.search && (
                    <button
                        onClick={() => handleChange('search', '')}
                        className="absolute right-2 top-2.5 text-gray-400 
                       hover:text-gray-600 text-xs"
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* Date range — all modules */}
            <input
                type="date"
                value={currentFilters.startDate || ''}
                onChange={(e) => handleChange('startDate', e.target.value)}
                className="py-2 px-3 text-sm border border-gray-300 
                   dark:border-gray-600 rounded-lg bg-white 
                   dark:bg-gray-800 text-gray-700 dark:text-gray-300
                   focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
                type="date"
                value={currentFilters.endDate || ''}
                onChange={(e) => handleChange('endDate', e.target.value)}
                className="py-2 px-3 text-sm border border-gray-300 
                   dark:border-gray-600 rounded-lg bg-white 
                   dark:bg-gray-800 text-gray-700 dark:text-gray-300
                   focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Active filter badge + reset */}
            {activeCount > 0 && (
                <div className="flex items-center gap-2">
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 
                           text-blue-700 dark:bg-blue-900 dark:text-blue-300 
                           rounded-full">
                        {activeCount} filter{activeCount > 1 ? 's' : ''} active
                    </span>
                    <button
                        onClick={handleReset}
                        className="px-3 py-1.5 text-xs font-medium text-gray-600 
                       dark:text-gray-400 border border-gray-300 
                       dark:border-gray-600 rounded-lg hover:bg-gray-50 
                       dark:hover:bg-gray-700 transition-colors"
                    >
                        Reset All
                    </button>
                </div>
            )}
        </div>
    )
}

export default SmartFilterBar
