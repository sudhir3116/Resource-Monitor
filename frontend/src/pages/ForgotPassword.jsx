import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Mail, ArrowLeft, Loader2, Key } from 'lucide-react';
import api from '../api';


export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    setLoading(true);
    try {
      const response = await api.post('/api/auth/forgot', { email });
      setMsg('If an account exists with this email, a reset link has been generated.');
      // Special handling for dev environment if token is returned
      if (response.data?.token) {
        setMsg(m => m + ` (Dev Mode: ${response.data.token})`);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-slate-50 items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white p-10 rounded-[32px] shadow-2xl border border-slate-100 ring-1 ring-slate-100"
      >
        <div className="text-center mb-10">
          <div className="h-16 w-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Key size={32} />
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Forgot password?</h2>
          <p className="mt-2 text-slate-500 font-medium">No worries, we'll send you reset instructions.</p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Input
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@college.edu"
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="p-4 bg-rose-50 text-rose-600 text-sm rounded-xl border border-rose-100 font-bold flex items-center gap-2">
                ⚠️ {error}
              </motion.div>
            )}
            {msg && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="p-4 bg-emerald-50 text-emerald-700 text-sm rounded-xl border border-emerald-100 font-bold flex items-center gap-2">
                ✨ {msg}
              </motion.div>
            )}
          </AnimatePresence>

          <Button type="submit" className="w-full h-12 text-base font-black shadow-lg shadow-indigo-200" disabled={loading}>
            {loading ? <Loader2 className="animate-spin mr-2" size={20} /> : <Mail className="mr-2" size={20} />}
            {loading ? 'Sending Request...' : 'Send Reset Link'}
          </Button>

          <Link to="/login" className="flex items-center justify-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors mt-6">
            <ArrowLeft size={16} /> Back to Login
          </Link>
        </form>
      </motion.div>
    </div>
  );
}
