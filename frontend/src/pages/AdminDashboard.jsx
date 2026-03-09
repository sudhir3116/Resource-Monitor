import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { getSocket } from '../utils/socket';
import {
    Users,
    AlertTriangle,
    Activity,
    Settings,
    UserPlus,
    Shield,
    FileText,
    CheckCircle,
    XCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Card, { MetricCard } from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { logger } from '../utils/logger';


export default function AdminDashboard() {
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalAlerts: 0,
        systemHealth: 'Healthy',
        activeUsers: 0
    });

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                // Fetch stats concurrently
                const [usersRes, blocksRes, alertsRes, complaintsRes] = await Promise.allSettled([
                    api.get('/api/admin/users'),
                    api.get('/api/admin/blocks'),
                    api.get('/api/alerts?limit=5'),
                    api.get('/api/complaints?limit=5')
                ]);

                const users = usersRes.status === 'fulfilled' ? usersRes.value.data.data || usersRes.value.data : [];
                const blocks = blocksRes.status === 'fulfilled' ? blocksRes.value.data.data || blocksRes.value.data : [];
                const alerts = alertsRes.status === 'fulfilled' ? alertsRes.value.data.alerts || alertsRes.value.data : [];
                const complaints = complaintsRes.status === 'fulfilled' ? complaintsRes.value.data.complaints || complaintsRes.value.data : [];

                const activeAlertsCount = alerts.filter(a => a.status === 'Active' || a.status === 'Pending').length;
                const pendingComplaintsCount = complaints.filter(c => c.status === 'Pending').length;

                setStats({
                    totalUsers: users.length || 0,
                    totalBlocks: blocks.length || 0,
                    activeAlerts: activeAlertsCount || 0,
                    pendingComplaints: pendingComplaintsCount || 0,
                    recentAlerts: alerts.slice(0, 5) || [],
                    recentComplaints: complaints.slice(0, 5) || []
                });
            } catch (err) {
                logger.error('Failed to load Admin Dashboard stats', err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();

        const socket = getSocket();
        if (socket) {
            socket.on('dashboard:refresh', fetchData);
            socket.on('users:refresh', fetchData);
        }

        return () => {
            if (socket) {
                socket.off('dashboard:refresh', fetchData);
                socket.off('users:refresh', fetchData);
            }
        };
    }, []);



    if (loading) {
        return (
            <div className="space-y-6">
                <div className="h-8 rounded" style={{ backgroundColor: 'var(--bg-hover)', width: '200px' }}></div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(i => (
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
                    <h1 style={{ color: 'var(--text-primary)' }}>System Administration</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Overview of system performance, users, and security logs
                    </p>
                </div>
                <Link to="/users">
                    <Button variant="primary">
                        <UserPlus size={16} className="mr-2" />
                        Manage Users
                    </Button>
                </Link>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    icon={<Users size={20} />}
                    label="Total Users"
                    value={stats.totalUsers || 0}
                    trend="active"
                />

                <MetricCard
                    icon={<Activity size={20} />}
                    label="Total Blocks"
                    value={stats.totalBlocks || 0}
                    trend="positive"
                />

                <MetricCard
                    icon={<AlertTriangle size={20} />}
                    label="Active Alerts"
                    value={stats.activeAlerts || 0}
                    trend={stats.activeAlerts > 0 ? 'negative' : 'neutral'}
                />

                <MetricCard
                    icon={<Shield size={20} />}
                    label="Complaints Pending"
                    value={stats.pendingComplaints || 0}
                    trend={stats.pendingComplaints > 0 ? 'negative' : 'positive'}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Alerts */}
                <div className="lg:col-span-2 space-y-6">
                    <Card
                        title="Recent Alerts"
                        action={
                            <Link to="/alerts">
                                <Button variant="secondary" size="sm">View All</Button>
                            </Link>
                        }
                    >
                        <div className="overflow-x-auto">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Resource</th>
                                        <th>Block</th>
                                        <th>Severity</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(stats.recentAlerts || []).map((alert) => (
                                        <tr key={alert._id}>
                                            <td className="font-medium capitalize">{alert.resource}</td>
                                            <td style={{ color: 'var(--text-secondary)' }}>{alert.block?.name || 'Unknown'}</td>
                                            <td>
                                                <Badge variant={alert.severity === 'Critical' ? 'danger' : alert.severity === 'Warning' ? 'warning' : 'primary'}>
                                                    {alert.severity}
                                                </Badge>
                                            </td>
                                            <td>
                                                <Badge variant={alert.status === 'Active' || alert.status === 'Pending' ? 'danger' : 'success'}>
                                                    {alert.status}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                    {(!stats.recentAlerts || stats.recentAlerts.length === 0) && (
                                        <tr>
                                            <td colSpan="4" className="text-center py-4 text-gray-500">No alerts found</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    <Card
                        title="Recent Complaints"
                        action={
                            <Link to="/complaints">
                                <Button variant="secondary" size="sm">View All</Button>
                            </Link>
                        }
                    >
                        <div className="overflow-x-auto">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Subject</th>
                                        <th>Category</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(stats.recentComplaints || []).map((complaint) => (
                                        <tr key={complaint._id}>
                                            <td className="font-medium">{complaint.subject}</td>
                                            <td style={{ color: 'var(--text-secondary)' }}>{complaint.category}</td>
                                            <td>
                                                <Badge variant={complaint.status === 'Pending' ? 'warning' : 'success'}>
                                                    {complaint.status}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                    {(!stats.recentComplaints || stats.recentComplaints.length === 0) && (
                                        <tr>
                                            <td colSpan="3" className="text-center py-4 text-gray-500">No complaints found</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>

                {/* Quick Configuration */}
                <div className="space-y-6">
                    <Card title="Quick Actions">
                        <div className="space-y-3">
                            <Link to="/reports" className="block">
                                <Button variant="secondary" className="w-full justify-start">
                                    <FileText size={16} className="mr-3 text-blue-500" />
                                    Generate Reports
                                </Button>
                            </Link>
                            <Link to="/resource-config" className="block">
                                <Button variant="secondary" className="w-full justify-start">
                                    <AlertTriangle size={16} className="mr-3 text-amber-500" />
                                    Configure Thresholds
                                </Button>
                            </Link>
                            <Link to="/analytics" className="block">
                                <Button variant="secondary" className="w-full justify-start">
                                    <Activity size={16} className="mr-3 text-green-500" />
                                    System Analytics
                                </Button>
                            </Link>
                            <Link to="/profile" className="block">
                                <Button variant="secondary" className="w-full justify-start">
                                    <Settings size={16} className="mr-3 text-slate-500" />
                                    System Settings
                                </Button>
                            </Link>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
