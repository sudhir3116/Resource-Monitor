import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'

const DEFAULT_RESOURCES = [
    { name: 'Electricity', unit: 'kWh', color: '#F59E0B', icon: '⚡', isActive: true },
    { name: 'Water', unit: 'Liters', color: '#3B82F6', icon: '💧', isActive: true },
    { name: 'LPG', unit: 'kg', color: '#EF4444', icon: '🔥', isActive: true },
    { name: 'Diesel', unit: 'Liters', color: '#8B5CF6', icon: '⛽', isActive: true },
    { name: 'Solar', unit: 'kWh', color: '#10B981', icon: '☀️', isActive: true },
    { name: 'Waste', unit: 'kg', color: '#6B7280', icon: '♻️', isActive: true },
]

// Global cache shared across all hook instances
let globalResources = DEFAULT_RESOURCES
let globalListeners = []
let lastFetch = 0
const CACHE_TTL = 30000 // 30 seconds

const notifyListeners = (resources) => {
    globalResources = resources
    globalListeners.forEach(fn => fn(resources))
}

const fetchFromAPI = async () => {
    try {
        const res = await api.get('/api/resource-config')
        const raw = res.data?.data || res.data?.resources || []
        const active = Array.isArray(raw) ? raw.filter(r => r.isActive !== false) : []
        if (active.length > 0) {
            lastFetch = Date.now()
            notifyListeners(active)
            return active
        }
    } catch (e) {
        // Keep existing on error
    }
    return globalResources
}

export const useResources = () => {
    const [resources, setResources] = useState(globalResources)
    const [loading, setLoading] = useState(globalResources === DEFAULT_RESOURCES)

    useEffect(() => {
        // Register this instance as a listener
        const listener = (r) => setResources(r)
        globalListeners.push(listener)

        // Fetch if cache is stale
        const now = Date.now()
        if (now - lastFetch > CACHE_TTL) {
            fetchFromAPI().finally(() => setLoading(false))
        } else {
            setLoading(false)
        }

        return () => {
            globalListeners = globalListeners.filter(fn => fn !== listener)
        }
    }, [])

    const refetch = useCallback(async () => {
        setLoading(true)
        lastFetch = 0 // Force fresh fetch
        await fetchFromAPI()
        setLoading(false)
    }, [])

    return { resources, loading, error: null, refetch }
}

// Export standalone refetch for use after admin delete/update actions
export const refetchResources = () => {
    lastFetch = 0
    return fetchFromAPI()
}

export default useResources
