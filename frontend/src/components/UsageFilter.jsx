import React from 'react'
import { useResources } from '../hooks/useResources'

export default function UsageFilter({ filters, onFilterChange }) {
    const { resources } = useResources()
    // Fallback to empty object if filters prop is missing
    const currentFilters = filters || {
        resource: '',
        category: '',
        start: '',
        end: '',
        sort: 'usage_date:desc'
    }

    const handleChange = (e) => {
        e.preventDefault()
        const { name, value } = e.target
        const newFilters = { ...currentFilters, [name]: value }
        onFilterChange(newFilters)
    }

    return (
        <div className="filter-bar">
            {/* Resource Type */}
            <div className="filter-group">
                <label>Resource</label>
                <select name="resource" value={currentFilters.resource || ''} onChange={handleChange}>
                    <option value="">All Resources</option>
                    {(Array.isArray(resources) ? resources : []).map(r => (
                        <option key={r?._id || r?.name} value={r?.name || ''}>
                            {r?.icon ? `${r.icon} ` : ''}{r?.name || 'Unknown'}
                        </option>
                    ))}
                </select>
            </div>

            {/* Category */}
            <div className="filter-group">
                <label>Location/Category</label>
                <select name="category" value={currentFilters.category || ''} onChange={handleChange}>
                    <option value="">All Locations</option>
                    <option value="Hostel Block A">Hostel Block A</option>
                    <option value="Hostel Block B">Hostel Block B</option>
                    <option value="Hostel Block C">Hostel Block C</option>
                    <option value="Mess Hall">Mess Hall</option>
                    <option value="Kitchen">Kitchen</option>
                    <option value="Generator Room">Generator Room</option>
                </select>
            </div>

            <div className="filter-group">
                <label>From</label>
                <input type="date" name="start" value={currentFilters.start || ''} onChange={handleChange} />
            </div>

            <div className="filter-group">
                <label>To</label>
                <input type="date" name="end" value={currentFilters.end || ''} onChange={handleChange} />
            </div>

            <div className="filter-group">
                <label>Sort By</label>
                <select name="sort" value={currentFilters.sort || 'usage_date:desc'} onChange={handleChange}>
                    <option value="usage_date:desc">Latest</option>
                    <option value="usage_value:desc">Usage (High to Low)</option>
                    <option value="usage_value:asc">Usage (Low to High)</option>
                </select>
            </div>
        </div>
    )
}

