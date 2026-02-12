import React, { useEffect, useState, useMemo, useContext } from 'react'
import api from '../services/api'
import Loading from '../components/Loading'
import UsageFilter from '../components/UsageFilter'
import { useToast } from '../context/ToastContext'
import EmptyState from '../components/EmptyState'
import { AuthContext } from '../context/AuthContext'
import Modal from '../components/Modal'

export default function Reports() {
  const [usages, setUsages] = useState([]) // All fetched usages
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { addToast } = useToast()
  const { user } = useContext(AuthContext)

  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState(null)

  // Filters from UsageFilter
  const [apiFilters, setApiFilters] = useState({})
  // Local Search
  const [searchTerm, setSearchTerm] = useState('')
  // Pagination
  const [page, setPage] = useState(1)
  const itemsPerPage = 10
  // Sorting
  const [sortConfig, setSortConfig] = useState({ key: 'usage_date', direction: 'desc' })

  useEffect(() => { load() }, [apiFilters])

  async function load() {
    setLoading(true);
    try {
      // Construct Query from apiFilters
      let query = '?'
      if (apiFilters.resource) query += `resource=${apiFilters.resource}&`
      if (apiFilters.category) query += `category=${apiFilters.category}&`
      if (apiFilters.start) query += `start=${apiFilters.start}&`
      if (apiFilters.end) query += `end=${apiFilters.end}&`
      // Default api sort
      query += `sort=${apiFilters.sort || 'usage_date:desc'}&`

      const d = await api.get(`/api/usage${query}`);
      setUsages(d.usages || [])
      setPage(1) // Reset to page 1 on new fetch
    } catch (e) {
      setError(e.message)
      addToast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  // Handle Client-Side Search, Sort & Pagination
  const processedData = useMemo(() => {
    let data = [...usages]

    // 1. Search
    if (searchTerm) {
      const lower = searchTerm.toLowerCase()
      data = data.filter(u =>
        u.resource_type.toLowerCase().includes(lower) ||
        (u.category && u.category.toLowerCase().includes(lower)) ||
        (u.notes && u.notes.toLowerCase().includes(lower))
      )
    }

    // 2. Sort
    if (sortConfig.key) {
      data.sort((a, b) => {
        const aVal = a[sortConfig.key] || ''
        const bVal = b[sortConfig.key] || ''
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    }

    return data
  }, [usages, searchTerm, sortConfig])

  const paginatedData = processedData.slice((page - 1) * itemsPerPage, page * itemsPerPage)
  const totalPages = Math.ceil(processedData.length / itemsPerPage)

  const handleSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'
    setSortConfig({ key, direction })
  }

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <span style={{ opacity: 0.3 }}>⇅</span>
    return sortConfig.direction === 'asc' ? '↑' : '↓'
  }

  // Helper for units
  const getUnit = (type) => {
    switch (type) {
      case 'Electricity': return 'kWh'
      case 'Water': return 'L'
      case 'Diesel': return 'L'
      case 'LPG': return 'kg'
      case 'Food': return 'kg'
      case 'Waste': return 'kg'
      default: return 'units'
    }
  }

  // Exports
  function downloadCSV() {
    const token = sessionStorage.getItem('token')
    const url = (import.meta.env.VITE_API_URL || 'http://localhost:4000') + '/api/reports/usages/csv'

    // Use fetch for auth header
    fetch(url, { headers: { Authorization: token ? `Bearer ${token}` : '' } })
      .then(r => r.blob())
      .then(blob => {
        const u = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = u
        link.download = `usages_report_${new Date().toISOString().slice(0, 10)}.csv`
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(u)
        addToast('CSV Download Started')
      })
      .catch(() => addToast('Download failed', 'error'))
  }

  function printReport() {
    window.print()
  }

  // Delete Handlers
  const handleDeleteClick = (u) => {
    setSelectedRecord(u)
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!selectedRecord) return
    try {
      // Use api.del since the service defines 'del', not 'delete'
      await api.del('/api/usage/' + selectedRecord._id)
      addToast('Usage record deleted successfully', 'success')
      setShowDeleteModal(false)
      setSelectedRecord(null)
      load() // Refresh data
    } catch (e) {
      addToast(e.message || 'Delete failed', 'error')
    }
  }

  const totalRecords = processedData.length
  const totalUsage = processedData.reduce((s, u) => s + (Number(u.usage_value) || 0), 0)
  const uniqueResources = Array.from(new Set(processedData.map(u => u.resource_type))).length

  // Render content logic to simplify JSX
  const renderContent = () => {
    if (loading) return <Loading />
    if (error) return <div className="error">{error}</div>

    return (
      <div>
        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-value">{totalRecords}</div>
            <div className="stat-label">Records Found</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{totalUsage.toLocaleString()}</div>
            <div className="stat-label">Total Units</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{uniqueResources}</div>
            <div className="stat-label">Resources</div>
          </div>
        </div>

        {/* Table */}
        <div className="card">
          <div className="table-wrap">
            {paginatedData.length > 0 ? (
              <table className="usage-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('resource_type')} style={{ cursor: 'pointer' }}>Resource {getSortIcon('resource_type')}</th>
                    <th onClick={() => handleSort('category')} style={{ cursor: 'pointer' }}>Category {getSortIcon('category')}</th>
                    <th onClick={() => handleSort('usage_value')} style={{ cursor: 'pointer' }}>Value {getSortIcon('usage_value')}</th>
                    <th onClick={() => handleSort('usage_date')} style={{ cursor: 'pointer' }}>Date {getSortIcon('usage_date')}</th>
                    <th>Notes</th>
                    <th style={{ width: 100 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map(u => (
                    <tr key={u._id}>
                      <td>
                        <span style={{ marginRight: 8 }}>{
                          u.resource_type === 'Electricity' ? '⚡' :
                            u.resource_type === 'Water' ? '💧' :
                              u.resource_type === 'Food' ? '🍽' :
                                u.resource_type === 'LPG' ? '🔥' :
                                  u.resource_type === 'Diesel' ? '🛢' : '♻'
                        }</span>
                        {u.resource_type}
                      </td>
                      <td>{u.category || '-'}</td>
                      <td style={{ fontWeight: 600 }}>{u.usage_value} <span style={{ fontSize: 10, color: 'var(--muted)' }}>{getUnit(u.resource_type)}</span></td>
                      <td style={{ color: 'var(--muted)' }}>{new Date(u.usage_date).toLocaleString()}</td>
                      <td style={{ maxWidth: '200px' }} className="truncate">{u.notes}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="action-btn" title="Edit">✎</button>
                          {user?.role === 'admin' && (
                            <button
                              className="action-btn delete"
                              onClick={() => handleDeleteClick(u)}
                              title="Delete"
                            >
                              🗑
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <EmptyState icon="📉" title="No Records" description="No data matches your criteria." />}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="pagination" style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 10 }}>
              <button className="btn small secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
              <span style={{ alignSelf: 'center', fontSize: 14 }}>Page {page} of {totalPages}</span>
              <button className="btn small secondary" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Reports</h2>
          <div className="muted">Professional, exportable reports for your usage data</div>
        </div>
        <div className="report-actions">
          <button onClick={downloadCSV} className="btn small">Download CSV</button>
          <button onClick={printReport} className="btn secondary small">Print</button>
        </div>
      </div>

      {/* Filter and Search Section */}
      <UsageFilter filters={apiFilters} onFilterChange={setApiFilters} />

      <div className="search-bar" style={{ marginBottom: 20 }}>
        <input
          type="text"
          className="search-input input"
          style={{ maxWidth: 300 }}
          placeholder="Search within results..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {renderContent()}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Confirm Deletion"
      >
        <p>Are you sure you want to delete this usage record?</p>
        <div style={{ background: 'rgba(0,0,0,0.03)', padding: 12, borderRadius: 8, margin: '12px 0', fontSize: 14 }}>
          <div><strong>Resource:</strong> {selectedRecord?.resource_type}</div>
          <div><strong>Value:</strong> {selectedRecord?.usage_value} {selectedRecord && getUnit(selectedRecord.resource_type)}</div>
          <div><strong>Date:</strong> {selectedRecord && new Date(selectedRecord.usage_date).toLocaleString()}</div>
        </div>
        <p style={{ color: 'var(--danger)', fontWeight: 500, fontSize: 14 }}>
          This action cannot be undone.
        </p>

        <div className="modal-footer" style={{ marginTop: 20, padding: 0, borderTop: 0, background: 'none' }}>
          <button className="btn secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
          <button className="btn-danger" onClick={confirmDelete}>Confirm Delete</button>
        </div>
      </Modal>
    </div>
  )
}
