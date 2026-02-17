import React, { useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { ROLES } from '../../utils/roles';
import {
    LayoutDashboard,
    Activity,
    BarChart3,
    AlertTriangle,
    FileText,
    Users,
    Settings,
    User
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
            roles: [ROLES.STUDENT, ROLES.WARDEN, ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN]
        },
        {
            label: 'Resources',
            icon: Activity,
            path: '/resources',
            roles: [ROLES.STUDENT, ROLES.WARDEN, ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN]
        },
        {
            label: 'Analytics',
            icon: BarChart3,
            path: '/analytics',
            roles: [ROLES.STUDENT, ROLES.WARDEN, ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN]
        },
        {
            label: 'Alerts',
            icon: AlertTriangle,
            path: '/alerts',
            roles: [ROLES.STUDENT, ROLES.WARDEN, ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN]
        },
        {
            label: 'Reports',
            icon: FileText,
            path: '/reports',
            roles: [ROLES.WARDEN, ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN]
        },
        {
            label: 'Users',
            icon: Users,
            path: '/users',
            roles: [ROLES.ADMIN]
        },
        {
            label: 'Settings',
            icon: Settings,
            path: '/settings',
            roles: [ROLES.ADMIN]
        }
    ];

    const visibleItems = navItems.filter(item =>
        user && item.roles.includes(user.role)
    );

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
                                <span>{item.label}</span>
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
