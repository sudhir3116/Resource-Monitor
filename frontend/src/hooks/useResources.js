import { useState, useEffect, useCallback } from 'react'
import api from '../api/axios'
import { getSocket } from '../utils/socket'

// Global cache shared across all hook instances
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
        // Use primary /api/resources endpoint
        const response = await api.get('/api/resources');

        const raw = response.data?.data || response.data?.resources || response.data || [];

        // Filter: status strictly "active" (Requirement Part 3 & 4)
        const active = Array.isArray(raw)
            ? raw.filter(r => r?.status === "active" || r?.isActive === true)
            : [];

        lastFetch = Date.now()

        // Map to normalized shape
        const mapped = active.map(r => ({
            _id: r._id,
            name: r.name,
            unit: r.unit || 'units',
            color: r.color || '#64748b',
            icon: r.icon || '📊',
            isActive: r.isActive !== false,
            costPerUnit: r.costPerUnit || 0,
            dailyLimit: r.dailyLimit || 0,
            monthlyLimit: r.monthlyLimit || 0,
            emoji: r.icon || '📊'
        }))

        notifyListeners(mapped)
        return mapped
    } catch (e) {
        console.error('[useResources] Failed to fetch:', e.message);
    }
    return globalResources
}

export const useResources = () => {
    const [resources, setResources] = useState(globalResources)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Register listener
        const listener = (r) => setResources(r)
        globalListeners.push(listener)

        // Fetch if cache stale
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

    // Socket.io real-time updates
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

// NAMED EXPORT: for use after mutations
export const refetchResources = () => {
    lastFetch = 0
    return fetchFromAPI()
}

// DEFAULT EXPORT
export default useResources
