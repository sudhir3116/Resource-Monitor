import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function MainLayout({ children }) {
    return (
        <div className="main-layout">
            <Sidebar />
            <Header />
            <main className="main-content">
                <div className="content-container">
                    {children || <Outlet />}
                </div>
            </main>
        </div>
    );
}
