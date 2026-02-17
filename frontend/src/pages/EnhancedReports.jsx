import React, { useState, useEffect, useContext } from 'react';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { FileText, BarChart2, TrendingUp, Download, Filter } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import { Bar, Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

export default function EnhancedReports() {
    const { user } = useContext(AuthContext);
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState('bill');
    const [blocks, setBlocks] = useState([]);
    const [loading, setLoading] = useState(false);

    // Data States
    const [billData, setBillData] = useState(null);
    const [comparisonData, setComparisonData] = useState(null);
    const [trendsData, setTrendsData] = useState(null);

    // Filter States
    const [filters, setFilters] = useState({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        blockId: '',
        resource: 'Electricity',
        trendPeriod: 6
    });

    const months = [
        { value: 1, label: 'January' }, { value: 2, label: 'February' },
        { value: 3, label: 'March' }, { value: 4, label: 'April' },
        { value: 5, label: 'May' }, { value: 6, label: 'June' },
        { value: 7, label: 'July' }, { value: 8, label: 'August' },
        { value: 9, label: 'September' }, { value: 10, label: 'October' },
        { value: 11, label: 'November' }, { value: 12, label: 'December' }
    ];

    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
    const resources = ['Electricity', 'Water', 'LPG', 'Diesel', 'Food', 'Waste'];

    useEffect(() => {
        fetchBlocks();
    }, []);

    useEffect(() => {
        // Reset data when tab changes to force fresh fetch based on user action if needed, 
        // or just keep filtered state. For now, let's trigger fetch if data is missing.
        if (activeTab === 'bill' && !billData) fetchBill();
        if (activeTab === 'comparison' && !comparisonData) fetchComparison();
        if (activeTab === 'trends' && !trendsData) fetchTrends();
    }, [activeTab]);

    const fetchBlocks = async () => {
        try {
            const res = await api.get('/api/admin/blocks');
            setBlocks(res.data?.blocks || []);
        } catch (err) {
            console.error('Failed to fetch blocks', err);
        }
    };

    const fetchBill = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                month: filters.month,
                year: filters.year,
                blockId: filters.blockId
            });
            const res = await api.get(`/api/reports/bill-estimate?${params}`);
            setBillData(res.data);
        } catch (err) {
            addToast('Failed to generate bill estimate', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchComparison = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                month: filters.month,
                year: filters.year,
                resource: filters.resource === 'All' ? '' : filters.resource
            });
            const res = await api.get(`/api/reports/comparison?${params}`);
            setComparisonData(res.data);
        } catch (err) {
            addToast('Failed to fetch comparison data', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchTrends = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                resource: filters.resource,
                months: filters.trendPeriod,
                blockId: filters.blockId
            });
            const res = await api.get(`/api/reports/trends?${params}`);
            setTrendsData(res.data);
        } catch (err) {
            addToast('Failed to fetch trends', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        // Construct export URL
        const params = new URLSearchParams();
        if (filters.blockId) params.append('blockId', filters.blockId);

        // Date Logic (simplified)
        const startDate = new Date(filters.year, filters.month - 1, 1).toISOString();
        const endDate = new Date(filters.year, filters.month, 0).toISOString();
        params.append('start', startDate);
        params.append('end', endDate);

        const baseUrl = api.defaults.baseURL || 'http://localhost:4000';
        window.open(`${baseUrl}/api/reports/export/csv?${params}`, '_blank');
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 style={{ color: 'var(--text-primary)' }}>System Reports</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Generate usage reports, bill estimates, and comparative analysis
                    </p>
                </div>
                <Button variant="primary" onClick={handleExport}>
                    <Download size={16} className="mr-2" />
                    Export CSV
                </Button>
            </div>

            {/* Tabs */}
            <div className="flex bg-white dark:bg-slate-800 rounded-lg p-1 w-fit border" style={{ borderColor: 'var(--border)' }}>
                {[
                    { id: 'bill', label: 'Bill Estimate', icon: <FileText size={14} /> },
                    { id: 'comparison', label: 'Block Comparison', icon: <BarChart2 size={14} /> },
                    { id: 'trends', label: 'Historical Trends', icon: <TrendingUp size={14} /> }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === tab.id
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Filters */}
            <Card>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="label">Month</label>
                        <select
                            className="input"
                            value={filters.month}
                            onChange={e => setFilters({ ...filters, month: parseInt(e.target.value) })}
                        >
                            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="label">Year</label>
                        <select
                            className="input"
                            value={filters.year}
                            onChange={e => setFilters({ ...filters, year: parseInt(e.target.value) })}
                        >
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>

                    {activeTab !== 'comparison' && (
                        <div>
                            <label className="label">Block</label>
                            <select
                                className="input"
                                value={filters.blockId}
                                onChange={e => setFilters({ ...filters, blockId: e.target.value })}
                            >
                                <option value="">All Blocks</option>
                                {blocks.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                            </select>
                        </div>
                    )}

                    {(activeTab === 'comparison' || activeTab === 'trends') && (
                        <div>
                            <label className="label">Resource</label>
                            <select
                                className="input"
                                value={filters.resource}
                                onChange={e => setFilters({ ...filters, resource: e.target.value })}
                            >
                                {activeTab === 'comparison' && <option value="All">All Resources</option>}
                                {resources.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                    )}

                    <Button
                        variant="secondary"
                        onClick={() => {
                            if (activeTab === 'bill') fetchBill();
                            if (activeTab === 'comparison') fetchComparison();
                            if (activeTab === 'trends') fetchTrends();
                        }}
                        disabled={loading}
                    >
                        {loading ? 'Refreshing...' : 'Refresh Data'}
                    </Button>
                </div>
            </Card>

            {/* Content Area */}
            {loading ? (
                <div className="h-64 flex items-center justify-center">
                    <div className="spinner"></div>
                </div>
            ) : (
                <>
                    {/* Bill Estimate View */}
                    {activeTab === 'bill' && billData && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <Card>
                                    <div className="text-center p-4">
                                        <p className="text-sm text-slate-500 uppercase tracking-wider mb-1">Total Estimated Cost</p>
                                        <h2 className="text-4xl font-bold text-slate-900 dark:text-white">
                                            ₹{billData.totalCost?.toLocaleString()}
                                        </h2>
                                    </div>
                                </Card>
                            </div>

                            <Card title="Cost Breakdown">
                                <div className="overflow-x-auto">
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>Resource</th>
                                                <th className="text-right">Usage</th>
                                                <th className="text-right">Rate</th>
                                                <th className="text-right">Cost</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {billData.breakdown?.map((item, i) => (
                                                <tr key={i}>
                                                    <td className="font-medium">{item.resource}</td>
                                                    <td className="text-right">{item.usage.toLocaleString()}</td>
                                                    <td className="text-right">₹{item.rate}</td>
                                                    <td className="text-right font-bold">₹{item.cost.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* Comparison View */}
                    {activeTab === 'comparison' && comparisonData && (
                        <div className="space-y-6">
                            {Object.entries(comparisonData.byResource || {}).map(([res, items]) => (
                                <Card key={res} title={`${res} Comparison`}>
                                    <div className="h-[300px]">
                                        <Bar
                                            data={{
                                                labels: items.map(i => i.block),
                                                datasets: [{
                                                    label: `${res} Usage`,
                                                    data: items.map(i => i.usage),
                                                    backgroundColor: '#3B82F6',
                                                    borderRadius: 4
                                                }]
                                            }}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                plugins: { legend: { display: false } }
                                            }}
                                        />
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}

                    {/* Trends View */}
                    {activeTab === 'trends' && trendsData && (
                        <Card title={`${filters.resource} Trends`}>
                            <div className="h-[400px]">
                                <Line
                                    data={{
                                        labels: trendsData.trends?.map(t => t.date) || [],
                                        datasets: [{
                                            label: 'Usage',
                                            data: trendsData.trends?.map(t => t.usage) || [],
                                            borderColor: '#2563EB',
                                            backgroundColor: 'rgba(37, 99, 235, 0.1)',
                                            fill: true,
                                            tension: 0.3
                                        }]
                                    }}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false
                                    }}
                                />
                            </div>
                        </Card>
                    )}

                    {!loading && !billData && !comparisonData && !trendsData && (
                        <EmptyState title="No Data Generated" description="Select filters and click refresh to generate report." />
                    )}
                </>
            )}
        </div>
    );
}
