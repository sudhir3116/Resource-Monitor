import React from 'react';

export default function EmptyState({
    icon = '📂',
    title = 'No Data Found',
    message = 'There are no records to display at the moment.',
    description = '',
    action = null
}) {
    // Allow either message or description prop
    const displayText = message || description;

    return (
        <div className="empty-state">
            <div className="empty-state-icon">{icon}</div>
            <div className="empty-state-title">{title}</div>
            <div className="empty-state-text">{displayText}</div>
            {action && <div style={{ marginTop: 16 }}>{action}</div>}
        </div>
    );
}

