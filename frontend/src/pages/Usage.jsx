import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { AuthContext } from '../context/AuthContext';
import { useResources } from '../hooks/useResources';
import {
    Zap,
    Droplets,
    Flame,
    Wind,
    Trash2,
    Sun,
    Search,
    Plus,
    ArrowRight,
    Activity,
    TrendingUp,
    AlertTriangle,
    RefreshCw
} from 'lucide-react';
import { getSocket } from '../utils/socket';
import { logger } from '../utils/logger';
import Badge from '../components/common/Badge';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import TableSkeleton from '../components/common/TableSkeleton';
import SortIcon from '../components/common/SortIcon';
import useSortableTable from '../hooks/useSortableTable';
import timeAgo from '../utils/timeAgo';
import { Download, Edit2 } from 'lucide-react';
import { exportToCSV } from '../utils/export';
import { ROLES } from '../utils/roles';
import { ConfirmModal } from '../components/common/Modal';
import { useToast } from '../context/ToastContext';

// Dynamic resource metadata is now fetched via useResources hook and Managed in Admin Panel.


export default function Resources() {
    const [stats, setStats] = useState(null);
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [usages, setUsages] = useState([]);
    const [sortMode] = useState('newest');
    const [deleteId, setDeleteId] = useState(null);
    const [deleteItem, setDeleteItem] = useState(null);
    const [generatingAI, setGeneratingAI] = useState(false);

    const navigate = useNavigate();
    const { user } = useContext(AuthContext);
    const { addToast } = useToast();
    const { resources: activeResources } = useResources();

    const canEdit = user && [ROLES.WARDEN].includes(user.role);
    const canDelete = user && [ROLES.ADMIN].includes(user.role);
    const showActions = canEdit || canDelete;

    const fetchAllData = async () => {
        try {
            const [summaryRes, alertsRes, usagesRes] = await Promise.allSettled([
                api.get('/api/usage/summary'),
                api.get('/api/alerts?status=pending,investigating,escalated'),
                api.get('/api/usage?limit=50')
            ]);

            // Summary — always update regardless of other failures
            if (summaryRes.status === 'fulfilled') {
                const summary = summaryRes.value.data?.data?.summary || summaryRes.value.data?.summary || {};
                const statsObj = {};
                Object.entries(summary).forEach(([name, data]) => {
                    statsObj[name] = {
                        current: data.total || 0,
                        unit: data.unit || 'units',
                        cost: data.totalCost || 0,
                        monthlyLimit: data.monthlyLimit || 1000
                    };
                });
                setStats(statsObj);
            }

            // Alerts
            if (alertsRes.status === 'fulfilled') {
                setAlerts(alertsRes.value.data?.alerts || alertsRes.value.data?.data || []);
            }

            // Usage list
            if (usagesRes.status === 'fulfilled') {
                const arr = usagesRes.value.data?.data || usagesRes.value.data?.usages || (Array.isArray(usagesRes.value.data) ? usagesRes.value.data : []);
                setUsages(Array.isArray(arr) ? arr : []);
            } else {
                logger.error('Failed to fetch usage list', usagesRes.reason);
            }
        } catch (err) {
            logger.error('Failed to fetch resource stats', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();

        // Real-time synchronization
        const socket = getSocket();
        const refresh = () => fetchAllData();

        if (socket) {
            socket.on('usage:refresh', refresh);
            socket.on('usage:added', refresh);
        }

        window.addEventListener('usage:added', refresh);

        return () => {
            if (socket) {
                socket.off('usage:refresh', refresh);
                socket.off('usage:added', refresh);
            }
            window.removeEventListener('usage:added', refresh);
        };
    }, []);

    // Helper to render icon/emoji from DB
    const renderIcon = (icon) => {
        if (!icon) return <Activity size={24} />;
        if (typeof icon === 'string' && icon.length < 5) return <span className="text-2xl leading-none">{icon}</span>;
        return <Activity size={24} />; // Default generic icon
    };

    // ── Build resources with metadata merged for display, filtering only active
    const resources = useMemo(() => {
        return (Array.isArray(activeResources) ? activeResources : [])
            .map(res => ({
                id: res?._id,
                name: res?.name,
                icon: renderIcon(res?.icon),
                color: res?.color || '#64748b',
                bg: (res?.color || '#64748b') + '15', // light transparency
                unit: res?.unit || 'units',
                description: res?.description || 'Real-time resource monitoring'
            }))
            .filter(res =>
                res.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                res.description.toLowerCase().includes(searchTerm.toLowerCase())
            ) || [];
    }, [activeResources, searchTerm]);

    const filteredUsages = useMemo(() => {
        return usages.filter(u => {
            const matchesSearch = (u.userId?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (u.notes || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (u.resource_type || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (u.blockId?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
            return matchesSearch;
        });
    }, [usages, searchTerm]);

    const { sortedData: finalUsages, sortField, sortDirection, handleSort } = useSortableTable(
        filteredUsages,
        'usage_date',
        [searchTerm]
    );

    const handleExport = () => {
        if (finalUsages.length === 0) {
            addToast('No records to export', 'warning');
            return;
        }
        const dataToExport = finalUsages.map(u => ({
            Resource: u.resource_type,
            Value: u.usage_value,
            Unit: u.unit || 'units',
            Location: u.blockId?.name || 'N/A',
            Date: new Date(u.usage_date).toLocaleString(),
            LoggedBy: u.createdBy?.name || 'N/A',
            Notes: u.notes || ''
        }));
        exportToCSV(dataToExport, `usage_records_${new Date().toISOString().split('T')[0]}.csv`);
        addToast('Usage data exported');
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await api.delete(`/api/usage/${deleteId}`);
            await fetchAllData();
            addToast('Record deleted successfully');
        } catch (err) {
            addToast(err.response?.data?.message || 'Failed to delete record', 'error');
        } finally {
            setDeleteId(null);
            setDeleteItem(null);
        }
    };

    const handleGenerateAI = async () => {
        setGeneratingAI(true);
        try {
            const res = await api.post('/api/usage/ai-generate');
            addToast(res.data.message || 'AI generated usage successfully', 'success');
            await fetchAllData();
        } catch (err) {
            addToast(err.response?.data?.message || 'Failed to generate AI usage', 'error');
        } finally {
            setGeneratingAI(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-[var(--text-primary)]">Resource Log Center</h1>
                    <p className="text-[var(--text-secondary)] text-sm font-medium">Detailed consumption records and historical history tracking</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search everything..."
                            className="input pl-10 w-full"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button variant="secondary" size="sm" onClick={handleExport} disabled={loading || finalUsages.length === 0}>
                        <Download size={16} />
                    </Button>
                    <button
                        onClick={fetchAllData}
                        className="p-2.5 rounded-xl bg-[var(--bg-muted)] hover:bg-[var(--bg-secondary)] border border-[var(--border-color)] transition-all shadow-sm group flex items-center justify-center h-[38px]"
                        title="Refresh Data"
                    >
                        <RefreshCw size={18} className={`${loading ? 'animate-spin' : ''} text-[var(--text-secondary)] group-hover:text-blue-500 transition-colors`} />
                    </button>
                    {canEdit && (
                        <Button variant="primary" size="sm" onClick={() => navigate('/warden/usage/new')}>
                            <Plus size={16} className="mr-2" /> Log Usage
                        </Button>
                    )}
                    {showActions && (
                        <Button variant="secondary" size="sm" onClick={handleGenerateAI} disabled={generatingAI || loading}>
                            <Zap size={16} className={`mr-2 ${generatingAI ? 'animate-pulse text-blue-500' : 'text-blue-500'}`} />
                            {generatingAI ? 'Generating...' : 'Generate AI Usage'}
                        </Button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="py-20 text-center text-slate-500">Loading resources...</div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <Card>
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">📊</span>
                                <div>
                                    <div className="text-xs text-slate-400 font-bold uppercase">Today’s Total Usage</div>
                                    <div className="text-xl font-black">{Object.values(stats || {}).reduce((acc, s) => acc + (s.current || 0), 0).toLocaleString()}</div>
                                </div>
                            </div>
                        </Card>
                        <Card>
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">💸</span>
                                <div>
                                    <div className="text-xs text-slate-400 font-bold uppercase">Today’s Total Cost</div>
                                    <div className="text-xl font-black">₹{Object.values(stats || {}).reduce((acc, s) => acc + (s.cost || 0), 0).toLocaleString()}</div>
                                </div>
                            </div>
                        </Card>
                        <Card>
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">🚨</span>
                                <div>
                                    <div className="text-xs text-slate-400 font-bold uppercase">Active Alerts</div>
                                    <div className="text-xl font-black">{alerts?.length || 0}</div>
                                </div>
                            </div>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-10">
                        {resources.map(res => {
                            // Corrected lookup: ensure case-insensitive matching for summary metrics
                            const stat = Object.entries(stats || {}).find(([k]) => k.toLowerCase() === res.name.toLowerCase())?.[1] || { current: 0, unit: res.unit, cost: 0 };
                            const usage = stat.current || 0;
                            const limit = stat.monthlyLimit || 1000;
                            const percentage = (usage / limit) * 100;

                            const statusColor = percentage > 100 ? 'text-rose-600'
                                : percentage > 80 ? 'text-amber-500'
                                    : 'text-emerald-500';

                            const statusBg = percentage > 100 ? 'bg-rose-50'
                                : percentage > 80 ? 'bg-amber-50'
                                    : 'bg-emerald-50';

                            return (
                                <Card key={res.id} className="hover:shadow-xl transition-all duration-300 border-t-[3px] border-blue-600 group flex flex-col h-full">
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="p-2.5 rounded-xl shadow-sm group-hover:scale-110 transition-transform flex items-center justify-center text-lg" style={{ backgroundColor: res.bg, color: res.color }}>
                                            {res.icon}
                                        </div>
                                        <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest ${statusBg} ${statusColor}`}>
                                            {percentage > 100 ? 'High' : percentage > 80 ? 'Medium' : 'Optimal'}
                                        </span>
                                    </div>

                                    <h3 className="text-lg font-bold mb-1 tracking-tight" style={{ color: 'var(--text-primary)' }}>{res.name}</h3>
                                    <p className="text-xs text-[var(--text-secondary)] mb-5 font-medium leading-relaxed line-clamp-2">
                                        {res.description}
                                    </p>

                                    <div className="grid grid-cols-2 gap-4 border-t border-[var(--border-color)] pt-4 mt-auto">
                                        <div className="space-y-0.5">
                                            <p className="text-[9px] text-[var(--text-secondary)] uppercase font-bold tracking-widest opacity-80">Total Consumption</p>
                                            <div className="flex items-baseline gap-1">
                                                <span className={`text-xl font-black tracking-tight ${statusColor}`}>
                                                    {usage.toLocaleString()}
                                                </span>
                                                <span className="text-[10px] font-bold text-[var(--text-secondary)] capitalize opacity-70">{stat.unit || res.unit}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-0.5 text-right">
                                            <p className="text-[9px] text-[var(--text-secondary)] uppercase font-bold tracking-widest opacity-80">Accrued Cost</p>
                                            <div className="text-lg font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
                                                ₹{Math.round(stat.cost || 0).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-5">
                                        <Button
                                            variant="secondary"
                                            className="w-full justify-center !min-h-[36px] !py-0 text-xs font-semibold shadow-sm group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-colors"
                                            onClick={() => {
                                                setSearchTerm(res.name);
                                            }}
                                        >
                                            View Details
                                            <ArrowRight size={14} className="ml-1.5 opacity-80 group-hover:translate-x-1 transition-transform" />
                                        </Button>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>

                    <div className="mt-12">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <TrendingUp size={20} className="text-blue-500" /> Recent Usage Activity
                            </h2>
                        </div>

                        <Card flush>
                            {loading && usages.length === 0 ? (
                                <TableSkeleton rows={5} columns={5} />
                            ) : finalUsages.length === 0 ? (
                                <div className="py-12">
                                    <EmptyState title="No Records Found" description="Try searching for a different resource or location." />
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th onClick={() => handleSort('resource_type')} className="cursor-pointer">
                                                    Resource <SortIcon field="resource_type" sortField={sortField} sortDirection={sortDirection} />
                                                </th>
                                                <th onClick={() => handleSort('blockId.name')} className="cursor-pointer">
                                                    Location <SortIcon field="blockId.name" sortField={sortField} sortDirection={sortDirection} />
                                                </th>
                                                <th onClick={() => handleSort('usage_value')} className="cursor-pointer">
                                                    Consumption <SortIcon field="usage_value" sortField={sortField} sortDirection={sortDirection} />
                                                </th>
                                                <th onClick={() => handleSort('usage_date')} className="cursor-pointer">
                                                    Recorded <SortIcon field="usage_date" sortField={sortField} sortDirection={sortDirection} />
                                                </th>
                                                {showActions && <th>Action</th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {finalUsages.map(u => (
                                                <tr key={u._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                                                    <td className="font-bold">{u.resource_type}</td>
                                                    <td>{u.blockId?.name || 'N/A'}</td>
                                                    <td>
                                                        {u.usage_value.toLocaleString()} <span className="text-[10px] text-slate-400">{u.unit}</span>
                                                    </td>
                                                    <td className="text-sm">{timeAgo(u.usage_date)}</td>
                                                    {showActions && (
                                                        <td className="text-right">
                                                            <div className="flex justify-end gap-1">
                                                                {canEdit && (
                                                                    <Button size="sm" variant="secondary" className="!p-1.5" onClick={() => {
                                                                        const rolePath = user?.role === 'warden' ? 'warden' : user?.role === 'admin' ? 'admin' : '';
                                                                        const path = rolePath ? `/${rolePath}/usage/${u._id}/edit` : `/usage/${u._id}/edit`;
                                                                        navigate(path);
                                                                    }}>
                                                                        <Edit2 size={13} />
                                                                    </Button>
                                                                )}
                                                                {canDelete && (
                                                                    <Button size="sm" variant="danger" className="!p-1.5" onClick={() => { setDeleteItem(u); setDeleteId(u._id); }}>
                                                                        <Trash2 size={13} />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Card>
                    </div>
                </>
            )}

            <ConfirmModal
                isOpen={!!deleteId}
                onClose={() => { setDeleteId(null); setDeleteItem(null); }}
                onConfirm={handleDelete}
                title="Delete Usage Record"
                message={deleteItem ? `Delete this ${deleteItem.resource_type} record?` : "Confirm delete?"}
            />
        </div>
    );
}
