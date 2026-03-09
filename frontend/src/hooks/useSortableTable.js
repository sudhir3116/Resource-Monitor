import { useState, useMemo } from 'react'
import {
    getSortPreference,
    saveSortPreference,
    getDefaultSort
} from '../utils/sortPreference'

const useSortableTable = (data = [], tableName = '', userId = '') => {
    const saved = getSortPreference(userId, tableName)
    const defaults = getDefaultSort(tableName)
    const initial = saved || defaults

    const [sortField, setSortField] = useState(initial.field)
    const [sortDirection, setSortDirection] = useState(initial.direction)

    const handleSort = (field) => {
        const newDirection =
            sortField === field && sortDirection === 'asc' ? 'desc' : 'asc'
        setSortField(field)
        setSortDirection(newDirection)
        if (userId && tableName) {
            saveSortPreference(userId, tableName, field, newDirection)
        }
    }

    const sortedData = useMemo(() => {
        if (!data || !Array.isArray(data)) return []
        return [...data].sort((a, b) => {
            let aVal = a[sortField]
            let bVal = b[sortField]
            if (aVal === undefined || aVal === null) return 1
            if (bVal === undefined || bVal === null) return -1
            // Date check
            if (
                typeof aVal === 'string' &&
                !isNaN(Date.parse(aVal)) &&
                (aVal.includes('-') || aVal.includes('T'))
            ) {
                aVal = new Date(aVal).getTime()
                bVal = new Date(bVal).getTime()
            }
            // Number check
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
            }
            // String check
            const aStr = String(aVal).toLowerCase()
            const bStr = String(bVal).toLowerCase()
            if (sortDirection === 'asc') return aStr.localeCompare(bStr)
            return bStr.localeCompare(aStr)
        })
    }, [data, sortField, sortDirection])

    const currentSortLabel = sortField
        ? `Sorted by ${sortField} (${sortDirection === 'asc' ? 'A→Z' : 'Z→A'})`
        : ''

    return {
        sortedData,
        sortField,
        sortDirection,
        handleSort,
        currentSortLabel
    }
}

export default useSortableTable
