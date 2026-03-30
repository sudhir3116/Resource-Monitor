import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'

// Global cache shared across all hook instances.
// Important: we intentionally start empty and do NOT fall back to hardcoded
// defaults when the backend has no active resources.
let globalResources = []
let globalListeners = []
let lastFetch = 0
const CACHE_TTL = 30000 // 30 seconds

const notifyListeners = (resources) => {
    globalResources = resources
    globalListeners.forEach(fn => fn(resources))
}

const fetchFromAPI = async () => {
    try {
        const res = await api.get('/api/config/thresholds')
        const raw = res.data?.data || res.data?.resources || []
        const active = Array.isArray(raw) ? raw.filter(r => r.isActive !== false) : []
        lastFetch = Date.now()

        // Map the resource configs into the shape expected by the UI.
        // If there are no active resources, propagate an empty array.
        const mapped = (Array.isArray(active) ? active : []).map(r => ({
            name: r.resource || r.name,
            unit: r.unit || 'units',
            color: r.color || '#64748b',
            icon: r.icon || '📊',
            isActive: r.isActive
        }))

        notifyListeners(mapped)
        return mapped
    } catch (e) {
        console.error('Failed fetching dynamic resources:', e.message);
        // Keep existing on error (typically empty on fresh sessions)
    }
    return globalResources
}

export const useResources = () => {
    const [resources, setResources] = useState(globalResources)
    const [loading, setLoading] = useState(true)

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
