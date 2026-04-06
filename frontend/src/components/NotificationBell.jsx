import React, { useState, useEffect, useRef, useContext } from 'react'
import { Bell } from 'lucide-react'
import api from '../api'
import { AuthContext } from '../context/AuthContext'
import { getSocket } from '../utils/socket'

const NotificationBell = () => {
    const { user } = useContext(AuthContext)
    const [count, setCount] = useState(0)
    const [items, setItems] = useState([])
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [activeTab, setActiveTab] = useState('all')
    const dropdownRef = useRef(null)

    // ─── FETCH ALL NOTIFICATION TYPES ───────────────────────
    const fetchAllNotifications = async () => {
        if (!user) return
        try {
            setLoading(true)
            const allItems = []

            // ── 1. FETCH ACTIVE ALERTS ─────────────────────────
            try {
                const alertRes = await api.get('/api/alerts?limit=50')
                const alertData = alertRes.data
                let alerts = []

                if (Array.isArray(alertData)) {
                    alerts = alertData
                } else if (Array.isArray(alertData?.alerts)) {
                    alerts = alertData.alerts
                } else if (Array.isArray(alertData?.data)) {
                    alerts = alertData.data
                }

                const activeAlerts = alerts.filter(a => {
                    const s = (a.status || '').toUpperCase()
                    return ['OPEN', 'ACTIVE', 'PENDING',
                        'INVESTIGATING', 'ESCALATED'].includes(s)
                })

                activeAlerts.forEach(a => {
                    allItems.push({
                        _id: `alert_${a._id}`,
                        type: 'ALERT',
                        title: `${a.severity || 'Alert'} — ${a.resource || 'Resource'
                            }`,
                        message: a.message || (
                            a.usageValue && a.threshold
                                ? `Usage ${a.usageValue} exceeded limit ${a.threshold} by ${Math.round(
                                    ((a.usageValue - a.threshold) /
                                        a.threshold) * 100
                                )
                                }%`
                                : 'Resource usage exceeded threshold'
                        ),
                        severity: a.severity || 'MEDIUM',
                        status: a.status,
                        createdAt: a.createdAt,
                        link: '/alerts',
                        read: false
                    })
                })
            } catch (e) {
                console.warn('[Bell] Alerts fetch failed:', e.message)
            }

            // ── 2. FETCH OPEN COMPLAINTS ───────────────────────
            try {
                const compRes = await api.get(
                    '/api/complaints?limit=50'
                )
                const compData = compRes.data
                let complaints = []

                if (Array.isArray(compData)) {
                    complaints = compData
                } else if (Array.isArray(compData?.complaints)) {
                    complaints = compData.complaints
                } else if (Array.isArray(compData?.data)) {
                    complaints = compData.data
                }

                // Show complaints that need attention
                const openComplaints = complaints.filter(c => {
                    const s = (c.status || '').toUpperCase()
                    return ['OPEN', 'PENDING',
                        'IN_PROGRESS', 'UNDER_REVIEW',
                        'ESCALATED'].includes(s)
                })

                // Admin/GM see all open complaints
                // Student sees only own open complaints
                const filtered = user.role === 'student'
                    ? openComplaints.filter(
                        c => c.submittedBy?._id === user._id ||
                            c.user?._id === user._id
                    )
                    : openComplaints

                filtered.slice(0, 5).forEach(c => {
                    allItems.push({
                        _id: `complaint_${c._id}`,
                        type: 'COMPLAINT',
                        title: `Complaint — ${c.category || 'General'
                            }`,
                        message: c.title || c.description ||
                            'New complaint submitted',
                        severity: c.priority === 'HIGH' ||
                            c.priority === 'URGENT'
                            ? 'HIGH' : 'MEDIUM',
                        status: c.status,
                        createdAt: c.createdAt,
                        link: '/complaints',
                        read: false
                    })
                })
            } catch (e) {
                console.warn(
                    '[Bell] Complaints fetch failed:', e.message
                )
            }

            // ── 3. FETCH RECENT ANNOUNCEMENTS ─────────────────
            try {
                const annRes = await api.get(
                    '/api/announcements?limit=20'
                )
                // API returns: { success: true, data: { announcements: [...], pagination: {...} } }
                const announcements = annRes.data?.data?.announcements || []

                // Show announcements from last 7 days
                const sevenDaysAgo = Date.now() -
                    (7 * 24 * 60 * 60 * 1000)

                const recentAnn = announcements.filter(a => {
                    const created = new Date(
                        a.createdAt || 0
                    ).getTime()
                    return created > sevenDaysAgo
                })

                recentAnn.slice(0, 3).forEach(a => {
                    allItems.push({
                        _id: `ann_${a._id}`,
                        type: 'ANNOUNCEMENT',
                        title: `📢 ${a.title || 'New Announcement'}`,
                        message: a.content
                            ? a.content.substring(0, 80) +
                            (a.content.length > 80 ? '...' : '')
                            : 'New announcement posted',
                        severity: a.priority === 'URGENT' ||
                            a.priority === 'HIGH'
                            ? 'HIGH' : 'LOW',
                        status: a.priority || 'GENERAL',
                        createdAt: a.createdAt,
                        link: '/announcements',
                        read: false
                    })
                })
            } catch (e) {
                console.warn(
                    '[Bell] Announcements fetch failed:', e.message
                )
            }

            // ── 4. DAILY REPORT REMINDER (warden only) ────────
            if (user.role === 'warden') {
                try {
                    const reportRes = await api.get(
                        '/api/daily-reports?limit=1'
                    )
                    const reports = reportRes.data?.reports ||
                        reportRes.data?.data ||
                        reportRes.data || []

                    const today = new Date().toDateString()
                    const submittedToday = reports.some(r => {
                        return new Date(
                            r.date || r.createdAt
                        ).toDateString() === today
                    })

                    if (!submittedToday) {
                        allItems.push({
                            _id: 'daily_report_reminder',
                            type: 'REMINDER',
                            title: '📋 Daily Report Pending',
                            message: "You haven't submitted today's " +
                                "daily report yet",
                            severity: 'MEDIUM',
                            status: 'PENDING',
                            createdAt: new Date().toISOString(),
                            link: '/warden/daily-report',
                            read: false
                        })
                    }
                } catch (e) {
                    console.warn(
                        '[Bell] Daily report check failed:', e.message
                    )
                }
            }

            // ── SORT by most recent first ──────────────────────
            allItems.sort((a, b) =>
                new Date(b.createdAt || 0) -
                new Date(a.createdAt || 0)
            )

            console.log('[Bell] Total notifications:',
                allItems.length,
                allItems.map(i => i.type)
            )

            setItems(allItems)
            setCount(allItems.length)

        } catch (err) {
            console.error('[Bell] Fatal error:', err)
        } finally {
            setLoading(false)
        }
    }

    // ─── TIME FORMATTER ──────────────────────────────────
    const formatTime = (dateStr) => {
        if (!dateStr) return '—'
        try {
            const date = new Date(dateStr)
            if (isNaN(date.getTime())) return '—'
            return date.toLocaleString('en-IN', {
                day: '2-digit', month: 'short',
                year: 'numeric', hour: '2-digit',
                minute: '2-digit', hour12: true
            })
        } catch { return '—' }
    }

    // ─── ICON AND COLOR PER TYPE ─────────────────────────
    const getTypeStyle = (item) => {
        switch (item.type) {
            case 'ALERT':
                return {
                    dot: item.severity === 'CRITICAL'
                        ? 'bg-red-500'
                        : item.severity === 'HIGH'
                            ? 'bg-orange-500' : 'bg-yellow-500',
                    badge: item.severity === 'CRITICAL'
                        ? 'bg-red-900/40 text-red-400 border-red-800/50'
                        : item.severity === 'HIGH'
                            ? 'bg-orange-900/40 text-orange-400 border-orange-800/50'
                            : 'bg-yellow-900/40 text-yellow-400 border-yellow-800/50',
                    icon: '🔔',
                    label: item.severity || 'ALERT'
                }
            case 'COMPLAINT':
                return {
                    dot: 'bg-blue-500',
                    badge: 'bg-blue-900/40 text-blue-400 border-blue-800/50',
                    icon: '📝',
                    label: item.status || 'COMPLAINT'
                }
            case 'ANNOUNCEMENT':
                return {
                    dot: 'bg-purple-500',
                    badge: 'bg-purple-900/40 text-purple-400 border-purple-800/50',
                    icon: '📢',
                    label: 'NEW'
                }
            case 'REMINDER':
                return {
                    dot: 'bg-green-500',
                    badge: 'bg-green-900/40 text-green-400 border-green-800/50',
                    icon: '📋',
                    label: 'REMINDER'
                }
            default:
                return {
                    dot: 'bg-gray-500',
                    badge: 'bg-gray-700 text-gray-400 border-gray-600',
                    icon: '•',
                    label: 'INFO'
                }
        }
    }

    // ─── FILTER ITEMS BY TAB ─────────────────────────────
    const filteredItems = activeTab === 'all'
        ? items
        : items.filter(i =>
            i.type === activeTab.toUpperCase()
        )

    const tabCount = (type) =>
        type === 'all'
            ? items.length
            : items.filter(
                i => i.type === type.toUpperCase()
            ).length

    // ─── AUTO FETCH ──────────────────────────────────────
    useEffect(() => {
        if (!user) return
        fetchAllNotifications()

        // Socket real-time sync (Requirement Part 7)
        const socket = (typeof getSocket === 'function') ? getSocket() : null;
        if (socket) {
            socket.on('alerts:refresh', fetchAllNotifications);
            socket.on('usage:refresh', fetchAllNotifications);
            socket.on('dashboard:refresh', fetchAllNotifications);
        }

        const interval = setInterval(
            fetchAllNotifications, 30000
        )
        return () => {
            clearInterval(interval);
            if (socket) {
                socket.off('alerts:refresh', fetchAllNotifications);
                socket.off('usage:refresh', fetchAllNotifications);
                socket.off('dashboard:refresh', fetchAllNotifications);
            }
        }
    }, [user])

    // ─── CLOSE ON OUTSIDE CLICK ──────────────────────────
    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current &&
                !dropdownRef.current.contains(e.target)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener(
            'mousedown', handler
        )
    }, [])

    // ─── RENDER ──────────────────────────────────────────
    return (
        <div className="relative" ref={dropdownRef}>

            {/* Bell Button */}
            <button
                onClick={() => {
                    setOpen(p => !p)
                    if (!open) fetchAllNotifications()
                }}
                className="relative p-2 rounded-lg
                   hover:bg-gray-800 transition-colors
                   focus:outline-none"
                aria-label={`${count} notifications`}
            >
                <Bell className={`w-5 h-5 ${count > 0 ? 'text-yellow-400' : 'text-gray-400'
                    }`} />

                {count > 0 && (
                    <span className="absolute -top-0.5 -right-0.5
                           min-w-[18px] h-[18px]
                           bg-red-500 text-white
                           text-[10px] font-bold
                           rounded-full flex items-center
                           justify-center px-1
                           border-2 border-gray-950">
                        {count > 99 ? '99+' : count}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute right-0 top-11 w-96
                        bg-gray-900 rounded-xl shadow-2xl
                        border border-gray-700 z-[100]
                        max-h-[36rem] flex flex-col">

                    {/* Header */}
                    <div className="flex items-center justify-between
                          px-4 py-3 border-b border-gray-700
                          flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-white text-sm">
                                Notifications
                            </h3>
                            {count > 0 && (
                                <span className="text-xs bg-red-500/20
                                 text-red-400 px-2 py-0.5
                                 rounded-full font-medium
                                 border border-red-500/30">
                                    {count} new
                                </span>
                            )}
                        </div>
                        <button
                            onClick={fetchAllNotifications}
                            disabled={loading}
                            className="text-xs text-gray-400
                         hover:text-white transition-colors
                         disabled:opacity-50"
                        >
                            {loading ? '...' : '↻ Refresh'}
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-gray-700 flex-shrink-0 px-2 pt-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                        {[
                            { key: 'all', label: 'All' },
                            { key: 'alert', label: '🔔 Alerts' },
                            { key: 'complaint', label: '📝 Complaints' },
                            { key: 'announcement', label: '📢 Notices' },
                        ].map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`px-3 py-2 text-xs font-medium
                            border-b-2 transition-colors
                            whitespace-nowrap
                  ${activeTab === tab.key
                                        ? 'border-blue-500 text-blue-400'
                                        : 'border-transparent text-gray-500 hover:text-gray-300'
                                    }`}
                            >
                                {tab.label}
                                {tabCount(tab.key) > 0 && (
                                    <span className="ml-1 text-[10px]
                                   bg-gray-700 text-gray-300
                                   px-1.5 py-0.5 rounded-full">
                                        {tabCount(tab.key)}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Items */}
                    <div className="overflow-y-auto flex-1">
                        {loading && filteredItems.length === 0 ? (
                            <div className="px-4 py-8 text-center">
                                <div className="w-6 h-6 border-2
                                border-gray-600
                                border-t-blue-500
                                rounded-full animate-spin
                                mx-auto" />
                                <p className="text-gray-500 text-xs mt-2">
                                    Loading...
                                </p>
                            </div>
                        ) : filteredItems.length === 0 ? (
                            <div className="px-4 py-10 text-center">
                                <Bell className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                                <p className="text-gray-400 text-sm">
                                    No notifications
                                </p>
                                <p className="text-gray-600 text-xs mt-1">
                                    You are all caught up ✓
                                </p>
                            </div>
                        ) : (
                            filteredItems.map((item, i) => {
                                const style = getTypeStyle(item)
                                return (
                                    <a
                                        key={item._id || i}
                                        href={item.link || '/dashboard'}
                                        onClick={() => setOpen(false)}
                                        className="flex items-start gap-3
                               px-4 py-3
                               hover:bg-gray-800/70
                               border-b border-gray-800/60
                               transition-colors cursor-pointer"
                                    >
                                        {/* Type icon */}
                                        <div className="flex-shrink-0 mt-0.5">
                                            <div className={`w-7 h-7 rounded-lg
                                       flex items-center
                                       justify-center text-sm
                        ${item.type === 'ALERT'
                                                    ? 'bg-red-900/30'
                                                    : item.type === 'COMPLAINT'
                                                        ? 'bg-blue-900/30'
                                                        : item.type === 'ANNOUNCEMENT'
                                                            ? 'bg-purple-900/30'
                                                            : 'bg-green-900/30'
                                                }`}>
                                                {style.icon}
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start
                                      justify-between gap-2">
                                                <p className="text-sm font-medium
                                       text-white leading-snug">
                                                    {item.title}
                                                </p>
                                                <span className={`text-[10px] px-1.5
                                          py-0.5 rounded
                                          font-medium border
                                          flex-shrink-0
                                          ${style.badge}`}>
                                                    {style.label}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-400
                                     mt-0.5 line-clamp-2
                                     leading-relaxed">
                                                {item.message}
                                            </p>
                                            <p className="text-[11px] text-gray-500
                                     mt-1 font-mono">
                                                🕒 {formatTime(item.createdAt)}
                                            </p>
                                        </div>
                                    </a>
                                )
                            })
                        )}
                    </div>

                    {/* Footer */}
                    {items.length > 0 && (
                        <div className="px-4 py-2.5 border-t
                            border-gray-700 flex-shrink-0
                            flex items-center
                            justify-between">
                            <span className="text-xs text-gray-500">
                                {items.length} total notification
                                {items.length !== 1 ? 's' : ''}
                            </span>
                            <button
                                onClick={() => {
                                    setOpen(false)
                                    setActiveTab('all')
                                }}
                                className="text-xs text-gray-500 
                   hover:text-gray-300 transition-colors"
                            >
                                Close ✕
                            </button>
                        </div>
                    )}

                </div>
            )}
        </div>
    )
}

export default NotificationBell
