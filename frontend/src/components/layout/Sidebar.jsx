import React, { useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { ROLES } from '../../utils/roles';
import api from '../../services/api';
import {
    LayoutDashboard,
    Activity,
    BarChart3,
    AlertTriangle,
    Users,
    User,
    MessageSquare,
    SlidersHorizontal,
    ScrollText,
    Building2,
    Database,
    Megaphone,
    FileText,
    TrendingUp,
    ClipboardList
} from 'lucide-react';

export default function Sidebar() {
    const { user } = useContext(AuthContext);
    const location = useLocation();

    const isActive = (path) => {
        return location.pathname === path || location.pathname.startsWith(path + '/');
    };

    // Role-based navigation
    const navItems = [
        {
            label: 'Dashboard',
            icon: LayoutDashboard,
            path: '/dashboard',
            roles: [ROLES.STUDENT, ROLES.WARDEN, ROLES.DEAN, ROLES.GM, ROLES.ADMIN]
        },
        {
            label: 'Usage',
            icon: Activity,
            path: '/usage',
            roles: [ROLES.WARDEN, ROLES.DEAN, ROLES.GM, ROLES.ADMIN]
        },
        {
            label: 'Analytics',
            icon: BarChart3,
            path: '/analytics',
            roles: [ROLES.WARDEN, ROLES.DEAN, ROLES.GM, ROLES.ADMIN]
        },
        {
            label: 'Alerts',
            icon: AlertTriangle,
            path: '/alerts',
            roles: [ROLES.WARDEN, ROLES.DEAN, ROLES.GM, ROLES.ADMIN]
        },
        {
            label: 'Complaints',
            icon: MessageSquare,
            path: '/complaints',
            roles: [ROLES.STUDENT, ROLES.WARDEN, ROLES.DEAN, ROLES.GM, ROLES.ADMIN]
        },
        {
            label: 'Notice Board',
            icon: Megaphone,
            path: '/announcements',
            roles: [ROLES.STUDENT, ROLES.WARDEN, ROLES.DEAN, ROLES.GM, ROLES.ADMIN]
        },
        {
            label: 'Daily Report',
            icon: ClipboardList,
            path: '/warden/daily-report',
            roles: [ROLES.WARDEN]
        },
        {
            label: 'Executive Summary',
            icon: TrendingUp,
            path: '/dean/dashboard',
            roles: [ROLES.DEAN, ROLES.ADMIN, ROLES.GM]
        },
        {
            label: 'Resource Config',
            icon: SlidersHorizontal,
            path: '/resource-config',
            roles: [ROLES.ADMIN]
        },
        {
            label: 'Users',
            icon: Users,
            path: '/users',
            roles: [ROLES.ADMIN]
        },
        {
            label: 'Blocks',
            icon: Building2,
            path: '/blocks',
            roles: [ROLES.ADMIN]
        },
        {
            label: 'Audit Logs',
            icon: ScrollText,
            path: '/audit-logs',
            roles: [ROLES.ADMIN, ROLES.WARDEN, ROLES.DEAN, ROLES.GM]
        },
        {
            label: 'Reports',
            icon: FileText,
            path: '/reports',
            roles: [ROLES.ADMIN, ROLES.GM, ROLES.DEAN]
        },
        {
            label: 'Database Viewer',
            icon: Database,
            path: '/admin/database',
            roles: [ROLES.ADMIN]
        }
    ];

    const visibleItems = navItems.filter(item =>
        user && item.roles.includes(user.role)
    );

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
            <nav className="flex-1 p-4">
                <div className="space-y-1">
                    {visibleItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.path);

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`nav-item ${active ? 'active' : ''}`}
                            >
                                <Icon size={20} />
                                <span className="flex-1">{item.label}</span>
                                {item.path === '/alerts' && unreadAlerts > 0 && (
                                    <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                        {unreadAlerts > 99 ? '99+' : unreadAlerts}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </div>
            </nav>

            {/* User Profile */}
            <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
                <Link to="/profile" className="nav-item">
                    <User size={20} />
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                            {user?.name}
                        </div>
                        <div className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                            {user?.role}
                        </div>
                    </div>
                </Link>
            </div>
        </div>
    );
}
