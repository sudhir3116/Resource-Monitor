import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { AlertCircle, AlertTriangle, Info, Check } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';

export default function Alerts() {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        fetchAlerts();
    }, []);

    async function fetchAlerts() {
        try {
            const response = await api.get('/api/alerts');
            setAlerts(response.data.alerts || []);
        } catch (err) {
            console.error("Failed to fetch alerts", err);
        } finally {
            setLoading(false);
        }
    }

    const handleResolve = async (alertId) => {
        try {
            await api.patch(`/api/alerts/${alertId}/resolve`);
            fetchAlerts();
        } catch (err) {
            console.error("Failed to resolve alert", err);
        }
    };

    const getSeverityIcon = (severity) => {
        switch (severity?.toLowerCase()) {
            case 'critical':
                return <AlertCircle size={20} style={{ color: 'var(--color-danger)' }} />;
            case 'high':
                return <AlertTriangle size={20} style={{ color: 'var(--color-warning)' }} />;
            default:
                return <Info size={20} style={{ color: 'var(--color-primary)' }} />;
        }
    };

    const getSeverityBadge = (severity) => {
        switch (severity?.toLowerCase()) {
            case 'critical':
                return 'critical';
            case 'high':
                return 'warning';
            case 'medium':
                return 'warning';
            default:
                return 'primary';
        }
    };

    const filteredAlerts = filter === 'all'
        ? alerts
        : filter === 'active'
            ? alerts.filter(a => !a.resolved)
            : alerts.filter(a => a.resolved);

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="h-8 rounded" style={{ backgroundColor: 'var(--bg-hover)', width: '200px' }}></div>
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-32 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--bg-hover)' }}></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 style={{ color: 'var(--text-primary)' }}>Alerts</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Monitor and manage resource threshold alerts
                    </p>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2">
                <button
                    onClick={() => setFilter('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'all'
                        ? ''
                        : ''
                        }`}
                    style={{
                        backgroundColor: filter === 'all' ? 'var(--bg-hover)' : 'transparent',
                        color: filter === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)'
                    }}
                >
                    All ({alerts.length})
                </button>
                <button
                    onClick={() => setFilter('active')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors`}
                    style={{
                        backgroundColor: filter === 'active' ? 'var(--bg-hover)' : 'transparent',
                        color: filter === 'active' ? 'var(--text-primary)' : 'var(--text-secondary)'
                    }}
                >
                    Active ({alerts.filter(a => !a.resolved).length})
                </button>
                <button
                    onClick={() => setFilter('resolved')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors`}
                    style={{
                        backgroundColor: filter === 'resolved' ? 'var(--bg-hover)' : 'transparent',
                        color: filter === 'resolved' ? 'var(--text-primary)' : 'var(--text-secondary)'
                    }}
                >
                    Resolved ({alerts.filter(a => a.resolved).length})
                </button>
            </div>

            {/* Alerts List */}
            {filteredAlerts.length === 0 ? (
                <EmptyState
                    icon={<AlertTriangle size={32} />}
                    title="No alerts found"
                    description="There are no alerts matching the current filter"
                />
            ) : (
                <div className="space-y-4">
                    {filteredAlerts.map((alert) => (
                        <div key={alert._id} className="alert-card">
                            <div className="alert-header">
                                <div className="flex items-center gap-2">
                                    {getSeverityIcon(alert.severity)}
                                    <Badge variant={getSeverityBadge(alert.severity)}>
                                        {alert.severity}
                                    </Badge>
                                    {alert.resolved && (
                                        <Badge variant="success">Resolved</Badge>
                                    )}
                                </div>
                                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                    {new Date(alert.timestamp).toLocaleString()}
                                </span>
                            </div>

                            <h4 className="alert-title">{alert.message}</h4>

                            <div className="alert-details">
                                <div className="alert-metric">
                                    <span className="label">Resource</span>
                                    <span className="value">{alert.resourceType}</span>
                                </div>
                                <div className="alert-metric">
                                    <span className="label">Actual Value</span>
                                    <span className="value">
                                        {alert.actualValue} {alert.resourceType === 'Electricity' ? 'kWh' : 'L'}
                                    </span>
                                </div>
                                <div className="alert-metric">
                                    <span className="label">Threshold</span>
                                    <span className="value">
                                        {alert.thresholdValue} {alert.resourceType === 'Electricity' ? 'kWh' : 'L'}
                                    </span>
                                </div>
                                <div className="alert-metric">
                                    <span className="label">Location</span>
                                    <span className="value">
                                        {alert.block?.name || (typeof alert.block === 'string' ? alert.block : 'N/A')}
                                    </span>
                                </div>
                            </div>

                            {!alert.resolved && (
                                <div className="alert-actions">
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={() => handleResolve(alert._id)}
                                    >
                                        <Check size={16} className="mr-2" />
                                        Mark as Resolved
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
