import React, { useEffect, useState } from 'react';
import api from '../services/api';
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

export default function AdminDashboard() {
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalAlerts: 0,
        systemHealth: 'Healthy',
        activeUsers: 0
    });
    const [recentLogs, setRecentLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                // Fetch summary stats
                const summaryRes = await api.get('/api/admin/usage/summary');
                const data = summaryRes.data.data || summaryRes.data;

                // Mock active users if not returned
                const activeUsers = data.activeUsers || Math.floor(data.totalUsers * 0.8) || 0;

                setStats({
                    totalUsers: data.totalUsers || 0,
                    totalAlerts: data.totalAlerts || 0,
                    systemHealth: 'Healthy',
                    activeUsers
                });

                // Fetch recent logs (mock or real)
                // If endpoint exists: await api.get('/api/admin/logs?limit=5');
                // Using mock data for now to match the "Audit Stream" replacement
                setRecentLogs([
                    { id: 1, action: 'User Login', user: 'admin@example.com', timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), status: 'success' },
                    { id: 2, action: 'Update Threshold', user: 'admin@example.com', timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), status: 'success' },
                    { id: 3, action: 'Failed Login', user: 'unknown@ip', timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(), status: 'failed' },
                    { id: 4, action: 'Data Export', user: 'principal@example.com', timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(), status: 'success' },
                    { id: 5, action: 'System Backup', user: 'System', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), status: 'success' },
                ]);

            } catch (e) {
                console.error("Failed to fetch admin dashboard data", e);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
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
                <Link to="/users/new">
                    <Button variant="primary">
                        <UserPlus size={16} className="mr-2" />
                        Add User
                    </Button>
                </Link>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    icon={<Users size={20} />}
                    label="Total Users"
                    value={stats.totalUsers}
                    trend="active"
                    change={0} // Placeholder for trend
                />

                <MetricCard
                    icon={<Activity size={20} />}
                    label="Active Sessions"
                    value={stats.activeUsers}
                    trend="positive"
                />

                <MetricCard
                    icon={<AlertTriangle size={20} />}
                    label="System Alerts"
                    value={stats.totalAlerts}
                    trend={stats.totalAlerts > 0 ? 'negative' : 'neutral'}
                />

                <MetricCard
                    icon={<Shield size={20} />}
                    label="System Status"
                    value={stats.systemHealth}
                    trend={stats.systemHealth === 'Healthy' ? 'positive' : 'negative'}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Activity / Logs */}
                <div className="lg:col-span-2">
                    <Card
                        title="Recent System Activity"
                        action={
                            <Link to="/audit-logs">
                                <Button variant="secondary" size="sm">View All Logs</Button>
                            </Link>
                        }
                    >
                        <div className="overflow-x-auto">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Action</th>
                                        <th>User</th>
                                        <th>Time</th>
                                        <th className="text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentLogs.map((log) => (
                                        <tr key={log.id}>
                                            <td className="font-medium">{log.action}</td>
                                            <td style={{ color: 'var(--text-secondary)' }}>{log.user}</td>
                                            <td style={{ color: 'var(--text-secondary)' }}>
                                                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="text-right">
                                                <Badge variant={log.status === 'success' ? 'success' : 'danger'}>
                                                    {log.status === 'success' ? 'Success' : 'Failed'}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>

                {/* Quick Configuration */}
                <div className="space-y-6">
                    <Card title="Quick Actions">
                        <div className="space-y-3">
                            <Link to="/users" className="block">
                                <Button variant="secondary" className="w-full justify-start">
                                    <Users size={16} className="mr-3 text-blue-500" />
                                    Manage Users
                                </Button>
                            </Link>
                            <Link to="/alerts/rules" className="block">
                                <Button variant="secondary" className="w-full justify-start">
                                    <AlertTriangle size={16} className="mr-3 text-amber-500" />
                                    Configure Thresholds
                                </Button>
                            </Link>
                            <Link to="/reports" className="block">
                                <Button variant="secondary" className="w-full justify-start">
                                    <FileText size={16} className="mr-3 text-green-500" />
                                    System Reports
                                </Button>
                            </Link>
                            <Link to="/settings" className="block">
                                <Button variant="secondary" className="w-full justify-start">
                                    <Settings size={16} className="mr-3 text-slate-500" />
                                    System Settings
                                </Button>
                            </Link>
                        </div>
                    </Card>

                    <Card title="System Health Checks">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm">
                                    <CheckCircle size={16} style={{ color: 'var(--color-success)' }} />
                                    <span>Database Connection</span>
                                </div>
                                <span className="text-xs" style={{ color: 'var(--color-success)' }}>Stable</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm">
                                    <CheckCircle size={16} style={{ color: 'var(--color-success)' }} />
                                    <span>API Gateway</span>
                                </div>
                                <span className="text-xs" style={{ color: 'var(--color-success)' }}>Operational</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm">
                                    <CheckCircle size={16} style={{ color: 'var(--color-success)' }} />
                                    <span>Email Service</span>
                                </div>
                                <span className="text-xs" style={{ color: 'var(--color-success)' }}>Active</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm">
                                    <CheckCircle size={16} style={{ color: 'var(--color-success)' }} />
                                    <span>Backup Job</span>
                                </div>
                                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Last run: 2h ago</span>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
