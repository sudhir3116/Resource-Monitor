import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AlertCountContext } from './AlertCountContext';
import api from '../api/axios';
import { AuthContext } from './AuthContext';
import { getSocket } from '../utils/socket';


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

    fetchCounts();

    const socket = getSocket();
    if (socket) {
      socket.on('alerts:refresh', fetchCounts);
      socket.on('alert:updated', fetchCounts);
      socket.on('alert:new', fetchCounts);
    }

    return () => {
      if (socket) {
        socket.off('alerts:refresh', fetchCounts);
        socket.off('alert:updated', fetchCounts);
        socket.off('alert:new', fetchCounts);
      }
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
