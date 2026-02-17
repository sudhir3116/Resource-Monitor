import React, { useContext, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { ThemeContext } from '../../context/ThemeContext';
import { Bell, Moon, Sun, LogOut, ChevronDown } from 'lucide-react';
import api from '../../services/api';

export default function Header() {
    const { user, logout } = useContext(AuthContext);
    const { theme, toggleTheme } = useContext(ThemeContext);
    const [alertCount, setAlertCount] = useState(0);
    const [showUserMenu, setShowUserMenu] = useState(false);

    useEffect(() => {
        // Fetch unread alert count
        async function fetchAlertCount() {
            try {
                const response = await api.get('/api/alerts?status=unread');
                if (response.data?.alerts) {
                    setAlertCount(response.data.alerts.length);
                }
            } catch (err) {
                console.error('Failed to fetch alert count', err);
            }
        }

        if (user) {
            fetchAlertCount();
            // Refresh count every 60 seconds
            const interval = setInterval(fetchAlertCount, 60000);
            return () => clearInterval(interval);
        }
    }, [user]);

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
                {/* Alert Bell */}
                <Link
                    to="/alerts"
                    className="relative p-2 rounded-lg transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                    <Bell size={20} />
                    {alertCount > 0 && (
                        <span className="absolute top-1 right-1 h-2 w-2 rounded-full"
                            style={{ backgroundColor: 'var(--color-danger)' }}></span>
                    )}
                </Link>

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
