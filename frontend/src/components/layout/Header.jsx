import React, { useContext, useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { AlertCountContext } from '../../context/AlertCountContext';
import { ThemeContext } from '../../context/ThemeContext';
import { Bell, Moon, Sun, LogOut, ChevronDown } from 'lucide-react';
import NotificationBell from '../NotificationBell';
import api from '../../services/api';

export default function Header() {
    const { user, logout } = useContext(AuthContext);
    const { theme, toggleTheme } = useContext(ThemeContext);
    const alertCtx = useContext(AlertCountContext);
    const counts = alertCtx?.counts ?? { totalActive: 0, unread: 0, pending: 0, investigating: 0, reviewed: 0, escalated: 0, critical: 0 };
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [badgeVisible, setBadgeVisible] = useState(counts.unread > 0);
    const [bounce, setBounce] = useState(false);
    const prevUnread = useRef(counts.unread);

    useEffect(() => {
        setBadgeVisible(counts.unread > 0);

        if (typeof prevUnread.current === 'number' && counts.unread > prevUnread.current) {
            setBounce(true);
            const t = setTimeout(() => setBounce(false), 700);
            return () => clearTimeout(t);
        }
        prevUnread.current = counts.unread;
    }, [counts.unread]);


    return (
        <div className="header flex items-center justify-between px-6">
            {/* Breadcrumb / Page Title */}
            <div>
                <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Dashboard
                </h1>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-4">
                {/* Notification Bell */}
                <NotificationBell />

                {/* Theme Toggle */}
                <button
                    onClick={toggleTheme}
                    className="p-2 rounded-lg transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>

                {/* User Menu */}
                <div className="relative">
                    <button
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        className="flex items-center gap-2 p-2 rounded-lg transition-colors"
                        style={{ color: 'var(--text-primary)' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                        onMouseLeave={(e) => !showUserMenu && (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                        <div className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold"
                            style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
                            {user?.name?.charAt(0).toUpperCase()}
                        </div>
                        <ChevronDown size={16} />
                    </button>

                    {/* Dropdown Menu */}
                    {showUserMenu && (
                        <>
                            <div
                                className="fixed inset-0 z-10"
                                onClick={() => setShowUserMenu(false)}
                            ></div>
                            <div
                                className="absolute right-0 mt-2 w-48 rounded-lg border py-2 z-20"
                                style={{
                                    backgroundColor: 'var(--bg-card)',
                                    borderColor: 'var(--border)',
                                    boxShadow: 'var(--shadow-lg)'
                                }}
                            >
                                <Link
                                    to="/profile"
                                    className="block px-4 py-2 text-sm transition-colors"
                                    style={{ color: 'var(--text-primary)' }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    onClick={() => setShowUserMenu(false)}
                                >
                                    Profile
                                </Link>
                                <div className="my-1" style={{ borderTop: '1px solid var(--border)' }}></div>
                                <button
                                    onClick={() => {
                                        logout();
                                        setShowUserMenu(false);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors"
                                    style={{ color: 'var(--color-danger)' }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                    <LogOut size={16} />
                                    Sign Out
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
