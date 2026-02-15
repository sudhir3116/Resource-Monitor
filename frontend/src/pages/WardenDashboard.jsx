/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Loading from '../components/Loading';
import { AuthContext } from '../context/AuthContext';

export default function WardenDashboard() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [usages, setUsages] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            setLoading(true);
            // Warden sees block usage due to backend logic update
            // axios returns { data: { usages: [...] } }
            const usageRes = await api.get('/api/usage');
            const data = usageRes.data?.usages || [];
            setUsages(Array.isArray(data) ? data : []);

            // Stats
            const statsRes = await api.get('/api/usage/stats');
            setStats(statsRes.data || {});
        } catch (err) {
            console.error('Warden Dashboard fetch error:', err);
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
                    <h1 className="page-title">Warden Dashboard</h1>
                    <p className="text-muted">Manage resource consumption for your block</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => navigate('/usage/new')}
                >
                    + Add Block Usage
                </button>
            </div>

            <div className="dashboard-grid">
                {/* Stats Card */}
                <div className="card stat-card">
                    <div className="stat-value">{usages.length}</div>
                    <div className="stat-label">Block Records</div>
                </div>

                {/* Sustainability Score */}
                <div className="card stat-card">
                    <div className="stat-value">
                        {stats?.sustainabilityScore ?? '-'}
                    </div>
                    <div className="stat-label">Block Sustainability Score</div>
                </div>

                {/* Total Usage */}
                <div className="card stat-card">
                    <div className="stat-value">
                        {stats?.totalUsage ? Number(stats.totalUsage).toFixed(1) : '0'}
                    </div>
                    <div className="stat-label">Total Block Consumption</div>
                </div>

                {/* Recent Usage List */}
                <div className="card" style={{ gridColumn: 'span 3' }}>
                    <h3>Recent Block Activity</h3>
                    {usages.length > 0 ? (
                        <div className="table-responsive">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Category</th>
                                        <th>Resource</th>
                                        <th>Amount</th>
                                        <th>Notes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {usages.slice(0, 10).map(u => (
                                        <tr key={u._id}>
                                            <td>{new Date(u.usage_date).toLocaleDateString()}</td>
                                            <td>{u.category || '-'}</td>
                                            <td>{u.resource_type}</td>
                                            <td>{u.usage_value} {u.unit || ''}</td>
                                            <td className="text-muted" style={{ fontSize: '0.85rem' }}>{u.notes}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-muted">No usage data recorded for this block yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
