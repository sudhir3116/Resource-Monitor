import React, { useState, useContext } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Activity, Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';

export default function Login() {
  const { login, user } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      console.error("Login failed", err);
      const msg = err.response?.data?.message || err.message || 'Invalid email or password';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-12">
      <Card className="w-full max-w-[400px] shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <CardHeader className="text-center space-y-2 pb-6">
          <div className="flex justify-center mb-2">
            <div className="h-10 w-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
              <Activity size={20} strokeWidth={2.5} />
            </div>
          </div>
          <CardTitle className="text-xl font-semibold text-slate-900 dark:text-white">
            EcoMonitor
          </CardTitle>
          <CardDescription className="text-slate-500 dark:text-slate-400">
            Sign in to your account
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm flex items-start gap-2 border border-red-100 dark:border-red-900/30">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Password
                </label>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200 dark:border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-slate-900 px-2 text-slate-500">
                Or continue with
              </span>
            </div>
          </div>

          <Button variant="outline" type="button" className="w-full gap-2 border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-800/80">
            <svg className="h-4 w-4" aria-hidden="true" viewBox="0 0 24 24">
              <path
                d="M12.0003 20.4144C16.4931 20.4144 20.2697 17.3698 21.6427 13.3424H12.0003V10.6576H23.8329C23.9492 11.2721 24.0097 11.9056 24.0097 12.5518C24.0097 19.4299 18.6318 25 12.0003 25C4.82029 25 0 20.1797 0 13C0 5.8203 5.8203 12.0003 13 12.0003ZM5.9897 16.5912L8.6826 14.5772C7.8188 13.9168 7.2526 12.872 7.2526 11.7274C7.2526 10.5828 7.8188 9.538 8.6826 8.8776L5.9897 6.8636C4.4697 8.016 3.4869 9.8732 3.4869 12.0003C3.4869 14.1274 4.4697 15.9846 5.9897 16.5912Z"
                fill="currentColor"
              />
              <path
                d="M12.0003 3.5856C14.0723 3.5856 15.9499 4.3412 17.3665 5.5676L19.9577 2.9764C17.8483 1.0588 15.0683 0 12.0003 0C7.2847 0 3.1671 2.766 1.1517 6.818L3.8446 8.832C4.9453 5.808 7.8463 3.5856 12.0003 3.5856Z"
                fill="#EA4335"
              />
            </svg>
            Google
          </Button>
        </CardContent>

        <CardFooter className="flex flex-col gap-2 pt-0 text-center">
          <Link
            to="/forgot"
            className="text-sm font-medium text-slate-600 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors"
          >
            Forgot password?
          </Link>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Don't have an account?{' '}
            <Link to="/register" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
              Register
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
