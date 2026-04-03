import React, { useState, useEffect, useCallback, useMemo, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import {
    Search,
    Download,
    RefreshCw,
    ArrowLeft,
    Filter,
    Calendar,
    Activity,
    Trash2,
    Edit2
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { logger } from '../utils/logger';
import { exportToCSV } from '../utils/export';
import { ROLES } from '../utils/roles';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import TableSkeleton from '../components/common/TableSkeleton';
import SortIcon from '../components/common/SortIcon';
import useSortableTable from '../hooks/useSortableTable';
import timeAgo from '../utils/timeAgo';
import { ConfirmModal } from '../components/common/Modal';

/**
 * @desc Full usage history view with advanced filtering and search
 */
export default function UsageList() {
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);
    const { addToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [usages, setUsages] = useState([]);
    const [blocks, setBlocks] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({
        resource: 'All',
        block: 'All',
        date: ''
    });

    const [deleteId, setDeleteId] = useState(null);
    const [deleteItem, setDeleteItem] = useState(null);

    const canEdit = user && [ROLES.WARDEN].includes(user.role);
    const canDelete = user && [ROLES.ADMIN].includes(user.role);
    const showActions = canEdit || canDelete;

    const fetchMeta = useCallback(async () => {
        try {
            const res = await api.get('/api/admin/blocks');
            setBlocks(res.data.data || []);
        } catch (e) {
            logger.error('Failed to fetch blocks', e);
        }
    }, []);

    const fetchUsages = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.resource !== 'All') params.set('resource', filters.resource);
            if (filters.block !== 'All') params.set('blockId', filters.block);
            if (filters.date) params.set('startDate', filters.date);

            // Get last 200 records for the global list
            params.set('limit', '200');

            const res = await api.get(`/api/usage?${params.toString()}`);
            const data = res.data?.data || res.data?.usages || (Array.isArray(res.data) ? res.data : []);
            setUsages(Array.isArray(data) ? data : []);
        } catch (err) {
            logger.error('Failed to fetch usages', err);
            addToast('Error loading usage data', 'error');
        } finally {
            setLoading(false);
        }
    }, [filters, addToast]);

    useEffect(() => {
        fetchMeta();
        fetchUsages();
    }, [fetchMeta, fetchUsages]);

    const filteredUsages = useMemo(() => {
        return usages.filter(u => {
            const search = searchTerm.toLowerCase();
            return (
                (u.resource_type || '').toLowerCase().includes(search) ||
                (u.blockId?.name || '').toLowerCase().includes(search) ||
                (u.userId?.name || '').toLowerCase().includes(search) ||
                (u.notes || '').toLowerCase().includes(search)
            );
        });
    }, [usages, searchTerm]);

    const { sortedData, sortField, sortDirection, handleSort } = useSortableTable(
        filteredUsages,
        'usage_date',
        [searchTerm]
    );

    const handleExport = () => {
        if (sortedData.length === 0) {
            addToast('No data to export', 'warning');
            return;
        }

        const dataToExport = sortedData.map(u => ({
            Resource: u.resource_type,
            Consumption: u.usage_value,
            Unit: u.unit || 'units',
            Location: u.blockId?.name || 'N/A',
            Date: new Date(u.usage_date).toLocaleString(),
            LoggedBy: u.userId?.name || 'N/A',
            Notes: u.notes || ''
        }));

        exportToCSV(dataToExport, `usage_history_${new Date().toISOString().split('T')[0]}.csv`);
        addToast('File exported successfully', 'success');
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await api.delete(`/api/usage/${deleteId}`);
            addToast('Record deleted');
            fetchUsages();
        } catch (err) {
            addToast('Failed to delete record', 'error');
        } finally {
            setDeleteId(null);
            setDeleteItem(null);
        }
    };

    const resourceTypes = [...new Set(usages.map(u => u.resource_type).filter(Boolean))];

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 rounded-xl bg-[var(--bg-muted)] hover:bg-[var(--bg-secondary)] border border-[var(--border-color)] transition-all"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-primary">Usage History</h1>
                        <p className="text-sm text-secondary font-medium">Viewing all resource consumption records</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchUsages}
                        className="p-2.5 rounded-xl bg-[var(--bg-muted)] hover:bg-[var(--bg-secondary)] border border-[var(--border-color)] transition-all flex items-center justify-center"
                        title="Refresh Data"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <Button variant="secondary" onClick={handleExport} disabled={loading || sortedData.length === 0}>
                        <Download size={18} className="mr-2" /> Export CSV
                    </Button>
                </div>
            </div>

            {/* Advanced Filters */}
            <Card className="p-4 bg-[var(--bg-muted)]/30">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="relative">
                        <label className="text-[10px] uppercase font-black tracking-widest text-secondary mb-1.5 block">Search Records</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="Filter by user or notes..."
                                className="input pl-9 h-10 text-sm"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] uppercase font-black tracking-widest text-secondary mb-1.5 block">Resource Type</label>
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <select
                                className="input pl-9 h-10 text-sm appearance-none"
                                value={filters.resource}
                                onChange={e => setFilters({ ...filters, resource: e.target.value })}
                            >
                                <option value="All">All Resources</option>
                                {resourceTypes.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] uppercase font-black tracking-widest text-secondary mb-1.5 block">Block/Area</label>
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <select
                                className="input pl-9 h-10 text-sm appearance-none"
                                value={filters.block}
                                onChange={e => setFilters({ ...filters, block: e.target.value })}
                            >
                                <option value="All">All Areas</option>
                                {blocks.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] uppercase font-black tracking-widest text-secondary mb-1.5 block">From Date</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                                type="date"
                                className="input pl-9 h-10 text-sm"
                                value={filters.date}
                                onChange={e => setFilters({ ...filters, date: e.target.value })}
                            />
                        </div>
                    </div>
                </div>
            </Card>

            <Card flush className="overflow-hidden">
                {loading && usages.length === 0 ? (
                    <TableSkeleton rows={8} columns={5} />
                ) : sortedData.length === 0 ? (
                    <div className="py-20">
                        <EmptyState
                            icon={<Activity size={48} className="text-slate-300" />}
                            title="No records found"
                            description="Adjust your filters or search term to find what you're looking for."
                        />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th onClick={() => handleSort('resource_type')} className="cursor-pointer group">
                                        Resource <SortIcon field="resource_type" sortField={sortField} sortDirection={sortDirection} />
                                    </th>
                                    <th onClick={() => handleSort('blockId.name')} className="cursor-pointer group">
                                        Location <SortIcon field="blockId.name" sortField={sortField} sortDirection={sortDirection} />
                                    </th>
                                    <th onClick={() => handleSort('usage_value')} className="cursor-pointer group">
                                        Consumption <SortIcon field="usage_value" sortField={sortField} sortDirection={sortDirection} />
                                    </th>
                                    <th onClick={() => handleSort('usage_date')} className="cursor-pointer group">
                                        Recorded <SortIcon field="usage_date" sortField={sortField} sortDirection={sortDirection} />
                                    </th>
                                    <th onClick={() => handleSort('userId.name')} className="cursor-pointer group">
                                        Logged By <SortIcon field="userId.name" sortField={sortField} sortDirection={sortDirection} />
                                    </th>
                                    {showActions && <th className="text-right">Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {sortedData.map(u => (
                                    <tr key={u._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td>
                                            <div className="font-bold flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                                {u.resource_type}
                                            </div>
                                        </td>
                                        <td>
                                            <Badge variant="secondary" className="font-medium">
                                                {u.blockId?.name || 'N/A'}
                                            </Badge>
                                        </td>
                                        <td className="font-bold tabular-nums">
                                            {u.usage_value.toLocaleString()} <span className="text-[10px] text-secondary font-normal">{u.unit || 'units'}</span>
                                        </td>
                                        <td className="text-sm font-medium text-secondary">
                                            {new Date(u.usage_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                            <span className="ml-2 opacity-50 text-[10px]">{new Date(u.usage_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </td>
                                        <td>
                                            <div className="text-sm font-semibold truncate max-w-[120px]">
                                                {u.userId?.name || 'System'}
                                            </div>
                                        </td>
                                        {showActions && (
                                            <td className="text-right">
                                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {canEdit && (
                                                        <Button size="sm" variant="secondary" className="!p-1.5 h-8 w-8" onClick={() => navigate(`/warden/usage/${u._id}/edit`)}>
                                                            <Edit2 size={14} />
                                                        </Button>
                                                    )}
                                                    {canDelete && (
                                                        <Button size="sm" variant="danger" className="!p-1.5 h-8 w-8" onClick={() => { setDeleteItem(u); setDeleteId(u._id); }}>
                                                            <Trash2 size={14} />
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

                <div className="p-4 border-t border-[var(--border-color)] bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
                    <p className="text-xs font-bold text-secondary uppercase tracking-widest">
                        Total {sortedData.length} records in view
                    </p>
                    <div className="text-[10px] font-black uppercase text-secondary opacity-50">
                        Showing last 200 activity entries
                    </div>
                </div>
            </Card>

            <ConfirmModal
                isOpen={!!deleteId}
                onClose={() => { setDeleteId(null); setDeleteItem(null); }}
                onConfirm={handleDelete}
                title="Delete Usage Record"
                message={deleteItem ? `Confirm deletion of ${deleteItem.resource_type} entry for ${deleteItem.blockId?.name}?` : "Proceed with deletion?"}
            />
        </div>
    );
}
