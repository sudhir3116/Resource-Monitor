import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import { getSocket } from '../utils/socket'

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
        const res = await api.get('/api/resources')
        const raw = res.data?.data || res.data?.resources || []

        // Safety filter: ensure we only show ACTIVE resources to anyone by default
        // Admins should still see inactive ones in the Config page, but this hook is for usage/dashboards.
        // Wait, if an Admin goes to the Config page, they might use this hook? 
        // No, the Config page usually fetches its own data to manage active/inactive states.
        const active = Array.isArray(raw) ? raw.filter(r => r?.isActive === true) : []
        lastFetch = Date.now()

        // Map the resource configs into the shape expected by the UI.
        // If there are no active resources, propagate an empty array.
        const mapped = (Array.isArray(active) ? active : []).map(r => ({
            _id: r._id,
            name: r.name,
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

    useEffect(() => {
        const socket = getSocket()
        if (!socket) return undefined

        const handleRefresh = () => {
            lastFetch = 0
            fetchFromAPI().catch(() => { })
        }

        socket.on('resources:refresh', handleRefresh)
        socket.on('resource:created', handleRefresh)
        socket.on('resource:deleted', handleRefresh)
        socket.on('resource:activated', handleRefresh)
        socket.on('resource:deactivated', handleRefresh)
        socket.on('usage:logged', handleRefresh)

        return () => {
            socket.off('resources:refresh', handleRefresh)
            socket.off('resource:created', handleRefresh)
            socket.off('resource:deleted', handleRefresh)
            socket.off('resource:activated', handleRefresh)
            socket.off('resource:deactivated', handleRefresh)
            socket.off('usage:logged', handleRefresh)
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
