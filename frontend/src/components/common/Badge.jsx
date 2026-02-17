import React from 'react';

export default function Badge({
    children,
    variant = 'primary',
    className = ''
}) {
    const variantClass = `badge-${variant}`;

    return (
        <span className={`badge ${variantClass} ${className}`}>
            {children}
        </span>
    );
}
