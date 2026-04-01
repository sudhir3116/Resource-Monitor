import React, { useContext, useEffect, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { ROLES } from '../../utils/roles';
import api from '../../services/api';
import { Activity, User, Bell, ChevronRight } from 'lucide-react';

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
        { label: 'Complaints', icon: '📝', path: '/dean/complaints' },
        { label: 'Analytics', icon: '📈', path: '/dean/analytics' },
        { label: 'Reports', icon: '📤', path: '/dean/reports' },
        { label: 'Announcements', icon: '📌', path: '/dean/announcements' },
    ],
    principal: [
        { label: 'Dashboard', icon: '📊', path: '/principal/dashboard' },
        { label: 'Analytics', icon: '📈', path: '/principal/analytics' },
        { label: 'Reports', icon: '📤', path: '/principal/reports' },
        { label: 'Announcements', icon: '📌', path: '/principal/announcements' },
    ]
}

export default function Sidebar() {
    const { user } = useContext(AuthContext);
    const role = (user?.role || '').toLowerCase();
    const navItems = NAV_CONFIG[role] || [];
    const [unreadAlerts, setUnreadAlerts] = useState(0);

    useEffect(() => {
        if (user && user.role !== ROLES.STUDENT) {
            const fetchAlerts = async () => {
                try {
                    const res = await api.get('/api/alerts/count');
                    if (res.data?.counts) {
                        setUnreadAlerts(res.data.counts.pending || 0);
                    }
                } catch (e) { }
            };
            fetchAlerts();
            const interval = setInterval(fetchAlerts, 60000);
            return () => clearInterval(interval);
        }
    }, [user]);

    return (
        <aside className="sidebar flex flex-col h-full">
            {/* Brand Logo Container */}
            <div className="p-6 border-b border-[var(--border-color)]">
                <Link to="/dashboard" className="flex items-center gap-3 group">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-[var(--accent)] text-white shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
                        <Activity size={24} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-base font-black tracking-tight text-primary leading-none" style={{ whiteSpace: 'nowrap' }}>EcoMonitor</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-secondary opacity-60" style={{ whiteSpace: 'nowrap' }}>Control Center</span>
                    </div>
                </Link>
            </div>

            {/* Navigation Section */}
            <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `flex items-center gap-3 py-2 px-3 rounded-lg transition-all text-sm font-medium group ${isActive
                                ? 'bg-blue-500/10 text-blue-400'
                                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]'
                            }`
                        }
                    >
                        <span className="text-lg opacity-80">{item.icon}</span>
                        <span className="flex-1">{item.label}</span>

                        {item.path.endsWith('/alerts') && unreadAlerts > 0 && (
                            <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                                {unreadAlerts > 99 ? '99+' : unreadAlerts}
                            </span>
                        )}
                        <ChevronRight size={14} className="opacity-0 group-hover:opacity-40 transition-opacity ml-auto" />
                    </NavLink>
                ))}
            </nav>

            {/* User Account / Settings */}
            <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-muted)]/30">
                <NavLink
                    to="/profile"
                    className={({ isActive }) =>
                        `nav-item group ${isActive ? 'active' : ''} !mx-0`
                    }
                >
                    <div className="h-9 w-9 rounded-full bg-white dark:bg-slate-800 border-2 border-blue-500/20 flex items-center justify-center flex-shrink-0 text-blue-500 shadow-sm overflow-hidden">
                        {user?.avatarURL ? <img src={user.avatarURL} alt="avatar" /> : <User size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-primary truncate leading-tight">
                            {user?.name}
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-secondary opacity-60">
                            {user?.role} Settings
                        </div>
                    </div>
                </NavLink>
            </div>
        </aside>
    );
}
