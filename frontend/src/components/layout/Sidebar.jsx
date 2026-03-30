import React, { useContext } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { ROLES } from '../../utils/roles';
import api from '../../services/api';
import { Activity, User } from 'lucide-react';

const NAV_CONFIG = {
    admin: [
        { label: 'Dashboard', icon: '📊', path: '/admin/dashboard' },
        { label: 'Usage', icon: '⚡', path: '/admin/usage' },
        { label: 'Alerts', icon: '🔔', path: '/admin/alerts' },
        { label: 'Complaints', icon: '📝', path: '/admin/complaints' },
        { label: 'Analytics', icon: '📈', path: '/admin/analytics' },
        { label: 'Notice Board', icon: '📌', path: '/admin/notices' },
        { label: 'Users', icon: '👥', path: '/admin/users' },
        { label: 'Blocks', icon: '🏠', path: '/admin/blocks' },
        { label: 'Resource Config', icon: '⚙️', path: '/admin/resource-config' },
        { label: 'Audit Logs', icon: '🗃️', path: '/admin/audit-logs' },
        { label: 'Database', icon: '🗄️', path: '/admin/database-viewer' },
        { label: 'Reports', icon: '📤', path: '/admin/reports' },
    ],
    gm: [
        { label: 'Dashboard', icon: '📊', path: '/gm/dashboard' },
        { label: 'Usage', icon: '⚡', path: '/gm/usage' },
        { label: 'Alerts', icon: '🔔', path: '/gm/alerts' },
        { label: 'Complaints', icon: '📝', path: '/gm/complaints' },
        { label: 'Analytics', icon: '📈', path: '/gm/analytics' },
        { label: 'Notice Board', icon: '📌', path: '/gm/notices' },
        { label: 'Resource Config', icon: '⚙️', path: '/gm/resource-config' },
        { label: 'Reports', icon: '📤', path: '/gm/reports' },
        { label: 'Audit Logs', icon: '🗃️', path: '/gm/audit-logs' },
    ],
    warden: [
        { label: 'Dashboard', icon: '📊', path: '/warden/dashboard' },
        { label: 'Usage', icon: '⚡', path: '/warden/usage' },
        { label: 'Alerts', icon: '🔔', path: '/warden/alerts' },
        { label: 'Complaints', icon: '📝', path: '/warden/complaints' },
        { label: 'Notice Board', icon: '📌', path: '/warden/notices' },
        { label: 'Daily Report', icon: '📋', path: '/warden/daily-report' },
    ],
    student: [
        { label: 'Dashboard', icon: '📊', path: '/student/dashboard' },
        { label: 'Complaints', icon: '📝', path: '/student/complaints' },
        { label: 'Notice Board', icon: '📌', path: '/student/notices' },
    ],
    dean: [
        { label: 'Dashboard', icon: '📊', path: '/dean/dashboard' },
        { label: 'Alerts', icon: '🔔', path: '/dean/alerts' },
        { label: 'Analytics', icon: '📈', path: '/dean/analytics' },
        { label: 'Notice Board', icon: '📌', path: '/dean/notices' },
        { label: 'Reports', icon: '📤', path: '/dean/reports' },
        { label: 'Audit Logs', icon: '🗃️', path: '/dean/audit-logs' },
    ],
    principal: [
        { label: 'Dashboard', icon: '📊', path: '/principal/dashboard' },
        { label: 'Analytics', icon: '📈', path: '/principal/analytics' },
        { label: 'Notice Board', icon: '📌', path: '/principal/notices' },
        { label: 'Reports', icon: '📤', path: '/principal/reports' },
    ],
}

export default function Sidebar() {
    const { user } = useContext(AuthContext);
    const role = (user?.role || '').toLowerCase();
    const navItems = NAV_CONFIG[role] || [];

    const [unreadAlerts, setUnreadAlerts] = React.useState(0);

    React.useEffect(() => {
        if (user && user.role !== ROLES.STUDENT) {
            const fetchAlerts = async () => {
                try {
                    const res = await api.get('/api/alerts');
                    if (res.data?.alerts) {
                        const count = res.data.alerts.filter(a => a.status === 'Pending').length;
                        setUnreadAlerts(count);
                    }
                } catch (e) { }
            };
            fetchAlerts();
            const interval = setInterval(fetchAlerts, 60000);
            return () => clearInterval(interval);
        }
    }, [user]);

    return (
        <div className="sidebar flex flex-col">
            {/* Logo */}
            <div className="p-6 border-b" style={{ borderColor: 'var(--border)' }}>
                <Link to="/dashboard" className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
                        <Activity size={20} />
                    </div>
                    <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                        EcoMonitor
                    </span>
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 overflow-y-auto">
                <div className="space-y-1">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                isActive ? 'nav-item nav-item-active' : 'nav-item'
                            }
                        >
                            <span className="text-xl">{item.icon}</span>
                            <span className="flex-1">{item.label}</span>
                            {item.path.endsWith('/alerts') && unreadAlerts > 0 && (
                                <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    {unreadAlerts > 99 ? '99+' : unreadAlerts}
                                </span>
                            )}
                        </NavLink>
                    ))}
                </div>
            </nav>

            {/* User Profile */}
            <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
                <NavLink
                    to="/profile"
                    className={({ isActive }) =>
                        isActive ? 'nav-item nav-item-active' : 'nav-item'
                    }
                >
                    <User size={20} />
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                            {user?.name}
                        </div>
                        <div className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                            {user?.role}
                        </div>
                    </div>
                </NavLink>
            </div>
        </div>
    );
}

