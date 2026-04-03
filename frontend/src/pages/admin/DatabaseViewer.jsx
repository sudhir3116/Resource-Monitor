import React, { useState, useEffect, useContext, useMemo } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../api/axios';
import { Navigate } from 'react-router-dom';
import {
    Database, Search, Filter, RefreshCw, X, Copy, Check,
    ChevronLeft, ChevronRight, ChevronsUpDown, Table2, CheckCircle2, XCircle
} from 'lucide-react';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';

const DatabaseViewer = () => {
    const { user } = useContext(AuthContext);
    const { addToast } = useToast();


    // States
    const [dbStats, setDbStats] = useState(null);
    const [collectionList, setCollectionList] = useState([]);
    const [selectedCollection, setSelectedCollection] = useState(null);
    const [loadingStats, setLoadingStats] = useState(true);
    const [loadingData, setLoadingData] = useState(false);

    // Data view states
    const [data, setData] = useState({ docs: [], total: 0, page: 1, totalPages: 1, fields: [] });
    const [params, setParams] = useState({
        page: 1,
        limit: 20,
        search: '',
        sortBy: '_id',
        order: 'desc',
        startDate: '',
        endDate: ''
    });

    // Detail Modal states
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedDocId, setSelectedDocId] = useState(null);
    const [selectedDocData, setSelectedDocData] = useState(null);
    const [loadingDoc, setLoadingDoc] = useState(false);
    const [copied, setCopied] = useState(false);

    // Initial Load
    useEffect(() => {
        if (user?.role === 'admin') {
            fetchDbStats();
            fetchCollectionsList();
        }
    }, [user]);

    // Load Collection Data when selectedCollection or params change
    useEffect(() => {
        if (selectedCollection) {
            fetchCollectionData();
        }
    }, [selectedCollection, params.page, params.limit, params.sortBy, params.order]);

    const fetchDbStats = async () => {
        try {
            const res = await api.get('/api/admin/db/stats');
            setDbStats(res.data);
        } catch (err) {
            addToast('Failed to load database statistics', 'error');
        } finally {
            setLoadingStats(false);
        }
    };

    const fetchCollectionsList = async () => {
        try {
            const res = await api.get('/api/admin/db/collections');
            setCollectionList(res.data.collections || []);
        } catch (err) {
            addToast('Failed to load collections list', 'error');
        }
    };

    const fetchCollectionData = async () => {
        setLoadingData(true);
        try {
            const queryParams = new URLSearchParams({
                page: params.page,
                limit: params.limit,
                search: params.search,
                sortBy: params.sortBy,
                order: params.order
            });
            if (params.startDate) queryParams.append('startDate', params.startDate);
            if (params.endDate) queryParams.append('endDate', params.endDate);

            const res = await api.get(`/api/admin/db/collections/${selectedCollection}?${queryParams.toString()}`);

            // Remove password field if it sneaks in
            const fields = res.data.fields.filter(f => f !== 'password' && f !== '__v');

            setData({
                docs: res.data.data,
                total: res.data.total,
                page: res.data.page,
                totalPages: res.data.totalPages,
                fields: fields
            });
        } catch (err) {
            addToast(`Failed to load data for ${selectedCollection}`, 'error');
        } finally {
            setLoadingData(false);
        }
    };

    const fetchDocumentDetail = async (id) => {
        setSelectedDocId(id);
        setModalOpen(true);
        setLoadingDoc(true);
        try {
            const res = await api.get(`/api/admin/db/collections/${selectedCollection}/${id}`);
            // Filter out password again just in case backend misses it
            if (res.data.password) delete res.data.password;
            setSelectedDocData(res.data);
        } catch (err) {
            addToast('Failed to load document details', 'error');
            setModalOpen(false);
        } finally {
            setLoadingDoc(false);
        }
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        setParams(prev => ({ ...prev, page: 1 })); // reset page on new search
        fetchCollectionData();
    };

    const handleSort = (field) => {
        setParams(prev => ({
            ...prev,
            sortBy: field,
            order: prev.sortBy === field && prev.order === 'asc' ? 'desc' : 'asc'
        }));
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(JSON.stringify(text, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const highlightJSON = (jsonObj) => {
        if (!jsonObj) return '';
        const jsonStr = JSON.stringify(jsonObj, null, 2);

        // Simple regex replace for basic syntax highlighting
        return jsonStr.replace(
            /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
            (match) => {
                let color = 'text-blue-500 dark:text-blue-400'; // number
                if (/^"/.test(match)) {
                    if (/:$/.test(match)) {
                        color = 'text-purple-600 dark:text-purple-400 font-semibold'; // key
                    } else {
                        color = 'text-green-600 dark:text-green-400'; // string
                    }
                } else if (/true|false/.test(match)) {
                    color = 'text-amber-500 dark:text-amber-400'; // boolean
                } else if (/null/.test(match)) {
                    color = 'text-slate-400 dark:text-slate-500'; // null
                }
                return `<span class="${color}">${match}</span>`;
            }
        );
    };

    // Render Value Helper
    const renderCellValue = (val) => {
        if (val === null || val === undefined) return <span className="text-slate-400">-</span>;

        if (typeof val === 'boolean') {
            return val ? <Badge success>Yes</Badge> : <Badge danger>No</Badge>;
        }

        if (Array.isArray(val)) {
            return <Badge variant="secondary">[{val.length} items]</Badge>;
        }

        if (typeof val === 'object') {
            return <Badge variant="secondary">&#123; object &#125;</Badge>;
        }

        const strVal = String(val);

        // Date check (naive ISO check)
        if (strVal.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
            const date = new Date(strVal);
            return <span className="whitespace-nowrap">{date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>;
        }

        // ObjectId check (24 hex)
        if (strVal.match(/^[a-f\d]{24}$/i)) {
            return (
                <div className="flex items-center gap-1 group">
                    <span title={strVal} className="font-mono text-xs text-blue-600 dark:text-blue-400 cursor-help border-b border-dashed border-blue-300">
                        ..{strVal.slice(-8)}
                    </span>
                    <button
                        onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(strVal); addToast('Copied ID', 'success'); }}
                        className="opacity-0 group-hover:opacity-100 hover:text-slate-900 dark:hover:text-slate-100 transition-opacity"
                    >
                        <Copy size={12} />
                    </button>
                </div>
            );
        }

        // Long string
        if (strVal.length > 40) {
            return <span title={strVal} className="cursor-help">{strVal.slice(0, 40)}...</span>;
        }

        return strVal;
    };

    // Helper components defined inline for simplicity
    const Badge = ({ children, success, danger, variant }) => {
        let classes = 'px-2 py-0.5 rounded text-xs font-medium ';
        if (success) classes += 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
        else if (danger) classes += 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
        else if (variant === 'secondary') classes += 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
        else classes += 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';

        return <span className={classes}>{children}</span>;
    };

    // Authorization Check
    if (user?.role !== 'admin') {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <div className="flex h-[calc(100vh-80px)] overflow-hidden -mx-4 -mt-4 bg-slate-50 dark:bg-slate-900">
            {/* Left Sidebar */}
            <div className="w-64 flex-shrink-0 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col h-full">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-white">
                        <Database size={20} className="text-blue-600" />
                        Database Explorer
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-mono">
                        DB: {dbStats?.databaseName || 'ecomonitor'}
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {loadingStats ? (
                        <div className="space-y-2 p-2">
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="h-10 bg-slate-100 dark:bg-slate-700 animate-pulse rounded"></div>
                            ))}
                        </div>
                    ) : (
                        <nav className="space-y-1">
                            {collectionList.map((col) => (
                                <button
                                    key={col.name}
                                    onClick={() => { setSelectedCollection(col.name); setParams(prev => ({ ...prev, page: 1, search: '', sortBy: '_id', order: 'desc' })); }}
                                    className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors ${selectedCollection === col.name
                                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-medium'
                                        : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/50'
                                        }`}
                                >
                                    <span className="capitalize">{col.name.replace(/([a-z])([A-Z])/g, '$1 $2')}</span>
                                    <span className={`text-xs ${selectedCollection === col.name ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
                                        {col.count}
                                    </span>
                                </button>
                            ))}
                        </nav>
                    )}
                </div>
            </div>

            {/* Main Panel */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-slate-900">
                {!selectedCollection ? (
                    // Default Landing View
                    <div className="flex-1 overflow-y-auto p-8">
                        <div className="mb-6 flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Database Overview</h1>
                                <p className="text-slate-500">Select a collection to view its contents</p>
                            </div>
                            {dbStats && (
                                <div className="flex gap-4">
                                    <Card>
                                        <div className="text-center px-4 py-2">
                                            <p className="text-xs uppercase text-slate-500 font-bold tracking-wider">Total Documents</p>
                                            <p className="text-2xl font-bold">{dbStats.totalDocuments.toLocaleString()}</p>
                                        </div>
                                    </Card>
                                </div>
                            )}
                        </div>

                        {loadingStats ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-32 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl border border-slate-200 dark:border-slate-700" />)}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {dbStats?.collections.map(col => (
                                    <div
                                        key={col.name}
                                        onClick={() => setSelectedCollection(col.name)}
                                        className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:shadow-md cursor-pointer transition-all group"
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                                                <Table2 size={20} />
                                            </div>
                                            <span className="text-2xl font-bold text-slate-800 dark:text-white">{col.count.toLocaleString()}</span>
                                        </div>
                                        <h3 className="font-semibold text-slate-700 dark:text-slate-200 capitalize truncate">{col.name}</h3>
                                        <p className="text-xs text-slate-400 mt-1">Avg size: {col.avgDocumentSize}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    // Collection Data View
                    <div className="flex flex-col h-full">
                        {/* Top Bar */}
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col sm:flex-row gap-4 justify-between items-center shrink-0">
                            <div>
                                <h1 className="text-xl font-bold text-slate-800 dark:text-white capitalize flex items-center gap-2">
                                    {selectedCollection}
                                    <Badge variant="secondary">{data.total} records</Badge>
                                </h1>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                {/* Search */}
                                <form onSubmit={handleSearchSubmit} className="relative">
                                    <input
                                        type="text"
                                        placeholder="Search collection..."
                                        value={params.search}
                                        onChange={(e) => setParams(p => ({ ...p, search: e.target.value }))}
                                        className="pl-9 pr-4 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none w-64"
                                    />
                                    <Search size={16} className="absolute left-3 top-2 text-slate-400" />
                                </form>

                                {/* Date Range (simple text inputs for strict UI without datepicker library if we want to restrict to native) */}
                                {data.fields.includes('createdAt') && (
                                    <div className="flex items-center gap-2">
                                        <input type="date" value={params.startDate} onChange={e => setParams(p => ({ ...p, startDate: e.target.value }))} className="py-1.5 px-3 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-transparent" title="Start Date" />
                                        <span className="text-slate-400">-</span>
                                        <input type="date" value={params.endDate} onChange={e => setParams(p => ({ ...p, endDate: e.target.value }))} className="py-1.5 px-3 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-transparent" title="End Date" />
                                    </div>
                                )}

                                {/* Sort By */}
                                <div className="flex items-center border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden bg-transparent">
                                    <select
                                        value={params.sortBy}
                                        onChange={(e) => setParams(p => ({ ...p, sortBy: e.target.value, page: 1 }))}
                                        className="py-1.5 px-3 text-sm bg-transparent border-none outline-none text-slate-700 dark:text-slate-300"
                                    >
                                        {data.fields.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                    <button
                                        onClick={() => setParams(p => ({ ...p, order: p.order === 'asc' ? 'desc' : 'asc' }))}
                                        className="p-1.5 border-l border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
                                    >
                                        <ChevronsUpDown size={16} />
                                    </button>
                                </div>

                                <Button variant="secondary" size="sm" onClick={fetchCollectionData} className="!py-1.5">
                                    <RefreshCw size={14} className={loadingData ? "animate-spin" : ""} />
                                </Button>
                            </div>
                        </div>

                        {/* Stats Bar */}
                        <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center shrink-0">
                            <span className="text-xs text-slate-500">
                                Showing {data.docs.length > 0 ? ((data.page - 1) * params.limit) + 1 : 0}–{Math.min(data.page * params.limit, data.total)} of {data.total} documents
                            </span>
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-slate-500">Per page:</span>
                                <select
                                    value={params.limit}
                                    onChange={(e) => setParams(p => ({ ...p, limit: Number(e.target.value), page: 1 }))}
                                    className="bg-transparent border border-slate-300 dark:border-slate-600 rounded px-1 py-0.5 outline-none"
                                >
                                    {[10, 20, 50, 100].map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Table Area */}
                        <div className="flex-1 overflow-auto bg-white dark:bg-slate-900 relative">
                            {loadingData ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-10">
                                    <RefreshCw className="animate-spin text-blue-500" size={32} />
                                </div>
                            ) : null}

                            {data.docs.length === 0 && !loadingData ? (
                                <div className="p-8 text-center text-slate-500">
                                    No documents found matching your criteria.
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse whitespace-nowrap">
                                    <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 shadow-sm z-20">
                                        <tr>
                                            {data.fields.map(field => (
                                                <th
                                                    key={field}
                                                    onClick={() => handleSort(field)}
                                                    className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                                                >
                                                    <div className="flex items-center gap-1">
                                                        {field}
                                                        {params.sortBy === field && (
                                                            <span className="text-blue-500">{params.order === 'asc' ? '↑' : '↓'}</span>
                                                        )}
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.docs.map((doc, idx) => (
                                            <tr
                                                key={doc._id}
                                                onClick={() => fetchDocumentDetail(doc._id)}
                                                className={`cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 border-b border-slate-100 dark:border-slate-800/50 ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/30'}`}
                                            >
                                                {data.fields.map(field => (
                                                    <td key={field} className="px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                                                        {renderCellValue(doc[field])}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Pagination Bar */}
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-between items-center shrink-0">
                            <span className="text-sm text-slate-500">Page {data.page} of {data.totalPages || 1}</span>
                            <div className="flex gap-1">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    disabled={!data.hasPrevPage}
                                    onClick={() => setParams(p => ({ ...p, page: p.page - 1 }))}
                                ><ChevronLeft size={16} /></Button>

                                <Button
                                    variant="secondary"
                                    size="sm"
                                    disabled={!data.hasNextPage}
                                    onClick={() => setParams(p => ({ ...p, page: p.page + 1 }))}
                                ><ChevronRight size={16} /></Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Document Detail Modal */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
                    <div
                        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-700"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <FileJson size={20} className="text-blue-500" />
                                    Document Detail
                                </h3>
                                <p className="text-xs text-slate-500 font-mono mt-1">_id: <span className="text-blue-600 dark:text-blue-400">{selectedDocId}</span></p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => copyToClipboard(selectedDocData)}
                                >
                                    {copied ? <Check size={16} className="text-green-500 mr-2" /> : <Copy size={16} className="mr-2" />}
                                    {copied ? 'Copied' : 'Copy JSON'}
                                </Button>
                                <button onClick={() => setModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto p-4 bg-slate-50 dark:bg-[#0d1117]">
                            {loadingDoc ? (
                                <div className="flex justify-center items-center h-40">
                                    <RefreshCw className="animate-spin text-blue-500" size={32} />
                                </div>
                            ) : (
                                <pre
                                    className="font-mono text-sm leading-relaxed whitespace-pre-wrap word-break"
                                    dangerouslySetInnerHTML={{ __html: highlightJSON(selectedDocData) }}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Extracted FileJson since it wasn't statically imported cleanly at top
const FileJson = ({ size, className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <path d="M10 13a2 2 0 0 0-2 2v1a2 2 0 0 1-2 2"></path>
        <path d="M14 13a2 2 0 0 1 2 2v1a2 2 0 0 0 2 2"></path>
    </svg>
);

export default DatabaseViewer;
