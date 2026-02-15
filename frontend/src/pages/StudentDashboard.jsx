/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useContext } from 'react';
import api from '../services/api';
import Loading from '../components/Loading';
import { AuthContext } from '../context/AuthContext';

export default function StudentDashboard() {
    const { user } = useContext(AuthContext);
    const [usages, setUsages] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            setLoading(true);
            // Fetch Usage List (user's own usage)
            const usageRes = await api.get('/api/usage');
            // axios returns { data: { usages: [...] } }
            const data = usageRes.data?.usages || [];
            setUsages(Array.isArray(data) ? data : []);

            // Fetch Stats (user's own stats)
            const statsRes = await api.get('/api/usage/stats');
            setStats(statsRes.data || {});
        } catch (err) {
            console.error('Student Dashboard fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (loading) return <Loading />;

    return (
        <div className="dashboard-container fade-in">
            <div className="dashboard-header">
                <div>
                    <h1 className="page-title">My Dashboard</h1>
                    <p className="text-muted">Overview of your personal resource consumption</p>
                </div>
            </div>

            <div className="dashboard-grid">
                {/* Stats Card */}
                <div className="card stat-card">
                    <div className="stat-value">{usages.length}</div>
                    <div className="stat-label">Total Records</div>
                </div>

                {/* Sustainability Score */}
                <div className="card stat-card">
                    <div className="stat-value">
                        {stats?.sustainabilityScore ?? '-'}
                    </div>
                    <div className="stat-label">Sustainability Score</div>
                </div>

                {/* Total Usage (Fixed prop name to match backend stats) */}
                <div className="card stat-card">
                    <div className="stat-value">
                        {stats?.totalUsage ? Number(stats.totalUsage).toFixed(1) : '0'}
                    </div>
                    <div className="stat-label">Total Consumption (Units)</div>
                </div>

                {/* Recent Alerts (if any) */}
                {stats?.recentAlerts && stats.recentAlerts.length > 0 && (
                    <div className="card" style={{ gridColumn: 'span 3', borderLeft: '4px solid #ef4444' }}>
                        <h3>Recent Alerts</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                            {stats.recentAlerts.map(alert => (
                                <div key={alert._id} style={{ padding: 10, background: '#fee2e2', borderRadius: 6, color: '#991b1b' }}>
                                    <strong>{alert.resourceType}:</strong> {alert.message} <br />
                                    <small>{new Date(alert.createdAt).toLocaleDateString()}</small>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Recent Usage List */}
                <div className="card" style={{ gridColumn: 'span 3' }}>
                    <h3>Recent Activity</h3>
                    {usages.length > 0 ? (
                        <div className="table-responsive">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Resource</th>
                                        <th>Amount</th>
                                        <th>Unit</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {usages.slice(0, 10).map(u => (
                                        <tr key={u._id}>
                                            <td>{new Date(u.usage_date).toLocaleDateString()}</td>
                                            <td>{u.resource_type}</td>
                                            <td>{u.usage_value}</td>
                                            <td>{u.unit || ''}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-muted">No usage data found.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
