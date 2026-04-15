import React, { useContext, useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { AlertCountContext } from '../../context/AlertCountContext';
import { ThemeContext } from '../../context/ThemeContext';
import { Bell, Moon, Sun, LogOut, ChevronDown, User, Settings, ShieldCheck } from 'lucide-react';
import NotificationBell from '../NotificationBell';
import ThemeToggle from '../ThemeToggle';

export default function Header() {
    const { user, logout } = useContext(AuthContext);
    const location = useLocation();
    const alertCtx = useContext(AlertCountContext);
    const counts = alertCtx?.counts ?? { totalActive: 0, unread: 0, pending: 0, investigating: 0, reviewed: 0, escalated: 0, critical: 0 };
    const [showUserMenu, setShowUserMenu] = useState(false);

    // Get page title from path
    const getPageTitle = (pathname) => {
        const parts = pathname.split('/').filter(p => p);
        if (parts.length === 0) return 'Dashboard';
        const lastPart = parts[parts.length - 1];
        return lastPart.charAt(0).toUpperCase() + lastPart.slice(1).replace(/-/g, ' ');
    };

    return (
        <header className="header flex items-center justify-between px-8 border-b border-[var(--border-color)]">
            {/* Dynamic Page Header Title */}
            <div className="flex items-center gap-4">
                <div className="h-8 w-1 bg-blue-500 rounded-full animate-pulse-slow"></div>
                <h1 className="text-xl font-black text-[var(--text-primary)] tracking-tight">
                    {getPageTitle(location.pathname)}
                </h1>
            </div>

            {/* Right Side Actions - Standard Polished SaaS Tools */}
            <div className="flex items-center gap-3">

                {/* Theme Toggle */}
                <ThemeToggle />

                {/* Notification Center — single bell */}
                <NotificationBell />

                {/* Vertical Divider */}
                <div className="h-6 w-px bg-[var(--border-color)] mx-1"></div>

                {/* User Dropdown Profile Menu */}
                <div className="relative">
                    <button
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        className={`flex items-center gap-3 p-1.5 pr-3 rounded-2xl transition-all border ${showUserMenu ? 'bg-[var(--bg-muted)] border-blue-500/20' : 'border-transparent hover:bg-[var(--bg-muted)]'}`}
                    >
                        <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black shadow-md shadow-blue-500/20">
                            {user?.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="hidden md:block text-left">
                            <p className="text-xs font-black text-primary leading-none mb-0.5">{user?.name}</p>
                            <p className="text-[10px] uppercase font-bold text-secondary opacity-60 tracking-widest">{user?.role}</p>
                        </div>
                        <ChevronDown size={14} className={`text-secondary transition-transform duration-300 ${showUserMenu ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Popover Menu (SaaS Standard) */}
                    {showUserMenu && (
                        <>
                            <div className="fixed inset-0 z-[60]" onClick={() => setShowUserMenu(false)}></div>
                            <div className="absolute right-0 mt-3 w-64 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-2xl z-[70] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                                {/* User Info Summary */}
                                <div className="p-5 bg-[var(--bg-muted)]/30 border-b border-[var(--border-color)]">
                                    <div className="flex items-center gap-3">
                                        <div className="h-12 w-12 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-black text-xl">
                                            {user?.name?.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-black text-primary truncate">{user?.name}</p>
                                            <p className="text-xs font-medium text-secondary truncate">{user?.email}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Menu Items */}
                                <div className="p-2">
                                    <Link
                                        to="/profile"
                                        onClick={() => setShowUserMenu(false)}
                                        className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-secondary hover:text-primary hover:bg-[var(--bg-muted)] rounded-xl transition-colors"
                                    >
                                        <User size={18} /> Profile Settings
                                    </Link>
                                </div>

                                {/* Logout Action */}
                                <div className="p-2 border-t border-[var(--border-color)]">
                                    <button
                                        onClick={() => {
                                            logout();
                                            setShowUserMenu(false);
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                                    >
                                        <LogOut size={18} /> Sign Out Account
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}
