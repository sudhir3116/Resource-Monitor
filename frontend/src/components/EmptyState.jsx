import React from 'react'

export default function EmptyState({
    icon = '📂',
    title = 'No Data Found',
    description = 'There are no records to display at the moment.',
    action = null
}) {
    return (
        <div className="empty-card">
            <div className="empty-icon">{icon}</div>
            <div className="empty-title">{title}</div>
            <div className="empty-desc">{description}</div>
            {action && <div>{action}</div>}
        </div>
    )
}
