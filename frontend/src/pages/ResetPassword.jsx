import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Lock, ArrowLeft, Loader2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import api from '../api';
import ThemeToggle from '../components/ThemeToggle';


export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    setLoading(true);

    if (password !== confirm) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      await api.post(`/api/auth/reset/${token}`, { password });
      setMsg('Password has been reset successfully. Redirecting you to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-slate-50 dark:bg-slate-950 items-center justify-center p-6 relative">
      <div className="absolute top-8 right-8">
        <ThemeToggle />
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white dark:bg-slate-900 p-10 rounded-[40px] shadow-2xl border border-slate-100 dark:border-slate-800 ring-1 ring-slate-100 dark:ring-slate-800"
      >
        <div className="text-center mb-10">
          <div className="h-20 w-20 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner ring-1 ring-emerald-100 dark:ring-emerald-900/30">
            <Lock size={32} />
          </div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Set New Password</h2>
          <p className="mt-2 text-slate-500 font-medium">Please enter a strong password to secure your account.</p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Input
              label="New Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Min 6 characters"
              disabled={!!msg}
            />
            <Input
              label="Confirm New Password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              placeholder="Type it again"
              disabled={!!msg}
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="p-4 bg-rose-50 text-rose-600 text-sm rounded-xl border border-rose-100 font-bold flex items-center gap-2">
                ⚠️ {error}
              </motion.div>
            )}
            {msg && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="p-4 bg-emerald-50 text-emerald-700 text-sm rounded-xl border border-emerald-100 font-bold flex items-center gap-2">
                <CheckCircle2 size={18} /> {msg}
              </motion.div>
            )}
          </AnimatePresence>

          {!msg && (
            <Button type="submit" className="w-full h-12 text-base font-black shadow-lg shadow-indigo-200" disabled={loading}>
              {loading ? <Loader2 className="animate-spin mr-2" size={20} /> : <ShieldCheck className="mr-2" size={20} />}
              {loading ? 'Updating Password...' : 'Reset Password'}
            </Button>
          )}

          <div className="text-center pt-4">
            <Link to="/login" className="text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors inline-flex items-center gap-2">
              <ArrowLeft size={16} /> Back to Login
            </Link>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
