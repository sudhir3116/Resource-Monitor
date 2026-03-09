import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';

const GMDashboard = () => {
    const { user } = useContext(AuthContext);

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">GM Dashboard</h1>
            <p>Welcome, {user?.name}</p>
        </div>
    );
};

export default GMDashboard;
