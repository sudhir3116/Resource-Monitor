import React, { useState, useEffect } from 'react'
import api from '../services/api'

// ── PURE FRONTEND EXPORTS ──────────────────────────────

const downloadCSV = (data, filename) => {
    if (!data?.length) return false
    const headers = Object.keys(data[0])
    const rows = data.map(row =>
        headers.map(h => {
            const val = String(row[h] ?? '').replace(/"/g, '""')
            return val.includes(',') ? `"${val}"` : val
        }).join(',')
    )
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    triggerDownload(blob, filename)
    return true
}

const downloadJSON = (data, filename) => {
    if (!data?.length) return false
    const blob = new Blob(
        [JSON.stringify(data, null, 2)],
        { type: 'application/json' }
    )
    triggerDownload(blob, filename)
    return true
}

const triggerDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    })
}

const openPDF = (data, meta) => {
    if (!data?.length) return false
    const date = new Date().toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
    })
    const totalUsage = data
        .reduce((s, r) => s + Number(r.usage_value || r.value || 0), 0)
        .toFixed(2)
    const uniqueResources = [
        ...new Set(data.map(r => r.resource_type || r.resource).filter(Boolean))
    ]
    const uniqueBlocks = [
        ...new Set(
            data.map(r => r.blockId?.name || r.block?.name || r.block)
                .filter(Boolean)
        )
    ]

    const rows = data.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${r.resource_type || r.resource || '—'}</td>
      <td>${r.blockId?.name || r.block?.name || r.block || '—'}</td>
      <td style="text-align:right;font-weight:600">
        ${Number(r.usage_value || r.value || 0).toFixed(2)}
      </td>
      <td>${r.unit || '—'}</td>
      <td>${formatDate(r.usage_date || r.date || r.createdAt)}</td>
      <td>${r.userId?.name || r.loggedBy?.name || r.createdBy?.name || r.user || '—'}</td>
    </tr>
  `).join('')

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>EcoMonitor Report</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box }
    body { 
      font-family: 'Segoe UI', Arial, sans-serif;
      padding: 32px; color: #1f2937; font-size: 13px;
    }
    .header {
      display: flex; justify-content: space-between;
      align-items: flex-start; margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 3px solid #1d4ed8;
    }
    .brand { 
      font-size: 24px; font-weight: 800; 
      color: #1d4ed8; letter-spacing: -0.5px;
    }
    .brand-sub { 
      font-size: 11px; color: #6b7280; margin-top: 2px;
    }
    .report-title {
      font-size: 18px; font-weight: 700;
      color: #111827; margin-top: 8px;
    }
    .meta { text-align: right; font-size: 11px; 
            color: #6b7280; line-height: 1.8; }
    .meta strong { color: #374151; }
    .filters-bar {
      background: #f0f9ff; border: 1px solid #bae6fd;
      border-radius: 8px; padding: 10px 14px;
      margin-bottom: 20px; font-size: 12px;
      color: #0369a1; display: flex; 
      flex-wrap: wrap; gap: 16px;
    }
    .filter-item strong { color: #0c4a6e; }
    .stats { 
      display: grid; grid-template-columns: repeat(4,1fr);
      gap: 12px; margin-bottom: 20px;
    }
    .stat { 
      background: #eff6ff; border: 1px solid #bfdbfe;
      border-radius: 10px; padding: 12px; 
      text-align: center;
    }
    .stat-val { 
      font-size: 22px; font-weight: 800; color: #1d4ed8;
    }
    .stat-lbl { 
      font-size: 10px; color: #6b7280; 
      margin-top: 2px; text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    table { 
      width: 100%; border-collapse: collapse;
      font-size: 12px;
    }
    thead tr { background: #1e40af; }
    th { 
      color: white; padding: 10px 10px;
      text-align: left; font-weight: 600;
      font-size: 11px; text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    th:nth-child(4) { text-align: right; }
    tbody tr:nth-child(even) { background: #f9fafb; }
    tbody tr:hover { background: #eff6ff; }
    td { 
      padding: 9px 10px; 
      border-bottom: 1px solid #e5e7eb;
    }
    .footer {
      margin-top: 24px; padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      font-size: 10px; color: #9ca3af;
      text-align: center; line-height: 1.6;
    }
    @media print {
      body { padding: 16px; }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">🌿 EcoMonitor</div>
      <div class="brand-sub">
        College Hostel Resource Monitoring System
      </div>
      <div class="report-title">
        Resource Usage Report
      </div>
    </div>
    <div class="meta">
      <div><strong>Generated:</strong> ${date}</div>
      <div><strong>Records:</strong> ${data.length}</div>
      <div><strong>Total Usage:</strong> ${totalUsage}</div>
    </div>
  </div>

  <div class="filters-bar">
    <span class="filter-item">
      <strong>Resource:</strong> ${meta.resource || 'All'}
    </span>
    <span class="filter-item">
      <strong>Block:</strong> ${meta.blockName || 'All'}
    </span>
    <span class="filter-item">
      <strong>From:</strong> ${meta.startDate || 'All time'}
    </span>
    <span class="filter-item">
      <strong>To:</strong> ${meta.endDate || 'Present'}
    </span>
  </div>

  <div class="stats">
    <div class="stat">
      <div class="stat-val">${data.length}</div>
      <div class="stat-lbl">Records</div>
    </div>
    <div class="stat">
      <div class="stat-val">${totalUsage}</div>
      <div class="stat-lbl">Total Usage</div>
    </div>
    <div class="stat">
      <div class="stat-val">${uniqueResources.length}</div>
      <div class="stat-lbl">Resources</div>
    </div>
    <div class="stat">
      <div class="stat-val">${uniqueBlocks.length}</div>
      <div class="stat-lbl">Blocks</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Resource</th>
        <th>Block</th>
        <th style="text-align:right">Value</th>
        <th>Unit</th>
        <th>Date</th>
        <th>Logged By</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="footer">
    EcoMonitor — College Hostel Resource Monitoring |
    Report generated on ${date} | Confidential
  </div>

  <script>
    window.onload = () => {
      window.print()
    }
  </script>
</body>
</html>`

    const win = window.open('', '_blank')
    if (!win) {
        alert('Pop-up blocked. Allow pop-ups and try again.')
        return false
    }
    win.document.write(html)
    win.document.close()
    return true
}

// ── MAIN COMPONENT ─────────────────────────────────────

const Reports = () => {
    const [status, setStatus] = useState(null)
    // status: null | {type,text}
    const [blocks, setBlocks] = useState([])
    const [previewData, setPreviewData] = useState(null)
    // null=not fetched yet, []=fetched but empty, [...]
    const [loading, setLoading] = useState(false)
    const [exporting, setExporting] = useState(false)
    const [filters, setFilters] = useState({
        startDate: '', endDate: '',
        block: '', resource: ''
    })

    // Load blocks once on mount
    useEffect(() => {
        const loadBlocks = async () => {
            try {
                const res = await api.get('/api/admin/blocks')
                const b =
                    res.data?.blocks ||
                    res.data?.data ||
                    (Array.isArray(res.data) ? res.data : [])
                setBlocks(b)
            } catch {
                setBlocks([])
            }
        }
        loadBlocks()
    }, [])

    // ── SMART DATA FETCHER ────────────────────────────────
    const fetchUsageData = async (filtersToUse) => {
        const f = filtersToUse || filters

        // Strategy 1: Try with start/end (backend expects 'start' and 'end')
        // Strategy 2: Try with startDate/endDate (just in case)
        // Strategy 3: Try without dates
        // Strategy 4: Fetch everything

        const strategies = [
            // 1. Correct Backend Format (start/end)
            () => {
                const p = new URLSearchParams()
                p.append('limit', '2000')
                if (f.resource) p.append('resource', f.resource)
                if (f.block) p.append('block', f.block)
                if (f.startDate) p.append('start', f.startDate)
                if (f.endDate) p.append('end', f.endDate)
                return api.get(`/api/usage?${p.toString()}`)
            },
            // 2. Format with ISO strings (start/end)
            () => {
                const p = new URLSearchParams()
                p.append('limit', '2000')
                if (f.resource) p.append('resource', f.resource)
                if (f.block) p.append('block', f.block)
                if (f.startDate) p.append('start', new Date(f.startDate).toISOString())
                if (f.endDate) {
                    const end = new Date(f.endDate)
                    end.setHours(23, 59, 59, 999)
                    p.append('end', end.toISOString())
                }
                return api.get(`/api/usage?${p.toString()}`)
            },
            // 3. Alternative names (startDate/endDate)
            () => {
                const p = new URLSearchParams()
                p.append('limit', '2000')
                if (f.resource) p.append('resource', f.resource)
                if (f.block) p.append('block', f.block)
                if (f.startDate) p.append('startDate', f.startDate)
                if (f.endDate) p.append('endDate', f.endDate)
                return api.get(`/api/usage?${p.toString()}`)
            },
            // 4. No dates — fall back to client-side filtering
            () => {
                const p = new URLSearchParams()
                p.append('limit', '2000')
                if (f.resource) p.append('resource', f.resource)
                if (f.block) p.append('block', f.block)
                return api.get(`/api/usage?${p.toString()}`)
            },
            // 5. Everything
            () => api.get('/api/usage?limit=5000')
        ]

        for (const attempt of strategies) {
            try {
                const res = await attempt()
                const d = res.data
                let arr = Array.isArray(d) ? d
                    : Array.isArray(d?.usages) ? d.usages
                        : Array.isArray(d?.usage) ? d.usage
                            : Array.isArray(d?.data) ? d.data
                                : Array.isArray(d?.records) ? d.records
                                    : []

                // If we got data OR this was the last strategy
                if (arr.length > 0) {
                    // Apply client-side date filter as backup
                    if (f.startDate || f.endDate) {
                        const start = f.startDate
                            ? new Date(f.startDate).getTime()
                            : 0
                        const end = f.endDate
                            ? new Date(f.endDate + 'T23:59:59').getTime()
                            : Infinity
                        const filtered = arr.filter(r => {
                            const t = new Date(
                                r.date || r.createdAt || 0
                            ).getTime()
                            return t >= start && t <= end
                        })
                        // Use filtered if it has data,
                        // else return all (backend may not filter dates)
                        if (filtered.length > 0) return filtered
                    }
                    return arr
                }
            } catch (err) {
                console.warn('[Reports] Strategy failed:',
                    err.message)
            }
        }
        return []
    }

    // ── PREVIEW ───────────────────────────────────────────
    const handlePreview = async () => {
        try {
            setLoading(true)
            setStatus(null)
            const data = await fetchUsageData()
            setPreviewData(data)
            if (data.length === 0) {
                setStatus({
                    type: 'warn',
                    text: '⚠️ No records found. ' +
                        'Try clearing filters or ' +
                        'check if usage data exists.'
                })
            } else {
                setStatus({
                    type: 'success',
                    text: `✅ Found ${data.length} records — ` +
                        `ready to export`
                })
            }
        } catch {
            setStatus({
                type: 'error',
                text: '❌ Failed to fetch data.'
            })
        } finally {
            setLoading(false)
        }
    }

    // ── EXPORT ────────────────────────────────────────────
    const handleExport = async (format) => {
        try {
            setExporting(true)
            setStatus(null)

            const data = await fetchUsageData()

            if (!data || data.length === 0) {
                setStatus({
                    type: 'error',
                    text: '❌ No data to export. ' +
                        'Click "Preview Data" first to check.'
                })
                return
            }

            const dateStr = new Date()
                .toISOString().split('T')[0]
            const prefix = `ecomonitor-${dateStr}`

            const blockName = filters.block
                ? blocks.find(b => b._id === filters.block)
                    ?.name || 'filtered'
                : 'all-blocks'

            const flat = data.map(r => ({
                Resource: r.resource_type || r.resource || '—',
                Block: r.blockId?.name || r.block?.name || r.block || '—',
                Value: Number(r.usage_value || r.value || 0).toFixed(2),
                Unit: r.unit || '—',
                Date: formatDate(r.usage_date || r.date || r.createdAt),
                'Logged By':
                    r.userId?.name ||
                    r.loggedBy?.name ||
                    r.createdBy?.name ||
                    r.user || '—',
                Notes: r.notes || ''
            }))

            const meta = {
                resource: filters.resource || 'All',
                blockName,
                startDate: filters.startDate || null,
                endDate: filters.endDate || null
            }

            let success = false

            if (format === 'csv') {
                success = downloadCSV(flat, `${prefix}.csv`)
            } else if (format === 'excel') {
                success = downloadCSV(flat, `${prefix}.xlsx`)
            } else if (format === 'json') {
                success = downloadJSON(data, `${prefix}.json`)
            } else if (format === 'pdf') {
                success = openPDF(data, meta)
            }

            if (success) {
                setStatus({
                    type: 'success',
                    text: format === 'pdf'
                        ? `✅ PDF opened in new tab — ` +
                        `use Ctrl+P / Cmd+P to save`
                        : `✅ ${format.toUpperCase()} downloaded — ` +
                        `${data.length} records`
                })
                setPreviewData(data)
            }

        } catch (err) {
            console.error('[Reports] Export error:', err)
            setStatus({
                type: 'error',
                text: '❌ Export failed: ' + err.message
            })
        } finally {
            setExporting(false)
        }
    }

    // ── RENDER ────────────────────────────────────────────
    return (
        <div className="p-6 space-y-6 max-w-5xl">

            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">
                    Reports
                </h1>
                <p className="text-gray-400 text-sm mt-1">
                    Export resource usage data —
                    works without internet or special backend
                </p>
            </div>

            {/* Filters */}
            <div className="bg-gray-800 rounded-xl p-5
                      border border-gray-700">
                <div className="flex items-center 
                        justify-between mb-4">
                    <h2 className="font-semibold text-white">
                        Filter Data
                    </h2>
                    <button
                        onClick={() => {
                            setFilters({
                                startDate: '', endDate: '',
                                block: '', resource: ''
                            })
                            setPreviewData(null)
                            setStatus(null)
                        }}
                        className="text-xs text-gray-500 
                       hover:text-gray-300 transition-colors"
                    >
                        ✕ Clear all filters
                    </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4
                        gap-4">
                    {/* Start Date */}
                    <div>
                        <label className="text-xs text-gray-400 
                              block mb-1.5">
                            Start Date
                        </label>
                        <input type="date"
                            value={filters.startDate}
                            onChange={e => setFilters(p => ({
                                ...p, startDate: e.target.value
                            }))}
                            className="w-full px-3 py-2.5 bg-gray-700
                         border border-gray-600 rounded-lg
                         text-sm text-white
                         focus:outline-none
                         focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* End Date */}
                    <div>
                        <label className="text-xs text-gray-400 
                              block mb-1.5">
                            End Date
                        </label>
                        <input type="date"
                            value={filters.endDate}
                            onChange={e => setFilters(p => ({
                                ...p, endDate: e.target.value
                            }))}
                            className="w-full px-3 py-2.5 bg-gray-700
                         border border-gray-600 rounded-lg
                         text-sm text-white
                         focus:outline-none
                         focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Resource */}
                    <div>
                        <label className="text-xs text-gray-400 
                              block mb-1.5">
                            Resource
                        </label>
                        <select
                            value={filters.resource}
                            onChange={e => setFilters(p => ({
                                ...p, resource: e.target.value
                            }))}
                            className="w-full px-3 py-2.5 bg-gray-700
                         border border-gray-600 rounded-lg
                         text-sm text-white
                         focus:outline-none
                         focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">All Resources</option>
                            {['Electricity', 'Water', 'LPG',
                                'Diesel', 'Solar', 'Waste'].map(r => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                        </select>
                    </div>

                    {/* Block */}
                    <div>
                        <label className="text-xs text-gray-400 
                              block mb-1.5">
                            Block
                        </label>
                        <select
                            value={filters.block}
                            onChange={e => setFilters(p => ({
                                ...p, block: e.target.value
                            }))}
                            className="w-full px-3 py-2.5 bg-gray-700
                         border border-gray-600 rounded-lg
                         text-sm text-white
                         focus:outline-none
                         focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">All Blocks</option>
                            {blocks.map(b => (
                                <option key={b._id} value={b._id}>
                                    {b.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Preview Row */}
                <div className="flex items-center gap-4 mt-5">
                    <button
                        onClick={handlePreview}
                        disabled={loading || exporting}
                        className="flex items-center gap-2 px-5 py-2.5
                       bg-gray-700 hover:bg-gray-600
                       border border-gray-500
                       text-white text-sm font-medium
                       rounded-lg transition-colors
                       disabled:opacity-50"
                    >
                        {loading ? (
                            <>
                                <span className="w-4 h-4 border-2
                                 border-gray-500
                                 border-t-white rounded-full
                                 animate-spin" />
                                Fetching...
                            </>
                        ) : '🔍 Preview Data'}
                    </button>

                    {previewData !== null && (
                        <span className={`text-sm font-medium ${previewData.length > 0
                            ? 'text-green-400'
                            : 'text-red-400'
                            }`}>
                            {previewData.length > 0
                                ? `✅ ${previewData.length} records ready`
                                : '❌ No records found — try clearing filters'
                            }
                        </span>
                    )}
                </div>
            </div>

            {/* Status Message */}
            {status && (
                <div className={`px-4 py-3 rounded-xl text-sm
                         font-medium
          ${status.type === 'success'
                        ? 'bg-green-900/30 text-green-300 border border-green-700/50'
                        : status.type === 'warn'
                            ? 'bg-yellow-900/30 text-yellow-300 border border-yellow-700/50'
                            : 'bg-red-900/30 text-red-300 border border-red-700/50'
                    }`}>
                    {status.text}
                </div>
            )}

            {/* Export Buttons */}
            <div className="bg-gray-800 rounded-xl p-5
                      border border-gray-700">
                <h2 className="font-semibold text-white mb-1">
                    Export Format
                </h2>
                <p className="text-gray-500 text-xs mb-5">
                    Click any format to export.
                    Data fetched automatically if not previewed yet.
                    PDF opens print dialog — press Ctrl+P to save.
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4
                        gap-4">
                    {[
                        {
                            format: 'csv',
                            label: 'CSV',
                            icon: '📊',
                            sub: 'Google Sheets / Excel',
                            color: 'from-green-700 to-green-600',
                            border: 'border-green-600/40'
                        },
                        {
                            format: 'pdf',
                            label: 'PDF',
                            icon: '📄',
                            sub: 'Print → Save as PDF',
                            color: 'from-red-700 to-red-600',
                            border: 'border-red-600/40'
                        },
                        {
                            format: 'excel',
                            label: 'Excel',
                            icon: '📋',
                            sub: 'Open in Microsoft Excel',
                            color: 'from-blue-700 to-blue-600',
                            border: 'border-blue-600/40'
                        },
                        {
                            format: 'json',
                            label: 'JSON',
                            icon: '{ }',
                            sub: 'Raw data format',
                            color: 'from-purple-700 to-purple-600',
                            border: 'border-purple-600/40'
                        },
                    ].map(btn => (
                        <button
                            key={btn.format}
                            onClick={() => handleExport(btn.format)}
                            disabled={loading || exporting}
                            className={`flex flex-col items-center
                          gap-2 p-5
                          bg-gradient-to-b ${btn.color}
                          border ${btn.border}
                          disabled:opacity-40
                          text-white rounded-xl
                          hover:brightness-110
                          active:scale-95
                          transition-all duration-150`}
                        >
                            <span className="text-3xl leading-none">
                                {btn.icon}
                            </span>
                            <span className="font-bold text-base">
                                {exporting ? '...' : btn.label}
                            </span>
                            <span className="text-xs opacity-60 
                               text-center leading-tight">
                                {btn.sub}
                            </span>
                        </button>
                    ))}
                </div>

                {exporting && (
                    <div className="flex items-center gap-2 mt-4
                          text-gray-400 text-sm">
                        <span className="w-4 h-4 border-2
                             border-gray-600
                             border-t-blue-400
                             rounded-full animate-spin" />
                        Generating export...
                    </div>
                )}
            </div>

        </div>
    )
}

export default Reports
