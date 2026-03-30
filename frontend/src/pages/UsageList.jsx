import React, { useEffect, useState, useContext, useMemo } from 'react';
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
  Sun,
  Trash,
  Filter,
  Activity
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
import { logger } from '../utils/logger';

const RESOURCE_META = {
  Electricity: { icon: <Zap size={16} className="text-amber-500" /> },
  Water: { icon: <Droplets size={16} className="text-blue-500" /> },
  LPG: { icon: <Flame size={16} className="text-orange-500" /> },
  Diesel: { icon: <Wind size={16} className="text-slate-500" /> },
  Solar: { icon: <Sun size={16} className="text-yellow-500" /> },
  Waste: { icon: <Trash2 size={16} className="text-rose-500" /> },
};

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
  const [dynamicResources, setDynamicResources] = useState([]);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);

  const { user } = useContext(AuthContext);
  const { addToast } = useToast();
  const navigate = useNavigate();

  const canEdit = user && [ROLES.ADMIN, ROLES.WARDEN].includes(user.role);
  // Only Admin can delete usage records (Wardens/GM are view-only here)
  const canDelete = user && [ROLES.ADMIN].includes(user.role);
  const showActions = canEdit || canDelete;
  const isWarden = user?.role === ROLES.WARDEN;
  const isExecutive = user && [ROLES.DEAN, ROLES.ADMIN, ROLES.GM].includes(user.role);
  // Show block filter only to roles that can see all blocks (not warden — backend already scopes)
  const showBlockFilter = isExecutive;

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const [configRes] = await Promise.all([
          api.get('/api/resource-config'),
        ]);
        setDynamicResources(configRes.data.data || []);

        // Fetch blocks for Dean/Admin/GM block filter (NOT warden — they're scoped server-side)
        if (showBlockFilter) {
          const blockRes = await api.get('/api/admin/blocks').catch(() => ({ data: { data: [] } }));
          setBlocks(blockRes.data.data || []);
        }

        await load();
      } catch (err) {
        logger.error('UsageList init error:', err);
      } finally {
        setLoading(false);
      }
    }

    init();

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

  // Re-fetch when filters change
  useEffect(() => {
    load();
  }, [resourceFilter, blockFilter, startDate, endDate, sortMode]);

  async function load() {
    try {
      const params = new URLSearchParams();
      if (resourceFilter && resourceFilter !== 'All') {
        params.set('resource_type', resourceFilter);
      }
      if (blockFilter) {
        params.set('blockId', blockFilter);
      }
      if (startDate) {
        params.set('startDate', startDate);
      }
      if (endDate) {
        params.set('endDate', endDate);
      }

      // Map frontend sort modes to backend expectations
      if (sortMode === 'highest_consumption') {
        params.set('sort', '-usage_value');
      } else if (sortMode === 'oldest') {
        params.set('sort', 'usage_date');
      } else if (sortMode === 'block_name') {
        params.set('sort', 'blockId');
      } else {
        params.set('sort', '-usage_date');
      }

      const res = await api.get(`/api/usage?${params.toString()}`);
      const arr =
        res.data?.data ||
        res.data?.usages ||
        (Array.isArray(res.data) ? res.data : []);
      setUsages(Array.isArray(arr) ? arr : []);
    } catch (err) {
      addToast('Failed to load usage records', 'error');
      setUsages([]);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await api.delete(`/api/usage/${deleteId}`);
      await load();
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
    [searchTerm, blockFilter, startDate, endDate, sortMode]
  );

  const getResourceIcon = (type) => {
    return RESOURCE_META[type]?.icon || <Activity size={16} className="text-slate-400" />;
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
      Location: u.blockId?.name || 'N/A',
      Date: new Date(u.usage_date).toLocaleString(),
      LoggedBy: u.createdBy?.name || 'N/A',
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
            <Button variant="primary" onClick={() => navigate(
              user?.role === 'warden' ? '/warden/usage/new'
                : user?.role === 'admin' ? '/admin/usage/new'
                  : '/usage/new'
            )}>
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
              onChange={e => setResourceFilter(e.target.value)}
            >
              <option value="All">All Resources</option>
              {dynamicResources.map(r => (
                <option key={r._id} value={r.name}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* Row 2: Executive-only filters (Dean / Admin / GM, NOT warden) */}
          {showBlockFilter && (
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
                  <th onClick={() => handleSort('blockId.name')} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'blockId.name' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                    Location <SortIcon field="blockId.name" sortField={sortField} sortDirection={sortDirection} />
                  </th>
                  <th onClick={() => handleSort('usage_value')} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'usage_value' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                    Value <SortIcon field="usage_value" sortField={sortField} sortDirection={sortDirection} />
                  </th>
                  <th onClick={() => handleSort('usage_date')} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'usage_date' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                    Date <SortIcon field="usage_date" sortField={sortField} sortDirection={sortDirection} />
                  </th>
                  <th onClick={() => handleSort('createdBy.name')} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'createdBy.name' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                    Logged By <SortIcon field="createdBy.name" sortField={sortField} sortDirection={sortDirection} />
                  </th>
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
                    <td className="text-sm font-medium">{u.blockId?.name || '-'}</td>
                    <td>
                      <span className="font-bold">{u.usage_value}</span>
                      <span className="text-xs text-slate-500 ml-1">{u.unit || 'units'}</span>
                    </td>
                    <td>{timeAgo(u.usage_date)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-[10px] font-bold text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                          {u.createdBy?.name?.charAt(0) || '?'}
                        </div>
                        <span className="text-sm font-medium">{u.createdBy?.name || 'System'}</span>
                      </div>
                    </td>
                    {showActions && (
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          {canEdit && (
                            <Button size="sm" variant="secondary" onClick={() => navigate(
                              user?.role === 'warden' ? `/warden/usage/${u._id}/edit`
                                : user?.role === 'admin' ? `/admin/usage/${u._id}/edit`
                                  : `/usage/${u._id}/edit`
                            )}>
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

