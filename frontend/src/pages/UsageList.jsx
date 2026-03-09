import React, { useEffect, useState, useContext } from 'react';
import api from '../services/api';
import { getSocket } from '../utils/socket';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ROLES } from '../utils/roles';
import { exportToCSV } from '../utils/export';
import {
  Plus,
  Search,
  Download,
  Edit2,
  Trash2,
  Zap,
  Droplets,
  Flame,
  Wind,
  Utensils,
  Trash,
  Filter
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import { ConfirmModal } from '../components/common/Modal';
import { useToast } from '../context/ToastContext';
import useSortableTable from '../hooks/useSortableTable';
import SortIcon from '../components/common/SortIcon';
import TableSkeleton from '../components/common/TableSkeleton';
import timeAgo from '../utils/timeAgo';

export default function UsageList() {
  const [usages, setUsages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchParams] = useSearchParams();
  const [resourceFilter, setResourceFilter] = useState(searchParams.get('resource') || 'All');
  const [blockFilter, setBlockFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortMode, setSortMode] = useState('newest');
  const [blocks, setBlocks] = useState([]);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);

  const { user } = useContext(AuthContext);
  const { addToast } = useToast();
  const navigate = useNavigate();

  const canEdit = user && [ROLES.ADMIN, ROLES.WARDEN].includes(user.role);
  // Only Admin and General Manager can delete records (Wardens cannot)
  const canDelete = user && [ROLES.ADMIN, ROLES.GM].includes(user.role);
  const showActions = canEdit || canDelete;
  // Executive = full campus visibility with block filter access
  const isExecutive = user && [ROLES.DEAN, ROLES.DEAN, ROLES.ADMIN, ROLES.GM].includes(user.role);

  useEffect(() => {
    load();

    // Fetch blocks for Dean/Principal filter
    if (isExecutive) {
      api.get('/api/admin/blocks').then(r => setBlocks(r.data.data || [])).catch(() => { });
    }

    const socket = getSocket();
    if (socket) {
      socket.on('usage:refresh', load);
      socket.on('usage:new', load);
    }

    return () => {
      if (socket) {
        socket.off('usage:refresh', load);
        socket.off('usage:new', load);
      }
    };
  }, []);

  // Re-fetch when executive filters change
  useEffect(() => {
    if (isExecutive) load();
  }, [blockFilter, startDate, endDate, sortMode]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (resourceFilter && resourceFilter !== 'All') params.set('resource', resourceFilter);
      if (blockFilter) params.set('block', blockFilter);
      if (startDate) params.set('start', startDate);
      if (endDate) params.set('end', endDate);
      if (sortMode === 'highest_consumption') params.set('sort', 'highest_consumption');
      else if (sortMode === 'block_name') params.set('sort', 'block_name');
      else if (sortMode === 'oldest') params.set('sort', 'oldest');

      const res = await api.get(`/api/usage?${params.toString()}`);
      setUsages(res.data.usages || (Array.isArray(res.data) ? res.data : []));
    } catch (err) {
      addToast('Failed to load usage records', 'error');
      setUsages([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await api.delete(`/api/usage/${deleteId}`);
      // Re-fetch the list to reflect soft-delete and prevent stale state
      await load();
      // Request alert counts refresh via context if available
      try { if (window && window.dispatchEvent) window.dispatchEvent(new Event('usage:deleted')); } catch (e) { }
      addToast('Record deleted successfully');
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to delete record', 'error');
    } finally {
      setDeleteId(null);
      setDeleteItem(null);
    }
  }

  const confirmDelete = (item) => {
    setDeleteItem(item);
    setDeleteId(item._id);
  };

  const filteredUsages = React.useMemo(() => {
    return usages.filter(u => {
      const matchesSearch = (u.userId?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.notes || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.resource_type || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesResource = resourceFilter === 'All' || u.resource_type === resourceFilter;
      return matchesSearch && matchesResource;
    });
  }, [usages, searchTerm, resourceFilter]);

  const { sortedData: finalUsages, sortField, sortDirection, handleSort } = useSortableTable(
    filteredUsages,
    'usage_date',
    [searchTerm, resourceFilter, blockFilter, startDate, endDate, sortMode]
  );

  const getResourceIcon = (type) => {
    switch (type) {
      case 'Electricity': return <Zap size={16} className="text-amber-500" />;
      case 'Water': return <Droplets size={16} className="text-blue-500" />;
      case 'LPG': return <Flame size={16} className="text-orange-500" />;
      case 'Diesel': return <Wind size={16} className="text-slate-500" />;
      case 'Food': return <Utensils size={16} className="text-emerald-500" />;
      case 'Waste': return <Trash size={16} className="text-rose-500" />;
      default: return <Zap size={16} />;
    }
  };

  const handleExport = () => {
    if (finalUsages.length === 0) {
      addToast('No records to export', 'warning');
      return;
    }
    const dataToExport = finalUsages.map(u => ({
      Resource: u.resource_type,
      Value: u.usage_value,
      Unit: u.unit || 'units',
      Date: new Date(u.usage_date).toLocaleString(),
      User: u.userId?.name || 'N/A',
      Notes: u.notes || ''
    }));
    exportToCSV(dataToExport, `usage_records_${new Date().toISOString().split('T')[0]}.csv`);
    addToast('Usage data exported');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {resourceFilter !== 'All'
              ? `${resourceFilter} Usage Details`
              : 'Usage Records'
            }
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {resourceFilter !== 'All'
              ? `Showing all ${resourceFilter} records`
              : 'View and manage resource consumption logs'
            }
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleExport} disabled={loading || usages.length === 0}>
            <Download size={16} className="mr-2" />
            Export
          </Button>
          {canEdit && (
            <Button variant="primary" onClick={() => navigate('/usage/new')}>
              <Plus size={16} className="mr-2" />
              Log Usage
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      {resourceFilter !== 'All' && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Filtered by:
          </span>
          <span className="flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm font-medium">
            {resourceFilter}
            <button
              onClick={() => {
                setResourceFilter('All');
                navigate('/usage/all');
              }}
              className="ml-1 hover:text-blue-900 dark:hover:text-blue-200 font-bold text-base leading-none"
            >
              ×
            </button>
          </span>
          <span className="text-xs text-gray-400">
            (click × to show all resources)
          </span>
        </div>
      )}
      <Card>
        <div className="flex flex-col gap-3">
          {/* Row 1: Search + Resource (always visible) */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Search records..."
                className="input pl-10 w-full"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="input w-full md:w-48"
              value={resourceFilter}
              onChange={e => { setResourceFilter(e.target.value); load(); }}
            >
              <option value="All">All Resources</option>
              <option value="Electricity">Electricity</option>
              <option value="Water">Water</option>
              <option value="Food">Food</option>
              <option value="LPG">LPG</option>
              <option value="Diesel">Diesel</option>
              <option value="Waste">Waste</option>
            </select>
          </div>

          {/* Row 2: Executive-only filters (Dean / Principal / Admin) */}
          {isExecutive && (
            <div className="flex flex-col md:flex-row gap-3 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--text-secondary)', minWidth: 70 }}>
                <Filter size={13} /> Filters
              </div>
              {/* Block filter */}
              <select
                className="input text-sm"
                style={{ minWidth: 150 }}
                value={blockFilter}
                onChange={e => setBlockFilter(e.target.value)}
              >
                <option value="">All Blocks</option>
                {blocks.map(b => (
                  <option key={b._id} value={b._id}>{b.name}</option>
                ))}
              </select>

              {/* Date range */}
              <input
                type="date"
                className="input text-sm"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                title="Start date"
              />
              <input
                type="date"
                className="input text-sm"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                title="End date"
              />

              {/* Sort */}
              <select
                className="input text-sm"
                style={{ minWidth: 180 }}
                value={sortMode}
                onChange={e => setSortMode(e.target.value)}
              >
                <option value="newest">Sort: Newest First</option>
                <option value="oldest">Sort: Oldest First</option>
                <option value="highest_consumption">Sort: Highest Consumption</option>
                <option value="block_name">Sort: Block Name</option>
              </select>

              {/* Clear filters */}
              {(blockFilter || startDate || endDate) && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => { setBlockFilter(''); setStartDate(''); setEndDate(''); setSortMode('newest'); }}
                >
                  Clear
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card>
        {loading ? (
          <TableSkeleton rows={5} columns={5} />
        ) : finalUsages.length === 0 ? (
          <EmptyState title="No Records Found" description="Try adjusting your filters or add a new record." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('resource_type')} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'resource_type' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                    Resource <SortIcon field="resource_type" sortField={sortField} sortDirection={sortDirection} />
                  </th>
                  <th onClick={() => handleSort('usage_value')} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'usage_value' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                    Value <SortIcon field="usage_value" sortField={sortField} sortDirection={sortDirection} />
                  </th>
                  <th onClick={() => handleSort('usage_date')} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'usage_date' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                    Date <SortIcon field="usage_date" sortField={sortField} sortDirection={sortDirection} />
                  </th>
                  <th onClick={() => handleSort('userId.name')} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'userId.name' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                    Logged By <SortIcon field="userId.name" sortField={sortField} sortDirection={sortDirection} />
                  </th>
                  <th>Notes</th>
                  {showActions && <th className="text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {finalUsages.map(u => (
                  <tr key={u._id}>
                    <td>
                      <div className="flex items-center gap-2">
                        {getResourceIcon(u.resource_type)}
                        <span className="font-medium">{u.resource_type}</span>
                      </div>
                    </td>
                    <td>
                      <span className="font-bold">{u.usage_value}</span>
                      <span className="text-xs text-slate-500 ml-1">{u.unit || 'units'}</span>
                    </td>
                    <td>{timeAgo(u.usage_date)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold">
                          {u.userId?.name?.charAt(0) || '?'}
                        </div>
                        <span className="text-sm">{u.userId?.name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="max-w-xs truncate text-slate-500">{u.notes || '-'}</td>
                    {showActions && (
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          {canEdit && (
                            <Button size="sm" variant="secondary" onClick={() => navigate(`/usage/${u._id}/edit`)}>
                              <Edit2 size={14} />
                            </Button>
                          )}
                          {canDelete && (
                            <Button size="sm" variant="danger" onClick={() => confirmDelete(u)}>
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
      </Card>

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => { setDeleteId(null); setDeleteItem(null); }}
        onConfirm={handleDelete}
        title="Delete Usage Record"
        message={deleteItem
          ? `Are you sure you want to delete the ${deleteItem.resource_type} usage record of ${deleteItem.usage_value} units recorded on ${new Date(deleteItem.usage_date).toLocaleDateString()}?\n\nThis action cannot be undone.`
          : "Are you sure you want to delete this record?"}
      />
    </div>
  );
}
