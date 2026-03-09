export const saveSortPreference = (userId, tableName, field, direction) => {
    try {
        const key = `sort_${userId}_${tableName}`
        localStorage.setItem(key, JSON.stringify({
            field, direction, savedAt: Date.now()
        }))
    } catch (e) { }
}

export const getSortPreference = (userId, tableName) => {
    try {
        const key = `sort_${userId}_${tableName}`
        const saved = localStorage.getItem(key)
        return saved ? JSON.parse(saved) : null
    } catch (e) { return null }
}

export const clearUserSortPreferences = (userId) => {
    try {
        Object.keys(localStorage)
            .filter(key => key.startsWith(`sort_${userId}_`))
            .forEach(key => localStorage.removeItem(key))
    } catch (e) { }
}

export const getDefaultSort = (tableName) => {
    const defaults = {
        usageTable: { field: 'date', direction: 'desc' },
        alertTable: { field: 'createdAt', direction: 'desc' },
        complaintTable: { field: 'createdAt', direction: 'desc' },
        userTable: { field: 'createdAt', direction: 'desc' },
        auditTable: { field: 'createdAt', direction: 'desc' },
        reportTable: { field: 'date', direction: 'desc' },
        gmAlertTable: { field: 'createdAt', direction: 'desc' },
        gmDashboardTable: { field: 'createdAt', direction: 'desc' },
    }
    return defaults[tableName] || { field: 'createdAt', direction: 'desc' }
}
