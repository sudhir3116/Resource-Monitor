import React from 'react'

const SortIcon = ({ field, sortField, sortDirection }) => {
    if (sortField !== field) {
        return <span className="ml-1 text-gray-400 text-xs">↕</span>
    }
    return (
        <span className="ml-1 text-blue-500 text-xs transition-all duration-200">
            {sortDirection === 'asc' ? '↑' : '↓'}
        </span>
    )
}

export default SortIcon
