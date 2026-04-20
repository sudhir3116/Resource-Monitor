import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';

const Unauthorized = () => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-[80vh] p-4">
      <Card className="max-w-md w-full text-center border-rose-200 bg-rose-50/10">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-rose-100/50 rounded-full flex items-center justify-center">
            <ShieldAlert size={32} className="text-rose-500" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          Access Denied
        </h1>
        <p className="text-slate-500 mb-8">
          You do not have the required permissions to view this page. If you believe this is an error, please contact the system administrator.
        </p>
        <div className="flex justify-center gap-4">
          <Button variant="secondary" onClick={() => navigate(-1)}>
            <ArrowLeft size={18} className="mr-2" /> Go Back
          </Button>
          <Button variant="primary" onClick={() => navigate('/dashboard')}>
            Dashboard
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default Unauthorized;
