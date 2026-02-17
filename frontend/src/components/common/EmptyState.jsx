import React from 'react';

export default function EmptyState({ icon, title, description, action }) {
    return (
        <div className="empty-state">
            {icon && (
                <div className="empty-state-icon">
                    {icon}
                </div>
            )}
            <h3 className="empty-state-title">{title}</h3>
            {description && (
                <p className="empty-state-description">{description}</p>
            )}
            {action && (
                <div className="mt-4">
                    {action}
                </div>
            )}
        </div>
    );
}
