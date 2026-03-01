import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import api from '../services/api';
import { AuthContext } from './AuthContext';
import { io } from 'socket.io-client';

export const AlertCountContext = createContext();

export function AlertCountProvider({ children }) {
  const { user } = useContext(AuthContext);
  const [counts, setCounts] = useState({ totalActive: 0, unread: 0, pending: 0, investigating: 0, reviewed: 0, escalated: 0, critical: 0 });
  const [loading, setLoading] = useState(true);

  const fetchCounts = useCallback(async () => {
    try {
      if (!user || user.role === 'student') return;
      const res = await api.get('/api/alerts/count');
      if (res.data && res.data.counts) {
        setCounts(res.data.counts);
      }
    } catch (err) {
      // ignore — do not spam console on auth/403
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user || user.role === 'student') return;
    let socket;
    let id = null;
    const startPolling = () => { if (!id) id = setInterval(fetchCounts, 15000); };

    // Start with one immediate fetch
    fetchCounts();

    try {
      const backendPort = import.meta.env.VITE_BACKEND_PORT || '5000';
      const base = `${window.location.protocol}//${window.location.hostname}:${backendPort}`;
      socket = io(base, { reconnection: true });

      socket.on('connect', () => {
        // When socket connects, prefer socket-driven updates and stop polling
        if (id) { clearInterval(id); id = null; }
      });

      socket.on('alerts:refresh', () => {
        // backend asks clients to refresh counts
        fetchCounts();
      });

      socket.on('alerts:counts', (payload) => {
        if (payload) setCounts(payload);
      });

      socket.on('disconnect', () => {
        // fallback to polling when disconnected
        startPolling();
      });
    } catch (e) {
      // if socket fails to initialize, fall back to polling
      startPolling();
    }

    // Ensure polling starts if socket didn't
    if (!socket) startPolling();

    return () => {
      if (id) clearInterval(id);
      try { if (socket) socket.disconnect(); } catch (e) {}
    };
  }, [user, fetchCounts]);

  useEffect(() => {
    const onUsageDeleted = () => fetchCounts();
    window.addEventListener('usage:deleted', onUsageDeleted);
    return () => window.removeEventListener('usage:deleted', onUsageDeleted);
  }, [fetchCounts]);

  // Allow manual refresh (useful after resolving/reviewing an alert)
  const refreshCounts = useCallback(() => fetchCounts(), [fetchCounts]);

  const value = { counts, loading, refreshCounts, setCounts };

  return (
    <AlertCountContext.Provider value={value}>
      {children}
    </AlertCountContext.Provider>
  );
}
