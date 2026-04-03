import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../api/axios';
import {
    FileText,
    Download,
    Calendar,
    Filter,
    RefreshCw,
    Search,
    Building2,
    Table as TableIcon,
    PieChart as PieChartIcon,
    ChevronDown,
    FileSpreadsheet,
    FileJson,
    Activity,
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import { useToast } from '../context/ToastContext';
import { logger } from '../utils/logger';
import { exportToCSV, exportToExcel, exportToJSON, exportToPDF } from '../utils/export';

import { AuthContext } from '../context/AuthContext';
import { useContext } from 'react';

export default function Reports() {
    const { user } = useContext(AuthContext);
    const isPrincipal = (user?.role || '').toLowerCase() === 'principal';
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [data, setData] = useState([]);
    const [blocks, setBlocks] = useState([]);
    const [dynamicResources, setDynamicResources] = useState([]);

    const [filters, setFilters] = useState({
        resource: 'All',
        block: 'All',
        startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
    });

    const [view, setView] = useState('table'); // 'table' or 'summary'

    const fetchFilters = useCallback(async () => {
        try {
            const [blockRes, configRes] = await Promise.all([
                api.get('/api/admin/blocks').catch(() => ({ data: { data: [] } })),
                api.get('/api/resources').catch(() => ({ data: { data: [] } }))
            ]);
            setBlocks(blockRes.data.data || []);
            setDynamicResources(configRes.data?.data || configRes.data?.resources || []);
        } catch (err) {
            logger.error('Failed to fetch filter options', err);
        }
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.resource !== 'All') params.set('resource', filters.resource);
            if (filters.block !== 'All') params.set('block', filters.block);
            params.set('start', filters.startDate);
            params.set('end', filters.endDate);

            const res = await api.get(`/api/usage?${params.toString()}`);

            let records = [];
            if (Array.isArray(res.data)) records = res.data;
            else if (res.data.usages) records = res.data.usages;
            else if (res.data.data) records = res.data.data;

            setData(records);
        } catch (err) {
            logger.error('Failed to fetch report data', err);
            addToast('Failed to load report data', 'error');
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [filters, addToast]);

    useEffect(() => {
        fetchFilters();
        fetchData();
        const refresh = () => {
            fetchFilters();
            fetchData();
        };
        window.addEventListener('usage:added', refresh);
        return () => window.removeEventListener('usage:added', refresh);
    }, [fetchData, fetchFilters]);

    const summary = useMemo(() => {
        if (!data.length) return [];
        const grouped = data.reduce((acc, curr) => {
            const res = curr.resource_type;
            if (!acc[res]) acc[res] = { resource: res, total: 0, count: 0, unit: curr.unit || 'units' };
            acc[res].total += Number(curr.usage_value || 0);
            acc[res].count += 1;
            return acc;
        }, {});
        return Object.values(grouped);
    }, [data]);

    const handleExport = async (format) => {
        if (data.length === 0) {
            addToast('No data to export', 'warning');
            return;
        }

        setExporting(true);
        try {
            const exportData = data.map(item => ({
                'Resource Type': item.resource_type,
                'Consumption': item.usage_value,
                'Unit': item.unit || 'units',
                'Date': new Date(item.usage_date).toLocaleDateString(),
                'Block/Location': item.category || 'N/A',
                'Logged By': item.userId?.name || 'System',
                'Notes': item.notes || ''
            }));

            const fileName = `Resource_Report_${filters.resource}_${filters.startDate}_to_${filters.endDate}`;

            switch (format) {
                case 'csv':
                    exportToCSV(exportData, `${fileName}.csv`);
                    break;
                case 'excel':
                    exportToExcel(exportData, `${fileName}.xlsx`);
                    break;
                case 'json':
                    exportToJSON(exportData, `${fileName}.json`);
                    break;
                case 'pdf':
                    exportToPDF(exportData, `${fileName}.pdf`, `Resource Usage Report: ${filters.resource}`);
                    break;
                default:
                    break;
            }
            addToast(`Successfully exported as ${format.toUpperCase()}`, 'success');
        } catch (err) {
            logger.error('Export failed', err);
            addToast('Export failed', 'error');
        } finally {
            setExporting(false);
        }
    };

    const getResourceIcon = (type) => {
        const match = (Array.isArray(dynamicResources) ? dynamicResources : [])
            .find(r => r?.name === type);
        return match?.icon ? <span className="text-base">{match.icon}</span> : <Activity size={16} />;
    };

    return (
        <div className="space-y-6 p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div />

                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchData}
                        className="p-2.5 rounded-xl bg-[var(--bg-muted)] hover:bg-[var(--bg-secondary)] border border-[var(--border-color)] transition-all shadow-sm group flex items-center justify-center"
                        title="Refresh Data"
                    >
                        <RefreshCw size={18} className={`${loading ? 'animate-spin' : ''} text-[var(--text-secondary)] group-hover:text-blue-500 transition-colors`} />
                    </button>
                    <div className="relative group">
                        <Button variant="primary" disabled={exporting || data.length === 0}>
                            <Download size={16} className="mr-2" />
                            Export
                            <ChevronDown size={14} className="ml-2" />
                        </Button>
                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
                            <button onClick={() => handleExport('csv')} className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
                                <FileText size={14} className="text-blue-500" /> Export CSV
                            </button>
                            <button onClick={() => handleExport('excel')} className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
                                <FileSpreadsheet size={14} className="text-emerald-500" /> Export Excel
                            </button>
                            <button onClick={() => handleExport('json')} className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
                                <FileJson size={14} className="text-amber-500" /> Export JSON
                            </button>
                            <button onClick={() => handleExport('pdf')} className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
                                <FileText size={14} className="text-rose-500" /> Export PDF
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <Card>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="label mb-1.5 flex items-center gap-1.5">Resource</label>
                        <select
                            className="input text-sm"
                            value={filters.resource}
                            onChange={e => setFilters({ ...filters, resource: e.target.value })}
                        >
                            <option value="All">All Resources</option>
                            {dynamicResources.map(r => (
                                <option key={r._id} value={r.resource}>{r.resource}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="label mb-1.5 flex items-center gap-1.5">Block/Location</label>
                        <select
                            className="input text-sm"
                            value={filters.block}
                            onChange={e => setFilters({ ...filters, block: e.target.value })}
                        >
                            <option value="All">All Blocks</option>
                            {blocks.map(b => (
                                <option key={b._id} value={b._id}>{b.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="label mb-1.5 flex items-center gap-1.5">Start Date</label>
                        <input
                            type="date"
                            className="input text-sm"
                            value={filters.startDate}
                            onChange={e => setFilters({ ...filters, startDate: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="label mb-1.5 flex items-center gap-1.5">End Date</label>
                        <input
                            type="date"
                            className="input text-sm"
                            value={filters.endDate}
                            onChange={e => setFilters({ ...filters, endDate: e.target.value })}
                        />
                    </div>
                </div>
            </Card>

            <div className="flex gap-2">
                <button
                    onClick={() => setView('table')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${view === 'table' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`}
                >
                    <TableIcon size={16} /> Table View
                </button>
                <button
                    onClick={() => setView('summary')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${view === 'summary' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`}
                >
                    <PieChartIcon size={16} /> Summary View
                </button>
            </div>

            <Card flush>
                {loading ? (
                    <div className="p-20 text-center text-slate-500 flex flex-col items-center gap-3">
                        <RefreshCw size={40} className="animate-spin text-blue-500 opacity-20" />
                        Generating Report...
                    </div>
                ) : data.length === 0 ? (
                    <div className="p-20">
                        <EmptyState
                            title="No Data Found"
                            description="No records match your selected filters. Try broadening the date range or selecting 'All' resources."
                        />
                    </div>
                ) : view === 'table' ? (
                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Resource</th>
                                    <th>Value</th>
                                    <th>Unit</th>
                                    <th>Date</th>
                                    <th>Location</th>
                                    <th>Logged By</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.map(item => (
                                    <tr key={item._id}>
                                        <td>
                                            <div className="flex items-center gap-2 font-medium">
                                                {getResourceIcon(item.resource_type)}
                                                {item.resource_type}
                                            </div>
                                        </td>
                                        <td className="font-bold">{item.usage_value}</td>
                                        <td className="text-slate-500 text-sm">{item.unit || 'units'}</td>
                                        <td>{new Date(item.usage_date).toLocaleDateString()}</td>
                                        <td><Badge variant="secondary">{item.category || '-'}</Badge></td>
                                        <td className="text-sm text-slate-600 dark:text-slate-400">{item.userId?.name || 'System'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {summary.map(item => (
                            <div key={item.resource} className="p-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 rounded-lg bg-white dark:bg-slate-800 shadow-sm">
                                        {getResourceIcon(item.resource)}
                                    </div>
                                    <h3 className="font-bold text-lg">{item.resource}</h3>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-end">
                                        <span className="text-sm text-slate-500 uppercase font-semibold tracking-wider">Total Usage</span>
                                        <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{item.total.toLocaleString()} <span className="text-xs font-normal text-slate-400">{item.unit}</span></span>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <span className="text-sm text-slate-500 uppercase font-semibold tracking-wider">Entries Count</span>
                                        <span className="text-lg font-bold">{item.count}</span>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <span className="text-sm text-slate-500 uppercase font-semibold tracking-wider">Average / Entry</span>
                                        <span className="text-lg font-bold">{(item.total / item.count).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}
