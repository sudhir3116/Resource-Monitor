import React from 'react';
import { Link } from 'react-router-dom';
import { Home, ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';


export default function NotFound() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4">
            <div className="max-w-md w-full text-center">
                {/* Error Icon */}
                <div className="mb-8 flex justify-center">
                    <div className="relative">
                        <div className="absolute inset-0 bg-red-500/20 dark:bg-red-500/10 rounded-full blur-xl"></div>
                        <div className="relative bg-red-100 dark:bg-red-950 p-6 rounded-full inline-block">
                            <AlertCircle className="w-16 h-16 text-red-600 dark:text-red-400" strokeWidth={1.5} />
                        </div>
                    </div>
                </div>

                {/* Error Code */}
                <h1 className="text-8xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">
                    404
                </h1>

                {/* Error Message */}
                <h2 className="text-2xl font-semibold text-slate-700 dark:text-slate-300 mb-3">
                    Page Not Found
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
                    The page you're looking for doesn't exist or has been moved.
                    Please check the URL or return to the dashboard.
                </p>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button
                        onClick={() => window.history.back()}
                        variant="outline"
                        className="gap-2"
                    >
                        <ArrowLeft size={16} />
                        Go Back
                    </Button>
                    <Link to="/dashboard">
                        <Button className="gap-2 w-full sm:w-auto">
                            <Home size={16} />
                            Dashboard
                        </Button>
                    </Link>
                </div>

                {/* Additional Info */}
                <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800">
                    <p className="text-sm text-slate-500 dark:text-slate-500">
                        Error Code: <span className="font-mono">404_PAGE_NOT_FOUND</span>
                    </p>
                </div>
            </div>
        </div>
    );
}
