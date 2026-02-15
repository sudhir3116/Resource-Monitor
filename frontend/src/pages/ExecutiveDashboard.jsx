/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from 'react';
import api from '../services/api';
import Loading from '../components/Loading';

export default function ExecutiveDashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                setLoading(true);
                // GET /api/admin/usage/summary returns { totalUsers, totalUsage, ... }
                // axios wrap -> response.data
                const res = await api.get('/api/admin/usage/summary');
                setData(res.data);
            } catch (err) {
                console.error("Exec dashboard error:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    if (loading) return <Loading />;

    if (!data) return <div className="text-center p-4">Failed to load analytics data.</div>;

    const resourceTotals = data.resourceTotals || {};
    const hostelTotals = data.hostelTotals || {};

    return (
        <div className="dashboard-container fade-in">
            <div className="dashboard-header">
                <div>
                    <h1 className="page-title">Executive Analytics</h1>
                    <p className="text-muted">High-level overview for Dean & Principal</p>
                </div>
            </div>

            <div className="dashboard-grid">
                <div className="card stat-card">
                    <div className="stat-value">{data.totalUsers || 0}</div>
                    <div className="stat-label">Total Users</div>
                </div>
                <div className="card stat-card">
                    <div className="stat-value">{data.totalUsage || 0}</div>
                    <div className="stat-label">Usage Records</div>
                </div>
                <div className="card stat-card">
                    <div className="stat-value">{data.totalAlerts || 0}</div>
                    <div className="stat-label">System Alerts</div>
                </div>
            </div>

            <div className="dashboard-grid" style={{ marginTop: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))' }}>
                {/* Resource Consumption */}
                <div className="card">
                    <h3>Total Resource Consumption</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                        {Object.keys(resourceTotals).length > 0 ? Object.entries(resourceTotals).map(([resource, total]) => (
                            <div key={resource}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <span style={{ fontWeight: 500 }}>{resource}</span>
                                    <span className="text-muted">{Number(total).toFixed(1)}</span>
                                </div>
                                <div style={{ width: '100%', background: '#f3f4f6', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                                    <div style={{ width: '100%', background: '#4f46e5', height: '100%', borderRadius: 4, opacity: 0.8 }}></div>
                                </div>
                            </div>
                        )) : <p className="text-muted">No resource data available.</p>}
                    </div>
                </div>

                {/* Hostel Wise Comparison */}
                <div className="card">
                    <h3>Hostel-wise Comparison</h3>
                    <div className="table-responsive" style={{ marginTop: 16 }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Hostel / Area</th>
                                    <th>Total Usage</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.keys(hostelTotals).length > 0 ? Object.entries(hostelTotals).map(([hostel, total]) => (
                                    <tr key={hostel}>
                                        <td>{hostel}</td>
                                        <td>{Number(total).toFixed(1)}</td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan="2" className="text-muted text-center" style={{ padding: 20 }}>No hostel data available.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
